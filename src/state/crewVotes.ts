import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { CrewVotes, Vote } from '../features/crews/votes';
import { keep, listeners, load } from './crewVotesStore';
import type { SocialService } from '../features/social/service';
import { useSocial } from './social';
import * as store from './crewVotesStore';

/**
 * Your votes on a crew's lineup, kept on this phone first (`crewVotes.v1`,
 * per account) and sent to the crew a moment after you stop tapping, or
 * once there's signal; plus everyone else's, read while the voting page or
 * the crew page is open.
 */
const SEND_AFTER_MS = 1200;
const RETRY_MS = 20_000;
const READ_EVERY_MS = 30_000;

// One send per crew at a time: a moment after the last tap, and again later when it didn't get through.
const timers = new Map<string, ReturnType<typeof setTimeout>>();
function sendLater(service: SocialService, crewId: string, delay: number) {
  clearTimeout(timers.get(crewId));
  timers.set(
    crewId,
    setTimeout(() => {
      timers.delete(crewId);
      void (async () => {
        const d = (await load())[crewId];
        if (!d || !d.dirty) return;
        try {
          await service.setCrewVotes(crewId, { lineup: d.lineup, clashes: d.clashes });
          // Only clear "waiting" when nothing changed while it was sending.
          if ((await load())[crewId] === d) keep(crewId, { ...d, dirty: false });
        } catch {
          sendLater(service, crewId, RETRY_MS);
        }
      })();
    }, delay),
  );
}

export function useCrewVotes(crewId: string | undefined) {
  const social = useSocial();
  const uid = social.user?.uid;
  const service = social.service;
  const [, bump] = useState(0);
  const [others, setOthers] = useState<{ crewId?: string; list: CrewVotes[]; loaded: boolean }>({ list: [], loaded: false });

  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    void load().then(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  // Everyone's votes, read now, every half minute while open, and when the app comes back.
  const read = useCallback(async () => {
    if (!crewId || !uid) return;
    try {
      const list = await service.crewVotes(crewId);
      setOthers({ crewId, list, loaded: true });
      // Your own, from another phone, when there's nothing waiting here.
      const mine = list.find((v) => v.uid === uid);
      const d = (await load())[crewId];
      if (mine && (!d || !d.dirty)) keep(crewId, { lineup: mine.lineup, clashes: mine.clashes, dirty: false });
    } catch {
      setOthers((s) => (s.crewId === crewId ? { ...s, loaded: true } : { crewId, list: [], loaded: true }));
    }
  }, [crewId, uid, service]);
  useEffect(() => {
    void Promise.resolve().then(read);
    const every = setInterval(() => {
      if (AppState.currentState === 'active') void read();
    }, READ_EVERY_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void read());
    return () => {
      clearInterval(every);
      sub.remove();
    };
  }, [read]);

  const soon = useCallback(() => {
    if (crewId && uid) sendLater(service, crewId, SEND_AFTER_MS);
  }, [crewId, uid, service]);
  useEffect(() => {
    // Anything still waiting from before goes out.
    void load().then((d) => crewId && d[crewId]?.dirty && soon());
  }, [crewId, soon]);

  const draft = crewId ? store.drafts?.[crewId] : undefined;
  const vote = useCallback(
    (artistId: string, v: Vote | undefined) => {
      if (!crewId) return;
      const d = store.drafts?.[crewId] ?? { lineup: {}, clashes: {}, dirty: false };
      const lineup = { ...d.lineup };
      if (v === undefined) delete lineup[artistId];
      else lineup[artistId] = v;
      keep(crewId, { ...d, lineup, dirty: true });
      soon();
    },
    [crewId, soon],
  );
  const pick = useCallback(
    (key: string, artistId: string | undefined) => {
      if (!crewId) return;
      const d = store.drafts?.[crewId] ?? { lineup: {}, clashes: {}, dirty: false };
      const clashes = { ...d.clashes };
      if (artistId === undefined) delete clashes[key];
      else clashes[key] = artistId;
      keep(crewId, { ...d, clashes, dirty: true });
      soon();
    },
    [crewId, soon],
  );

  const mine: CrewVotes | undefined = uid && draft ? { uid, lineup: draft.lineup, clashes: draft.clashes, at: '' } : undefined;
  const list = others.crewId === crewId ? others.list : [];
  const votes = [...list.filter((v) => v.uid !== uid), ...(mine ? [mine] : list.filter((v) => v.uid === uid))];
  return { votes, mine, vote, pick, waiting: !!draft?.dirty, loaded: others.crewId === crewId && others.loaded };
}

/** How many acts you've voted on with your crews (your busiest crew), for the Crew vote badge. */
export function useMyCrewVoteCount(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    const read = () => void load().then((d) => live && setN(Math.max(0, ...Object.values(d).map((x) => Object.keys(x.lineup).length))));
    listeners.add(read);
    read();
    return () => {
      live = false;
      listeners.delete(read);
    };
  }, []);
  return n;
}
