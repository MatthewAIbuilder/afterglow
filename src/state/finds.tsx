import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetworkState } from 'expo-network';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  adopt,
  checked,
  cleanFinds,
  cleanHunts,
  type Find,
  type FindCard,
  findsFor,
  findsToCheck,
  findsToSend,
  type Hunt,
  huntProgress,
  type HuntProgress,
  missed,
  nextFindDue,
  queueFind,
  type Sticker,
  withAccountFinds,
} from '../features/finds/finds';
import { isOffline } from '../features/offline/status';
import { SocialError, socialErrorKind } from '../features/social/service';
import { notifyNow } from '../lib/notifyNow';
import { useSocial } from './social';

/**
 * Stickers you've found (features/finds), made for bad signal: a scan is kept
 * on the phone (AsyncStorage `finds.v1`) the moment it happens, checked
 * against Afterglow once there's signal (anyone can read a sticker, so this
 * works signed out), and sent to your account when you're signed in. Signed
 * in, finds kept on the account (from another phone, or before a reinstall)
 * are read back once a session (`myFinds`).
 */
type Stored = { finds: Find[]; hunts: Record<string, Hunt> };

type Ctx = {
  hydrated: boolean;
  online: boolean;
  /** Your finds (this account, or made signed out), newest first. */
  finds: Find[];
  /** Hunts you've found something from. */
  hunts: HuntProgress[];
  /** Every hunt this phone knows. */
  huntOf: (id: string) => Hunt | undefined;
  /** Keep a scan (once per sticker) and check it straight away if there's signal. */
  scan: (card: FindCard) => void;
  /** Your find for a code, if you've scanned it. */
  findOf: (code: string) => Find | undefined;
  /** Read a hunt again (stickers join hunts over time). */
  refreshHunt: (id: string) => void;
};

export const FINDS_KEY = 'finds.v1';
// Longer than the backend's own wait for a send, so its answer (sent before, ended) comes first.
const TRY_TIMEOUT_MS = 15_000;
const EMPTY: Stored = { finds: [], hunts: {} };
/** At most this many of the account's finds are read back. */
const ACCOUNT_FINDS_MAX = 500;

const timeout = <T,>(p: Promise<T>, ms: number) =>
  new Promise<T>((resolve, reject) => {
    // No answer in time counts as no signal, so it's tried again later.
    const t = setTimeout(() => reject(new SocialError('network', 'timeout')), ms);
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

const FindsContext = createContext<Ctx | null>(null);

export function FindsProvider({ children }: { children: ReactNode }) {
  const social = useSocial();
  const net = useNetworkState();
  const online = !isOffline(net);
  const account = social.user?.uid;
  const [stored, setStored] = useState<Stored>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const loaded = useRef(false);
  const readFailed = useRef(false);
  const [tick, setTick] = useState(0);
  const inFlight = useRef(new Set<string>());
  const running = useRef(false);
  const accountRef = useRef(account);
  useEffect(() => {
    accountRef.current = account;
  });

  useEffect(() => {
    AsyncStorage.getItem(FINDS_KEY)
      .catch((e) => {
        readFailed.current = true;
        throw e;
      })
      .then((raw) => {
        let s: Stored = EMPTY;
        try {
          const o = raw ? JSON.parse(raw) : {};
          s = { finds: cleanFinds(o?.finds), hunts: cleanHunts(o?.hunts) };
        } catch {}
        // Anything scanned while this was loading stays.
        setStored((cur) => ({ finds: [...cur.finds, ...s.finds.filter((f) => !cur.finds.some((c) => c.code === f.code && c.account === f.account))], hunts: { ...s.hunts, ...cur.hunts } }));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setHydrated(true);
      });
  }, []);
  useEffect(() => {
    if (loaded.current && !readFailed.current) AsyncStorage.setItem(FINDS_KEY, JSON.stringify(stored)).catch(() => {});
  }, [stored]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setTick((t) => t + 1);
    });
    return () => sub.remove();
  }, []);

  // Finds made signed out go to the first account that signs in.
  useEffect(() => {
    if (!hydrated || !account || !stored.finds.some((f) => !f.account)) return;
    void Promise.resolve().then(() => setStored((s) => ({ ...s, finds: adopt(s.finds, account) })));
  }, [hydrated, account, stored.finds]);

  // Finds kept on the account come back to this phone: once per account a session, after signed-out ones are adopted.
  const pulled = useRef(new Set<string>());
  const canPull = hydrated && online && !!account && social.availability.ok && !stored.finds.some((f) => !f.account);
  useEffect(() => {
    if (!canPull || !account || pulled.current.has(account)) return;
    pulled.current.add(account);
    let ok = true;
    (async () => {
      const remote = await timeout(social.service.myFinds(ACCOUNT_FINDS_MAX), TRY_TIMEOUT_MS);
      // Each sticker read for its name and creature, as a scan is checked (one that can't be read waits for next time).
      const read = new Map<string, Sticker | null>();
      for (const r of remote) {
        if (accountRef.current !== account) return;
        try {
          read.set(r.code, await timeout(social.service.sticker(r.code), TRY_TIMEOUT_MS));
        } catch {
          ok = false;
        }
      }
      if (accountRef.current !== account) return;
      setStored((s) => {
        const finds = withAccountFinds(s.finds, account, remote, (code) => read.get(code));
        return finds === s.finds ? s : { ...s, finds: [...finds] };
      });
    })()
      .catch(() => {
        ok = false;
      })
      .finally(() => {
        // Not everything could be read: try again the next time there's signal.
        if (!ok) pulled.current.delete(account);
      });
  }, [canPull, account, social.service]);

  // A signed-out find may have become an account's while it was being checked: still the same find.
  const update = useCallback(
    (f: Find, next: (x: Find) => Find) =>
      setStored((s) => ({ ...s, finds: s.finds.map((x) => (x.code === f.code && (x.account === f.account || (!f.account && x.account === accountRef.current)) ? next(x) : x)) })),
    [],
  );

  const loadHunt = useCallback(
    async (id: string) => {
      try {
        const h = await timeout(social.service.hunt(id), TRY_TIMEOUT_MS);
        if (h) setStored((s) => ({ ...s, hunts: { ...s.hunts, [id]: h } }));
      } catch {}
    },
    [social.service],
  );

  const check = useCallback(
    async (f: Find) => {
      const key = `check:${f.code}`;
      inFlight.current.add(key);
      try {
        const sticker = await timeout(social.service.sticker(f.code), TRY_TIMEOUT_MS);
        const done = checked(f, sticker, Date.now());
        update(f, () => done);
        if (done.huntId) await loadHunt(done.huntId);
        // Checked in the background after a wait for signal: say so.
        if (done.state === 'found' && f.tries > 0) void notifyNow(`find:${f.code}`, `You found ${done.name}`, 'It’s in your collection now.', `/find/${f.code}`);
      } catch {
        update(f, (x) => missed(x, Date.now()));
      } finally {
        inFlight.current.delete(key);
      }
    },
    [social.service, update, loadHunt],
  );

  const send = useCallback(
    async (f: Find) => {
      const key = `send:${f.code}`;
      inFlight.current.add(key);
      try {
        await timeout(social.service.recordFind(f.code, f.at), TRY_TIMEOUT_MS);
        update(f, (x) => ({ ...x, sent: true }));
      } catch (e) {
        const kind = socialErrorKind(e);
        // Refused for good (ended, or no such sticker): it stays in your collection on this phone; don't keep asking.
        // Anything else (no signal, a slow answer, a refusal that may pass) is tried again later.
        if (kind === 'sticker-ended' || kind === 'not-found') update(f, (x) => ({ ...x, sent: true }));
        else update(f, (x) => missed(x, Date.now()));
      } finally {
        inFlight.current.delete(key);
      }
    },
    [social.service, update],
  );

  useEffect(() => {
    if (!hydrated || !online || running.current) return;
    const t = Date.now();
    const toCheck = findsToCheck(stored.finds, t).filter((f) => !inFlight.current.has(`check:${f.code}`));
    const toSend = account && social.availability.ok ? findsToSend(stored.finds, account, t).filter((f) => !inFlight.current.has(`send:${f.code}`)) : [];
    if (!toCheck.length && !toSend.length) {
      const at = nextFindDue(stored.finds, account);
      if (at === undefined) return;
      const timer = setTimeout(() => setTick((x) => x + 1), Math.max(500, at - t));
      return () => clearTimeout(timer);
    }
    running.current = true;
    (async () => {
      for (const f of toCheck) await check(f);
      for (const f of toSend) if (accountRef.current === account) await send(f);
    })().finally(() => {
      running.current = false;
      setTick((x) => x + 1);
    });
  }, [hydrated, online, account, social.availability.ok, stored.finds, check, send, tick]);

  const scan = useCallback(
    (card: FindCard) => {
      setStored((s) => ({ ...s, finds: queueFind(s.finds, card, accountRef.current, Date.now()) }));
      setTick((x) => x + 1);
    },
    [setStored],
  );

  const finds = useMemo(() => findsFor(stored.finds, account), [stored.finds, account]);
  const hunts = useMemo(() => huntProgress(finds, stored.hunts), [finds, stored.hunts]);
  const huntOf = useCallback((id: string) => stored.hunts[id], [stored.hunts]);
  const findOf = useCallback((code: string) => finds.find((f) => f.code === code), [finds]);
  const refreshHunt = useCallback((id: string) => void loadHunt(id), [loadHunt]);
  // A hunt that couldn't be read when its sticker was found: try again once each time the app has signal.
  const triedHunts = useRef(new Set<string>());
  useEffect(() => {
    if (!online) triedHunts.current.clear();
    if (!hydrated || !online) return;
    for (const f of stored.finds)
      if (f.state === 'found' && f.huntId && !stored.hunts[f.huntId] && !triedHunts.current.has(f.huntId)) {
        triedHunts.current.add(f.huntId);
        void loadHunt(f.huntId);
      }
  }, [hydrated, online, stored.finds, stored.hunts, loadHunt]);
  const value = useMemo<Ctx>(() => ({ hydrated, online, finds, hunts, huntOf, scan, findOf, refreshHunt }), [hydrated, online, finds, hunts, huntOf, scan, findOf, refreshHunt]);
  return <FindsContext.Provider value={value}>{children}</FindsContext.Provider>;
}

export function useFinds(): Ctx {
  const ctx = useContext(FindsContext);
  if (!ctx) throw new Error('useFinds must be used inside FindsProvider');
  return ctx;
}
