import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { useNetworkState } from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { cleanAdds, dueAdds, type FriendAdd, markAdded, markTried, nextDue, queueAdd, tidyAdds } from '../features/friends/adds';
import { CODE_LENGTH, codeFrom, type CodeTheme, type FriendCard, isFriendCode, isTheme } from '../features/friends/qr';
import { isOffline } from '../features/offline/status';
import { socialErrorKind } from '../features/social/service';
import { notifyNow } from '../lib/notifyNow';
import { useSocial } from './social';

/**
 * Adding friends by QR code, made for bad signal. Your own code (shown as
 * a QR code) is made on this phone and saved to Afterglow when there's
 * signal. A code you scan is kept on the phone at once (AsyncStorage
 * `friendAdds.v1`) and sent as soon as there's signal, trying again by
 * itself; when it goes through later, a notification says so.
 */
export type AddResult = 'added' | 'waiting' | 'self' | 'signed-out' | 'needs-profile';

type Ctx = {
  /** What your QR code says, once you have a profile. */
  myCard?: FriendCard;
  /** Your code has reached Afterglow (until then, scans of it wait). */
  codeSaved: boolean;
  /** This account's scans, newest first. */
  adds: FriendAdd[];
  add: (card: FriendCard) => Promise<AddResult>;
  /** Try a given-up scan again. */
  retry: (uid: string) => void;
  remove: (uid: string) => void;
  /** A new code: old pictures of your code stop working. */
  newCode: () => void;
  theme: CodeTheme;
  setTheme: (t: CodeTheme) => void;
  online: boolean;
  hydrated: boolean;
};

export const FRIEND_ADDS_KEY = 'friendAdds.v1';
/** A try that hasn't answered by now counts as no signal (it may still land; adding is safe to repeat). */
export const ADD_TIMEOUT_MS = 10_000;
/** A friend code that couldn't be saved is tried again after this long. */
const CODE_RETRY_MS = 30_000;

type Saved = { adds: FriendAdd[]; codes: Record<string, { code: string; saved: boolean }>; theme: CodeTheme };

function randomCode(): string {
  try {
    return codeFrom(Crypto.getRandomBytes(CODE_LENGTH));
  } catch {
    return codeFrom(Array.from({ length: CODE_LENGTH }, () => Math.floor(Math.random() * 256)));
  }
}

function clean(raw: unknown, now: number): Saved {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const codes: Saved['codes'] = {};
  if (o.codes && typeof o.codes === 'object')
    for (const [k, v] of Object.entries(o.codes as Record<string, { code?: unknown; saved?: unknown }>))
      if (v && isFriendCode(v.code)) codes[k] = { code: v.code, saved: v.saved === true };
  return { adds: cleanAdds(o.adds, now), codes, theme: isTheme(o.theme) ? o.theme : 'glow' };
}

const timeout = <T,>(p: Promise<T>, ms: number) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });

const FriendAddsContext = createContext<Ctx | null>(null);

export function FriendAddsProvider({ children }: { children: ReactNode }) {
  const social = useSocial();
  const [saved, setSaved] = useState<Saved>({ adds: [], codes: {}, theme: 'glow' });
  const [hydrated, setHydrated] = useState(false);
  const loaded = useRef(false);
  const net = useNetworkState();
  const online = !isOffline(net);
  const [tick, setTick] = useState(0);
  const account = social.user?.uid;
  const ready = social.availability.ok && !!account && !!social.profile;

  useEffect(() => {
    AsyncStorage.getItem(FRIEND_ADDS_KEY)
      .then((raw) => {
        if (!raw) return;
        const s = clean(JSON.parse(raw), Date.now());
        setSaved((cur) => ({ adds: [...cur.adds, ...s.adds.filter((a) => !cur.adds.some((c) => c.uid === a.uid && c.account === a.account))], codes: { ...s.codes, ...cur.codes }, theme: s.theme }));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setHydrated(true);
      });
  }, []);
  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(FRIEND_ADDS_KEY, JSON.stringify(saved)).catch(() => {});
  }, [saved]);

  // Coming back to the app is a chance to send.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setTick((t) => t + 1));
    return () => sub.remove();
  }, []);

  // Your own code: made once per account on this phone, saved to Afterglow when there's signal.
  const mine = account ? saved.codes[account] : undefined;
  useEffect(() => {
    if (!hydrated || !account || !social.profile || mine) return;
    void Promise.resolve().then(() =>
      setSaved((s) => (s.codes[account] ? s : { ...s, codes: { ...s.codes, [account]: { code: randomCode(), saved: false } } })),
    );
  }, [hydrated, account, social.profile, mine]);
  const savingCode = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!ready || !online || !mine || mine.saved || !account || savingCode.current === mine.code) return;
    const code = mine.code;
    savingCode.current = code;
    social.service
      .setFriendCode(code)
      .then(() => setSaved((s) => (s.codes[account]?.code === code ? { ...s, codes: { ...s.codes, [account]: { code, saved: true } } } : s)))
      .catch(() => {
        setTimeout(() => {
          savingCode.current = undefined;
          setTick((t) => t + 1);
        }, CODE_RETRY_MS);
      });
  }, [ready, online, mine, account, social.service, tick]);

  // One try at adding someone: went through, no signal, or refused.
  const noteFollowing = social.noteFollowing;
  const tryOne = useCallback(
    async (a: FriendAdd): Promise<boolean> => {
      try {
        await timeout(social.service.addFriend(a.uid, a.code), ADD_TIMEOUT_MS);
        setSaved((s) => ({ ...s, adds: markAdded(s.adds, a.account, a.uid, Date.now()) }));
        noteFollowing(a.uid);
        if (a.tries > 0) void notifyNow(`friend-added:${a.uid}`, `You and ${a.name} are friends now`, 'Your scan went through once there was signal.', `/u/${a.handle}`);
        return true;
      } catch (e) {
        const noSignal = e instanceof Error && e.message === 'timeout' ? true : socialErrorKind(e) === 'network';
        setSaved((s) => ({ ...s, adds: markTried(s.adds, a.account, a.uid, !noSignal, Date.now()) }));
        return false;
      }
    },
    [social.service, noteFollowing],
  );

  // Waiting adds go out whenever there's a chance: signal back, the app opened, the wait over.
  const running = useRef(false);
  useEffect(() => {
    if (!hydrated || !ready || !online || !account || running.current) return;
    const now = Date.now();
    const tidy = tidyAdds(saved.adds, now);
    if (tidy !== saved.adds) {
      void Promise.resolve().then(() => setSaved((s) => ({ ...s, adds: tidyAdds(s.adds, Date.now()) })));
      return;
    }
    const due = dueAdds(saved.adds, account, now);
    if (!due.length) {
      const at = nextDue(saved.adds, account);
      if (at === undefined) return;
      const t = setTimeout(() => setTick((x) => x + 1), Math.max(500, at - now));
      return () => clearTimeout(t);
    }
    running.current = true;
    (async () => {
      for (const a of due) await tryOne(a);
    })().finally(() => {
      running.current = false;
      setTick((x) => x + 1);
    });
  }, [hydrated, ready, online, account, saved.adds, tryOne, tick]);

  const add = useCallback(
    async (card: FriendCard): Promise<AddResult> => {
      if (!social.user) return 'signed-out';
      const me = social.user.uid;
      if (card.uid === me) return 'self';
      const now = Date.now();
      // Kept straight away, marked as tried now so the background sender leaves this first try alone.
      const queued = queueAdd(saved.adds, card, me, now);
      const item = queued.find((a) => a.uid === card.uid && a.account === me);
      if (item?.state === 'added') return 'added';
      // Not tried now (no signal, or no profile yet): it counts as a wait, so going through later is news.
      const later = !social.profile || !online;
      setSaved((s) => ({
        ...s,
        adds: queueAdd(s.adds, card, me, now).map((a) => (a.uid === card.uid && a.account === me ? { ...a, lastTry: now, tries: later ? 1 : 0 } : a)),
      }));
      if (!social.profile) return 'needs-profile';
      if (!online || !item) return 'waiting';
      return (await tryOne(item)) ? 'added' : 'waiting';
    },
    [social.user, social.profile, saved.adds, online, tryOne],
  );

  const retry = useCallback(
    (uid: string) =>
      setSaved((s) => ({ ...s, adds: s.adds.map((a) => (a.uid === uid && a.account === account ? { ...a, state: 'waiting', at: Date.now(), tries: 0, refused: undefined, lastTry: undefined, doneAt: undefined } : a)) })),
    [account],
  );
  const remove = useCallback((uid: string) => setSaved((s) => ({ ...s, adds: s.adds.filter((a) => !(a.uid === uid && a.account === account)) })), [account]);
  const newCode = useCallback(() => {
    if (!account) return;
    setSaved((s) => ({ ...s, codes: { ...s.codes, [account]: { code: randomCode(), saved: false } } }));
  }, [account]);
  const setTheme = useCallback((theme: CodeTheme) => setSaved((s) => (s.theme === theme ? s : { ...s, theme })), []);

  const profile = social.profile;
  const myCard = useMemo<FriendCard | undefined>(
    () => (account && profile && mine ? { uid: account, handle: profile.handle, name: profile.displayName, code: mine.code } : undefined),
    [account, profile, mine],
  );
  const adds = useMemo(() => (account ? saved.adds.filter((a) => a.account === account) : []), [saved.adds, account]);

  const value = useMemo<Ctx>(
    () => ({ myCard, codeSaved: !!mine?.saved, adds, add, retry, remove, newCode, theme: saved.theme, setTheme, online, hydrated }),
    [myCard, mine?.saved, adds, add, retry, remove, newCode, saved.theme, setTheme, online, hydrated],
  );
  return <FriendAddsContext.Provider value={value}>{children}</FriendAddsContext.Provider>;
}

export function useFriendAdds(): Ctx {
  const ctx = useContext(FriendAddsContext);
  if (!ctx) throw new Error('useFriendAdds must be used inside FriendAddsProvider');
  return ctx;
}
