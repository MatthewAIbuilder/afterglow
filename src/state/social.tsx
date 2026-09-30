import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Memory } from '../features/memories/models';
import type { Profile, ProfileInput, ReportReason, SocialUser } from '../features/social/models';
import { publishedChanged } from '../features/social/publish';
import { SocialError, type ReportTarget, type SocialAvailability, type SocialService } from '../features/social/service';
import { defaultSocialService } from '../features/social/services';
import { tasteMix } from '../features/taste/lean';
import { useCatalog } from './catalog';
import { useGoing } from './going';
import { useMemories } from './memories';
import { useTaste } from './taste';

/**
 * Your social profile: who's signed in, your profile, sharing memories to
 * it, reports and blocks. Talks to the backend only through `SocialService`
 * (Firebase in the app, an in-memory one in tests).
 *
 * What's published is only what you choose: the profile fields you fill in,
 * the festivals and top sounds you switch on (kept current with your plans),
 * and each memory you share. Nothing about your taste, ratings, reactions or
 * music library is sent.
 */
type Ctx = {
  availability: SocialAvailability;
  /** The sign-in state is known (Firebase restores it on launch). */
  ready: boolean;
  user: SocialUser | null;
  /** Your profile once loaded; null when you're signed in but haven't made one. */
  profile: Profile | null;
  service: SocialService;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  saveProfile: (input: ProfileInput) => Promise<Profile>;
  setAvatar: (uri: string | null) => Promise<void>;
  /** Share a memory to your profile; `progress` shows how far along it is (0 to 1). */
  share: (memory: Memory) => Promise<void>;
  unshare: (memory: Memory) => Promise<void>;
  sharing: Record<string, number>;
  blocked: ReadonlySet<string>;
  setBlocked: (uid: string, blocked: boolean) => Promise<void>;
  report: (target: ReportTarget, reason: ReportReason, note?: string) => Promise<void>;
};

const SocialContext = createContext<Ctx | null>(null);

/** Only this many of your top sounds are shown. */
const SOUNDS_SHOWN = 3;

export function SocialProvider({ children, service: given }: { children: ReactNode; service?: SocialService }) {
  const service = useMemo(() => given ?? defaultSocialService(), [given]);
  const availability = useMemo(() => service.availability(), [service]);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SocialUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [blocked, setBlockedIds] = useState<ReadonlySet<string>>(new Set());
  const [sharing, setSharing] = useState<Record<string, number>>({});
  const mem = useMemories();

  // Sign-in state, then your profile and blocks whenever the account changes. An answer that arrives after
  // the account changed again (a quick sign-out and in) is dropped, so one account never shows another's profile.
  const currentUid = useRef<string | null>(null);
  useEffect(
    () =>
      service.onAuthChange((u) => {
        currentUid.current = u?.uid ?? null;
        setUser(u);
        setReady(true);
        setProfile(null);
        setBlockedIds(new Set());
        if (!u) return;
        service
          .profileOf(u.uid)
          .then((p) => currentUid.current === u.uid && setProfile(p))
          .catch(() => {});
        service
          .blocked()
          .then((ids) => currentUid.current === u.uid && setBlockedIds(new Set(ids)))
          .catch(() => {});
      }),
    [service],
  );

  // What your profile may publish, from your plans and your live taste.
  const { going } = useGoing();
  const { artists } = useCatalog();
  const { taste, informed } = useTaste();
  const sounds = useMemo(
    () => tasteMix(artists, taste, informed).slice(0, SOUNDS_SHOWN).map((s) => s.tag),
    [artists, taste, informed],
  );
  const published = useMemo(() => ({ festivals: [...going], sounds }), [going, sounds]);

  const saveProfile = useCallback(
    async (input: ProfileInput) => {
      const p = await service.saveProfile(input, published);
      if (currentUid.current === p.uid) setProfile(p);
      return p;
    },
    [service, published],
  );

  // Keep "Going to" and "My sound" current (a few seconds after they settle, only when they changed).
  useEffect(() => {
    if (!profile || !publishedChanged(profile, published.festivals, published.sounds)) return;
    const t = setTimeout(() => {
      const input: ProfileInput = { handle: profile.handle, displayName: profile.displayName, bio: profile.bio, showFestivals: profile.showFestivals, showSound: profile.showSound };
      service
        .saveProfile(input, published)
        .then((p) => currentUid.current === p.uid && setProfile(p))
        .catch(() => {});
    }, 3000);
    return () => clearTimeout(t);
  }, [profile, published, service]);

  const signUp = useCallback(async (email: string, password: string) => void (await service.signUp(email, password)), [service]);
  const signIn = useCallback(async (email: string, password: string) => void (await service.signIn(email, password)), [service]);
  const signOut = useCallback(() => service.signOut(), [service]);
  const deleteAccount = useCallback(
    async (password: string) => {
      const uid = user?.uid;
      await service.deleteAccount(password);
      if (uid) mem.forgetShares(uid);
    },
    [service, user, mem],
  );
  const setAvatar = useCallback(async (uri: string | null) => setProfile(await service.setAvatar(uri)), [service]);

  const inflight = useRef<Set<string>>(new Set());
  const share = useCallback(
    async (m: Memory) => {
      if (!user) throw new SocialError('not-signed-in');
      if (!profile) throw new SocialError('no-profile');
      if (inflight.current.has(m.id) || (m.sharedId && m.sharedBy === user.uid)) return;
      inflight.current.add(m.id);
      setSharing((s) => ({ ...s, [m.id]: 0 }));
      try {
        const shared = await service.shareMemory(
          {
            memoryId: m.id,
            videoUri: mem.uriOf(m.file),
            thumbUri: m.thumb ? mem.uriOf(m.thumb) : undefined,
            festivalId: m.festivalId,
            night: m.night,
            artistId: m.artistId,
            capturedAt: m.capturedAt,
            durationSec: m.durationSec,
            width: m.width,
            height: m.height,
          },
          (p) => setSharing((s) => (m.id in s ? { ...s, [m.id]: p } : s)),
        );
        mem.setShared(m.id, { id: shared.id, by: user.uid });
      } finally {
        inflight.current.delete(m.id);
        setSharing(({ [m.id]: _done, ...rest }) => rest);
      }
    },
    [service, user, profile, mem],
  );
  const unshare = useCallback(
    async (m: Memory) => {
      if (!m.sharedId) return;
      await service.unshareMemory(m.sharedId);
      mem.setShared(m.id, undefined);
    },
    [service, mem],
  );

  const setBlocked = useCallback(
    async (uid: string, on: boolean) => {
      await service.setBlocked(uid, on);
      setBlockedIds((s) => {
        const next = new Set(s);
        if (on) next.add(uid);
        else next.delete(uid);
        return next;
      });
    },
    [service],
  );
  const report = useCallback((target: ReportTarget, reason: ReportReason, note?: string) => service.report(target, reason, note), [service]);

  const value = useMemo<Ctx>(
    () => ({ availability, ready, user, profile, service, signUp, signIn, signOut, deleteAccount, saveProfile, setAvatar, share, unshare, sharing, blocked, setBlocked, report }),
    [availability, ready, user, profile, service, signUp, signIn, signOut, deleteAccount, saveProfile, setAvatar, share, unshare, sharing, blocked, setBlocked, report],
  );
  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial() {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error('useSocial must be used inside SocialProvider');
  return ctx;
}
