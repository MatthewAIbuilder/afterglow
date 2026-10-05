import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetworkState } from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { isSupportAccount } from '../features/admin/admin';
import { isOffline } from '../features/offline/status';
import type { Memory } from '../features/memories/models';
import type { Profile, ProfileInput, ReportReason, SocialUser } from '../features/social/models';
import { publishedChanged } from '../features/social/publish';
import { SOCIAL_ERROR_COPY, SocialError, socialErrorKind, type ReportTarget, type SocialAvailability, type SocialService } from '../features/social/service';
import { cleanShareOutbox, queueShare, sharesOf, shareRetryDelay, shareTried, unqueueShare, type ShareItem } from '../features/social/shareOutbox';
import { defaultSocialService } from '../features/social/services';
import { tasteMix } from '../features/taste/lean';
import { showAlert } from '../lib/dialog';
import { useCatalog } from './catalog';
import { useGoing } from './going';
import { forgetLastKnownAccount, lastKnownFor, rememberLastKnown } from './lastKnown';
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
  /** Whether your profile has been read: "loading" (or signed out), "ready" (profile is the answer), or "failed" (no signal: don't treat it as no profile). */
  profileStatus: 'loading' | 'ready' | 'failed';
  /** Read your profile again (after it failed). */
  reloadProfile: () => void;
  service: SocialService;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  saveProfile: (input: ProfileInput) => Promise<Profile>;
  setAvatar: (uri: string | null) => Promise<void>;
  /** Read your sign-in again (after confirming your email). */
  refreshUser: () => Promise<void>;
  setCover: (uri: string | null) => Promise<void>;
  /**
   * Share a memory to your profile; `sharing` shows how far along it is (0 to 1). With no signal it's kept
   * on the phone and sent by itself later ("waiting"); a refusal throws (and it's not kept).
   */
  share: (memory: Memory) => Promise<'shared' | 'waiting'>;
  unshare: (memory: Memory) => Promise<void>;
  sharing: Record<string, number>;
  /** Memories waiting for signal to be shared (this account's). */
  waiting: ReadonlySet<string>;
  blocked: ReadonlySet<string>;
  /** Blocking also ends follows both ways. */
  setBlocked: (uid: string, blocked: boolean) => Promise<void>;
  /** People you follow. */
  following: ReadonlySet<string>;
  /** Follow or unfollow; shown straight away, undone if it doesn't go through. */
  setFollowing: (uid: string, on: boolean) => Promise<void>;
  /** Count someone as followed on this phone after a follow made elsewhere (scanning their QR code). */
  noteFollowing: (uid: string) => void;
  report: (target: ReportTarget, reason: ReportReason, note?: string) => Promise<void>;
};

const SocialContext = createContext<Ctx | null>(null);

/** How many of the people you follow are loaded (and followable). */
export const FOLLOWING_MAX = 1000;

const withId = (s: ReadonlySet<string>, id: string, on: boolean) => {
  if (s.has(id) === on) return s;
  const next = new Set(s);
  if (on) next.add(id);
  else next.delete(id);
  return next;
};

/** Videos waiting for signal to be shared to Discover (memory ids and whose they are, never the video). */
export const SHARE_OUTBOX_KEY = 'shareOutbox.v1';

/** Only this many of your top sounds are shown. */
const SOUNDS_SHOWN = 3;

export function SocialProvider({ children, service: given }: { children: ReactNode; service?: SocialService }) {
  const service = useMemo(() => given ?? defaultSocialService(), [given]);
  const availability = useMemo(() => service.availability(), [service]);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SocialUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileStatus, setProfileStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  // When the profile shown is this phone's copy (no signal on opening), when that copy was read.
  const [profileKeptAt, setProfileKeptAt] = useState<number | undefined>(undefined);
  const [blocked, setBlockedIds] = useState<ReadonlySet<string>>(new Set());
  const [following, setFollowingIds] = useState<ReadonlySet<string>>(new Set());
  const [sharing, setSharing] = useState<Record<string, number>>({});
  // Videos waiting for signal to be shared to Discover (see the outbox below).
  const [outbox, setOutbox] = useState<ShareItem[]>([]);
  const mem = useMemories();

  // Sign-in state, then your profile and blocks whenever the account changes. An answer that arrives after
  // the account changed again (a quick sign-out and in) is dropped, so one account never shows another's profile.
  // With no signal, what this phone last read stands in (state/lastKnown), so a festival with no bars still has you.
  const currentUid = useRef<string | null>(null);
  const readAccount = useCallback(
    (uid: string, quiet: boolean) => {
      service
        .profileOf(uid)
        .then((p) => {
          if (currentUid.current !== uid) return;
          setProfile(p);
          setProfileStatus('ready');
          setProfileKeptAt(undefined);
          rememberLastKnown(uid, { profile: p ? { value: p, at: Date.now() } : undefined });
        })
        .catch(async () => {
          if (quiet) return;
          const kept = (await lastKnownFor(uid))?.profile;
          if (currentUid.current !== uid) return;
          if (kept) {
            setProfile(kept.value);
            setProfileKeptAt(kept.at);
            setProfileStatus('ready');
          } else setProfileStatus('failed');
        });
      service
        .blocked()
        .then((ids) => {
          if (currentUid.current !== uid) return;
          setBlockedIds(new Set(ids));
          rememberLastKnown(uid, { blocked: ids });
        })
        .catch(async () => {
          const kept = (await lastKnownFor(uid))?.blocked;
          if (!quiet && kept && currentUid.current === uid) setBlockedIds(new Set(kept));
        });
      service
        .following(uid, FOLLOWING_MAX)
        .then((ids) => {
          if (currentUid.current !== uid) return;
          setFollowingIds(new Set(ids));
          rememberLastKnown(uid, { following: ids });
        })
        .catch(async () => {
          const kept = (await lastKnownFor(uid))?.following;
          if (!quiet && kept && currentUid.current === uid) setFollowingIds(new Set(kept));
        });
    },
    [service],
  );
  useEffect(
    () =>
      service.onAuthChange((u) => {
        currentUid.current = u?.uid ?? null;
        setUser(u);
        setReady(true);
        setProfile(null);
        setProfileStatus('loading');
        setProfileKeptAt(undefined);
        setBlockedIds(new Set());
        setFollowingIds(new Set());
        if (!u) return;
        readAccount(u.uid, false);
      }),
    [service, readAccount],
  );
  // Signal back after opening without it: read your profile, blocks and follows for real.
  const offline = isOffline(useNetworkState());
  const behind = profileKeptAt !== undefined || profileStatus === 'failed';
  const wasOffline = useRef(false);
  useEffect(() => {
    if (offline) {
      wasOffline.current = true;
      return;
    }
    const uid = currentUid.current;
    if (!wasOffline.current || !behind || !uid) return;
    wasOffline.current = false;
    readAccount(uid, true);
  }, [offline, behind, readAccount]);

  // A profile just read or saved: shown, and kept on this phone.
  const keepProfile = useCallback((p: Profile) => {
    setProfile(p);
    setProfileKeptAt(undefined);
    rememberLastKnown(p.uid, { profile: { value: p, at: Date.now() } });
  }, []);

  const reloadProfile = useCallback(() => {
    const uid = currentUid.current;
    if (!uid) return;
    setProfileStatus('loading');
    service
      .profileOf(uid)
      .then((p) => {
        if (currentUid.current !== uid) return;
        setProfile(p);
        setProfileStatus('ready');
        setProfileKeptAt(undefined);
        rememberLastKnown(uid, { profile: p ? { value: p, at: Date.now() } : undefined });
      })
      .catch(() => currentUid.current === uid && setProfileStatus('failed'));
  }, [service]);

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
      if (currentUid.current === p.uid) keepProfile(p);
      return p;
    },
    [service, published, keepProfile],
  );

  // Keep "Going to" and "My sound" current (a few seconds after they settle, only when they changed).
  // Never on the support account: plans and taste are this phone's, so switching to HQ would publish yours there.
  // Not from this phone's copy: an old copy must never be published over a newer profile.
  useEffect(() => {
    if (!profile || profileKeptAt !== undefined || isSupportAccount(user) || !publishedChanged(profile, published.festivals, published.sounds)) return;
    const t = setTimeout(() => {
      const input: ProfileInput = { handle: profile.handle, displayName: profile.displayName, bio: profile.bio, showFestivals: profile.showFestivals, showSound: profile.showSound, socials: profile.socials ?? {} };
      service
        .saveProfile(input, published)
        .then((p) => currentUid.current === p.uid && keepProfile(p))
        .catch(() => {});
    }, 3000);
    return () => clearTimeout(t);
  }, [profile, profileKeptAt, published, service, user, keepProfile]);

  const signUp = useCallback(async (email: string, password: string) => void (await service.signUp(email, password)), [service]);
  const signIn = useCallback(async (email: string, password: string) => void (await service.signIn(email, password)), [service]);
  const signOut = useCallback(() => service.signOut(), [service]);
  const deleteAccount = useCallback(
    async (password: string) => {
      const uid = user?.uid;
      await service.deleteAccount(password);
      if (uid) {
        mem.forgetShares(uid);
        forgetLastKnownAccount(uid);
        setOutbox((o) => o.filter((i) => i.uid !== uid));
      }
    },
    [service, user, mem],
  );
  const setAvatar = useCallback(async (uri: string | null) => keepProfile(await service.setAvatar(uri)), [service, keepProfile]);
  const refreshUser = useCallback(async () => {
    const u = await service.reloadUser();
    if (u && u.uid === currentUid.current) setUser(u);
  }, [service]);
  const setCover = useCallback(async (uri: string | null) => keepProfile(await service.setCover(uri)), [service, keepProfile]);

  // --- Sharing to Discover, through an outbox kept on the phone (`shareOutbox.v1`): a share asked for with no
  // signal waits there and goes by itself, oldest first, once there's signal or the app comes back.
  const outboxWritable = useRef(false);
  const [outboxTry, setOutboxTry] = useState(0);
  useEffect(() => {
    if (outboxWritable.current) return;
    let live = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    AsyncStorage.getItem(SHARE_OUTBOX_KEY)
      .then((raw) => {
        if (!live) return;
        const saved = cleanShareOutbox(raw ? JSON.parse(raw) : []);
        outboxWritable.current = true;
        setOutbox((now) => saved.reduce((l, i) => queueShare(l, i), now));
      })
      .catch(() => {
        // Never written over until it's been read; try again shortly.
        if (live) retry = setTimeout(() => setOutboxTry((t) => t + 1), 5_000);
      });
    return () => {
      live = false;
      if (retry) clearTimeout(retry);
    };
  }, [outboxTry]);
  useEffect(() => {
    if (outboxWritable.current) AsyncStorage.setItem(SHARE_OUTBOX_KEY, JSON.stringify(outbox)).catch(() => {});
  }, [outbox]);
  const outboxRef = useRef(outbox);
  const memoriesRef = useRef(mem.memories);
  useEffect(() => {
    outboxRef.current = outbox;
    memoriesRef.current = mem.memories;
  }, [outbox, mem.memories]);

  const inflight = useRef<Set<string>>(new Set());
  /** Upload one memory now; throws what the service says. */
  const upload = useCallback(
    async (m: Memory, uid: string) => {
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
            past: m.past,
            capturedAt: m.capturedAt,
            durationSec: m.durationSec,
            width: m.width,
            height: m.height,
          },
          (p) => setSharing((s) => (m.id in s ? { ...s, [m.id]: p } : s)),
        );
        // Deleted from the phone while it was uploading: take the Discover copy down again, so nothing
        // stays public that you can no longer see or remove.
        if (mem.wasRemoved(m.id)) {
          await service.unshareMemory(shared.id).catch(() => {});
          return;
        }
        mem.setShared(m.id, { id: shared.id, by: uid });
      } finally {
        inflight.current.delete(m.id);
        setSharing(({ [m.id]: _done, ...rest }) => rest);
      }
    },
    [service, mem],
  );

  const [shareTick, setShareTick] = useState(0);
  const later = useCallback((tries: number) => setTimeout(() => setShareTick((t) => t + 1), shareRetryDelay(tries)), []);
  const share = useCallback(
    async (m: Memory): Promise<'shared' | 'waiting'> => {
      if (!user) throw new SocialError('not-signed-in');
      if (!profile) throw new SocialError('no-profile');
      if (m.sharedId && m.sharedBy === user.uid) return 'shared';
      const uid = user.uid;
      if (inflight.current.has(m.id)) return 'shared';
      // Kept first, so closing the app (or losing signal) never loses the share.
      setOutbox((o) => queueShare(o, { memoryId: m.id, uid, at: Date.now() }));
      if (offline) return 'waiting';
      try {
        await upload(m, uid);
        setOutbox((o) => unqueueShare(o, m.id, uid));
        return 'shared';
      } catch (e) {
        if (socialErrorKind(e) === 'network') {
          setOutbox((o) => shareTried(o, m.id, uid));
          later(0);
          return 'waiting';
        }
        // Refused: it isn't kept for later; the caller says why.
        setOutbox((o) => unqueueShare(o, m.id, uid));
        throw e;
      }
    },
    [user, profile, offline, upload, later],
  );

  // Send what's waiting, oldest first, whenever there's a chance. No signal stops the queue (nothing else
  // would get through); a refusal lets that one go with a plain message and carries on with the rest.
  const flushing = useRef(false);
  const flushShares = useCallback(async () => {
    const uid = user?.uid;
    if (flushing.current || !uid || !profile || !mem.hydrated || offline) return;
    flushing.current = true;
    try {
      for (const item of sharesOf(outboxRef.current, uid)) {
        if (currentUid.current !== uid) break;
        if (inflight.current.has(item.memoryId)) continue;
        const m = memoriesRef.current.find((x) => x.id === item.memoryId);
        if (!m || (m.sharedId && m.sharedBy === uid)) {
          // Deleted from the phone, or already shared.
          setOutbox((o) => unqueueShare(o, item.memoryId, uid));
          continue;
        }
        try {
          await upload(m, uid);
          setOutbox((o) => unqueueShare(o, item.memoryId, uid));
        } catch (e) {
          const kind = socialErrorKind(e);
          if (kind === 'network') {
            setOutbox((o) => shareTried(o, item.memoryId, uid));
            later(item.tries + 1);
            break;
          }
          setOutbox((o) => unqueueShare(o, item.memoryId, uid));
          if (currentUid.current === uid) {
            showAlert(
              'Couldn’t share it to Discover',
              kind === 'throwback-limit' ? SOCIAL_ERROR_COPY[kind] : `${SOCIAL_ERROR_COPY[kind]} It’s saved in your Memories, so you can share it from there.`,
            );
          }
        }
      }
    } finally {
      flushing.current = false;
    }
  }, [user, profile, mem.hydrated, offline, upload, later]);
  const waitingCount = sharesOf(outbox, user?.uid).length;
  useEffect(() => {
    if (waitingCount) void flushShares();
  }, [waitingCount, shareTick, flushShares]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        setShareTick((t) => t + 1);
        if (!outboxWritable.current) setOutboxTry((t) => t + 1);
      }
    });
    return () => sub.remove();
  }, []);
  const waiting = useMemo<ReadonlySet<string>>(
    () => new Set(sharesOf(outbox, user?.uid).map((i) => i.memoryId).filter((id) => !(id in sharing))),
    [outbox, user?.uid, sharing],
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
      setBlockedIds((s) => withId(s, uid, on));
      if (on) {
        // Blocking ends follows either way (best effort: the block itself already stands).
        setFollowingIds((s) => withId(s, uid, false));
        await Promise.all([service.unfollow(uid).catch(() => {}), service.removeFollower(uid).catch(() => {})]);
      }
    },
    [service],
  );
  const noteFollowing = useCallback((uid: string) => setFollowingIds((s) => withId(s, uid, true)), []);
  const setFollowing = useCallback(
    async (uid: string, on: boolean) => {
      if (!user) throw new SocialError('not-signed-in');
      if (on && !profile) throw new SocialError('no-profile');
      if (uid === user.uid) return;
      setFollowingIds((s) => withId(s, uid, on));
      try {
        await (on ? service.follow(uid) : service.unfollow(uid));
      } catch (e) {
        if (currentUid.current === user.uid) setFollowingIds((s) => withId(s, uid, !on));
        throw e;
      }
    },
    [service, user, profile],
  );
  const report = useCallback((target: ReportTarget, reason: ReportReason, note?: string) => service.report(target, reason, note), [service]);

  const value = useMemo<Ctx>(
    () => ({ availability, ready, user, profile, profileStatus, reloadProfile, service, signUp, signIn, signOut, deleteAccount, saveProfile, setAvatar, refreshUser, setCover, share, unshare, sharing, waiting, blocked, setBlocked, following, setFollowing, noteFollowing, report }),
    [availability, ready, user, profile, profileStatus, reloadProfile, service, signUp, signIn, signOut, deleteAccount, saveProfile, setAvatar, refreshUser, setCover, share, unshare, sharing, waiting, blocked, setBlocked, following, setFollowing, noteFollowing, report],
  );
  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

/** The social context, or null outside SocialProvider (for little touches that never need it). */
export function useSocialMaybe() {
  return useContext(SocialContext);
}

export function useSocial() {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error('useSocial must be used inside SocialProvider');
  return ctx;
}
