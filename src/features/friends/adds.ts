import type { FriendCard } from './qr';

/**
 * Friends added by scanning a QR code, pure. Festival signal is often awful,
 * so a scan is saved on the phone straight away with everything needed (who,
 * and their code) and sent as soon as there's signal: tried again with a
 * growing wait, given up only after a day, or when the code keeps being
 * refused long after the person could have been online.
 */

export type AddState = 'waiting' | 'added' | 'failed';

export type FriendAdd = FriendCard & {
  /** The account that scanned (adds only go out while that account is signed in). */
  account: string;
  /** When you scanned. */
  at: number;
  state: AddState;
  /** Tries so far, and when the last one was. */
  tries: number;
  lastTry?: number;
  /** Tries the server refused (an old code, or their code isn't saved yet). */
  refused?: number;
  /** When it went through (or was given up). */
  doneAt?: number;
  /** Went through on a later try, not straight away (so it's news). */
  later?: boolean;
};

/** Waiting adds are given up after a day. */
export const ADD_KEEP_MS = 24 * 60 * 60 * 1000;
/** Finished adds stay listed for this long. */
export const DONE_KEEP_MS = 3 * 24 * 60 * 60 * 1000;
/** Refused this many times (spread over hours, as tries back off) and it's given up. */
export const ADD_REFUSED_MAX = 12;
/** At most this many remembered. */
export const ADDS_MAX = 50;

/** Wait before the next try: 15 s, doubling, at most 5 minutes. */
export const addDelay = (tries: number) => Math.min(15_000 * 2 ** Math.max(0, tries - 1), 5 * 60_000);

/** A new scan: waiting, ahead of the rest. A fresh scan of someone waiting or given up starts again with the new code; someone already added stays added. */
export function queueAdd(list: readonly FriendAdd[], card: FriendCard, account: string, now: number): FriendAdd[] {
  const had = list.find((a) => a.uid === card.uid && a.account === account);
  if (had?.state === 'added') return list as FriendAdd[];
  const item: FriendAdd = { ...card, account, at: now, state: 'waiting', tries: 0 };
  return [item, ...list.filter((a) => a !== had)].slice(0, ADDS_MAX);
}

const update = (list: readonly FriendAdd[], account: string, uid: string, f: (a: FriendAdd) => FriendAdd): FriendAdd[] =>
  list.map((a) => (a.account === account && a.uid === uid ? f(a) : a));

/** It went through. */
export const markAdded = (list: readonly FriendAdd[], account: string, uid: string, now: number): FriendAdd[] =>
  update(list, account, uid, (a) => ({ ...a, state: 'added', doneAt: now, tries: a.tries + 1, lastTry: now, later: a.tries > 0 }));

/** A try that didn't go through: no signal, or refused. Refused too often and it's given up. */
export function markTried(list: readonly FriendAdd[], account: string, uid: string, refused: boolean, now: number): FriendAdd[] {
  return update(list, account, uid, (a) => {
    const r = (a.refused ?? 0) + (refused ? 1 : 0);
    const next: FriendAdd = { ...a, tries: a.tries + 1, lastTry: now, refused: r || undefined };
    return r >= ADD_REFUSED_MAX ? { ...next, state: 'failed', doneAt: now } : next;
  });
}

/** Waiting adds for this account whose wait is over, oldest scan first. */
export function dueAdds(list: readonly FriendAdd[], account: string, now: number): FriendAdd[] {
  return list
    .filter((a) => a.account === account && a.state === 'waiting' && (!a.lastTry || now - a.lastTry >= addDelay(a.tries)))
    .sort((a, b) => a.at - b.at);
}

/** When the next waiting add is due, if any. */
export function nextDue(list: readonly FriendAdd[], account: string): number | undefined {
  const times = list.filter((a) => a.account === account && a.state === 'waiting').map((a) => (a.lastTry ? a.lastTry + addDelay(a.tries) : 0));
  return times.length ? Math.min(...times) : undefined;
}

/** Old waiting adds given up; finished ones forgotten after a few days. */
export function tidyAdds(list: readonly FriendAdd[], now: number): FriendAdd[] {
  let changed = false;
  const out: FriendAdd[] = [];
  for (const a of list) {
    if (a.state !== 'waiting' && now - (a.doneAt ?? a.at) > DONE_KEEP_MS) {
      changed = true;
      continue;
    }
    if (a.state === 'waiting' && now - a.at > ADD_KEEP_MS) {
      changed = true;
      out.push({ ...a, state: 'failed', doneAt: now });
      continue;
    }
    out.push(a);
  }
  return changed ? out : (list as FriendAdd[]);
}

/** What was saved, read back safely. */
export function cleanAdds(raw: unknown, now: number): FriendAdd[] {
  if (!Array.isArray(raw)) return [];
  const out: FriendAdd[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const a = r as Record<string, unknown>;
    if (typeof a.uid !== 'string' || typeof a.handle !== 'string' || typeof a.code !== 'string' || typeof a.account !== 'string') continue;
    if (typeof a.at !== 'number' || !['waiting', 'added', 'failed'].includes(a.state as string)) continue;
    out.push({
      uid: a.uid,
      handle: a.handle,
      name: typeof a.name === 'string' && a.name ? a.name : a.handle,
      code: a.code,
      account: a.account,
      at: a.at,
      state: a.state as AddState,
      tries: typeof a.tries === 'number' ? a.tries : 0,
      lastTry: typeof a.lastTry === 'number' ? a.lastTry : undefined,
      refused: typeof a.refused === 'number' ? a.refused : undefined,
      doneAt: typeof a.doneAt === 'number' ? a.doneAt : undefined,
      later: a.later === true || undefined,
    });
  }
  return tidyAdds(out.slice(0, ADDS_MAX), now);
}

/** The line under someone in the list. */
export function addLine(a: FriendAdd): string {
  if (a.state === 'added') return 'Friends now';
  if (a.state === 'failed') return 'Couldn’t add them. Ask them to show their code again.';
  return 'Waiting for signal. It sends by itself.';
}
