import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { type Sent, worthSending } from '../features/crews/live';
import type { CrewLive } from '../features/social/models';
import { liveListeners, loadSharing, setSharing, sharingNow } from './crewLiveStore';
import { saverOn } from './batterySaver';
import { useCrews } from './crews';
import { useSocial } from './social';

/**
 * Crew on the map: sharing where you are with a crew (only when you turn it
 * on, only while a festival you're both at is on, and it switches itself
 * off), and reading where crewmates who share are.
 */
const READ_EVERY_MS = 20_000;
/** With battery saver on: your spot at most this often, crewmates' read this often. */
const SAVER_SEND_MS = 4 * 60_000;
const SAVER_READ_MS = 60_000;
const CHECK_EVERY_MS = 60_000;

/** Turn sharing on: asks for location first. False when it isn't allowed. */
export async function askToShare(): Promise<boolean> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    return perm.granted;
  } catch {
    return false;
  }
}

/**
 * Sends where you are to every crew you're sharing with while the app is
 * open (moving 20 m or a minute on, or every five minutes regardless), and
 * stops each one at its end time. Draws nothing.
 */
export function LiveSharer() {
  const social = useSocial();
  const { crews } = useCrews();
  const uid = social.user?.uid;
  const service = social.service;
  const [active, setActive] = useState<string[]>([]);
  const last = useRef<Sent | undefined>(undefined);
  const crewKey = crews.map((c) => `${c.id}:${uid && c.members.includes(uid) ? 1 : 0}`).join('|');

  // Which crews are on, and stopping the ones whose time is up (or that you've left).
  useEffect(() => {
    if (!uid) return;
    let live = true;
    const check = async () => {
      const all = await loadSharing();
      const now = Date.now();
      const mine = new Set(crews.filter((c) => c.members.includes(uid)).map((c) => c.id));
      for (const [crewId, until] of Object.entries(all)) {
        if (until > now && mine.has(crewId)) continue;
        setSharing(crewId, undefined);
        void service.stopLive(crewId).catch(() => {});
      }
      if (live) setActive(Object.keys(sharingNow()));
    };
    void check();
    const timer = setInterval(() => void check(), CHECK_EVERY_MS);
    const l = () => void check();
    liveListeners.add(l);
    return () => {
      live = false;
      clearInterval(timer);
      liveListeners.delete(l);
    };
    // crewKey stands for `crews`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, crewKey, service]);

  // While any crew is on and the app is open: follow where you are.
  const activeKey = active.join('|');
  useEffect(() => {
    if (!uid || !active.length) return;
    let sub: { remove: () => void } | undefined;
    let stopped = false;
    const start = async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted || stopped) return;
        sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 15, timeInterval: 30_000 }, (p) => {
          const here = { lat: p.coords.latitude, lon: p.coords.longitude };
          const now = Date.now();
          if (!worthSending(last.current, here, now)) return;
          // Battery saver: every few minutes at most.
          if (saverOn() && last.current && now - last.current.at < SAVER_SEND_MS) return;
          last.current = { at: now, ...here };
          const all = sharingNow();
          for (const crewId of active) {
            const until = all[crewId];
            if (until && until > now) void service.shareLive(crewId, { ...here, ...(p.coords.accuracy != null ? { accuracy: p.coords.accuracy } : {}), until }).catch(() => {});
          }
        });
        if (stopped) sub.remove();
      } catch {
        // No location: nothing to send.
      }
    };
    const stop = () => {
      sub?.remove();
      sub = undefined;
    };
    if (AppState.currentState === 'active') void start();
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        stop();
        void start();
      } else stop();
    });
    return () => {
      stopped = true;
      stop();
      appSub.remove();
    };
    // activeKey stands for `active`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, activeKey, service]);
  return null;
}

/** On a crew's page: who's sharing where they are, and your own switch. */
export function useCrewLive(crewId: string) {
  const social = useSocial();
  const service = social.service;
  const signedIn = !!social.user;
  const [others, setOthers] = useState<{ crewId: string; list: CrewLive[] } | undefined>();
  const [, bump] = useState(0);

  useEffect(() => {
    const l = () => bump((n) => n + 1);
    liveListeners.add(l);
    void loadSharing().then(l);
    return () => {
      liveListeners.delete(l);
    };
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    const read = () =>
      service
        .crewLive(crewId)
        .then((list) => live && setOthers({ crewId, list }))
        .catch(() => {});
    void Promise.resolve().then(read);
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      if (AppState.currentState === 'active' && (!saverOn() || ticks % Math.round(SAVER_READ_MS / READ_EVERY_MS) === 0)) void read();
    }, READ_EVERY_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [crewId, signedIn, service]);

  const start = useCallback(
    async (until: number) => {
      if (!(await askToShare())) return false;
      setSharing(crewId, until);
      try {
        const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await service.shareLive(crewId, { lat: p.coords.latitude, lon: p.coords.longitude, ...(p.coords.accuracy != null ? { accuracy: p.coords.accuracy } : {}), until });
      } catch {
        // The sender tries again as you move.
      }
      return true;
    },
    [crewId, service],
  );
  const stop = useCallback(async () => {
    setSharing(crewId, undefined);
    await service.stopLive(crewId).catch(() => {});
  }, [crewId, service]);

  return { others: others?.crewId === crewId ? others.list : [], sharingUntil: sharingNow()[crewId], start, stop };
}
