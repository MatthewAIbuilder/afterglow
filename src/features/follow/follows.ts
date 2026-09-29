import { setFor } from '../../data/festival';
import type { Artist, Festival } from '../../data/models';
import { describeSet } from '../festivals/format';
import { daysUntil, nextRun, runsOf } from '../festivals/when';
import type { Notice } from '../notifications/inbox';

/**
 * Artists you follow: "keep me posted". Pure. Following is a standing "I'm
 * into them", a quieter taste signal than rating them (see the engine), and
 * it brings news to the bell: when they join a lineup, and when their set
 * time comes out. Only news that arrives after you follow counts: what was
 * already known then is kept with the follow, so following someone never
 * rings the bell for things you could already see on their page.
 */

/** artist id -> news already known (see `newsKeys`) when you followed, and since. */
export type Follows = Record<string, string[]>;

export type News = { key: string; festival: Festival; kind: 'joined' | 'setTime' };

/** Whether a festival is still to come or on (undated festivals count as to come). */
const upcoming = (f: Festival, today: Date) => !runsOf(f).length || !!nextRun(f, today);

/** What there is to know about an artist right now: each festival still to come they play, and their set time there. */
export function newsFor(artistId: string, festivals: Festival[], today: Date): News[] {
  const out: News[] = [];
  for (const f of festivals) {
    if (!f.lineup.includes(artistId) || !upcoming(f, today)) continue;
    out.push({ key: `plays:${f.id}`, festival: f, kind: 'joined' });
    const set = setFor(f, artistId);
    if (set) out.push({ key: `set:${f.id}:${set.day}:${set.start}:${set.stageId}`, festival: f, kind: 'setTime' });
  }
  return out;
}

/** Follow an artist, remembering what's already known about them. Same object when already followed. */
export function follow(all: Follows, artistId: string, festivals: Festival[], today: Date): Follows {
  if (all[artistId]) return all;
  return { ...all, [artistId]: newsFor(artistId, festivals, today).map((n) => n.key) };
}

export function unfollow(all: Follows, artistId: string): Follows {
  if (!all[artistId]) return all;
  const next = { ...all };
  delete next[artistId];
  return next;
}

/** Keep only well-formed follows, e.g. when reading them back from storage. */
export function cleanFollows(raw: unknown): Follows {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Follows = {};
  for (const [id, known] of Object.entries(raw)) {
    if (!id || !Array.isArray(known)) continue;
    out[id] = known.filter((k): k is string => typeof k === 'string');
  }
  return out;
}

/**
 * The bell's news about artists you follow, newest-feeling first (soonest
 * festival first): "ILLENIUM joins EDC Orlando 2026", "Set time for ILLENIUM
 * at Solstice 2026". Ids are stable, so read stays read.
 */
export function followNotices(follows: Follows, artists: Artist[], festivals: Festival[], today: Date): Notice[] {
  const byId = new Map(artists.map((a) => [a.id, a]));
  const list: { notice: Notice; until: number }[] = [];
  for (const [artistId, known] of Object.entries(follows)) {
    const artist = byId.get(artistId);
    if (!artist) continue;
    const seen = new Set(known);
    for (const n of newsFor(artistId, festivals, today)) {
      if (seen.has(n.key)) continue;
      const f = n.festival;
      const set = n.kind === 'setTime' ? setFor(f, artistId) : undefined;
      list.push({
        until: daysUntil(f, today) ?? Number.MAX_SAFE_INTEGER,
        notice:
          set
            ? {
                id: `follow:${artistId}:${n.key}`,
                festivalId: f.id,
                artistId,
                kind: 'followSet',
                title: `Set time for ${artist.name} at ${f.name}`,
                body: describeSet(f, set),
              }
            : {
                id: `follow:${artistId}:${n.key}`,
                festivalId: f.id,
                artistId,
                kind: 'followJoined',
                title: `${artist.name} joins ${f.name}`,
                body: f.dates ? `Playing ${f.dates}.` : 'See where they sit on the lineup.',
              },
      });
    }
  }
  return list.sort((a, b) => a.until - b.until).map((x) => x.notice);
}

/**
 * Where you can catch an artist next: the soonest festival still to come
 * that they play (dated ones first, in date order; undated ones after, in
 * catalogue order). Undefined when they're on no upcoming lineup.
 */
export function nextFestival(artistId: string, festivals: Festival[], today: Date): Festival | undefined {
  let best: { f: Festival; until: number } | undefined;
  for (const f of festivals) {
    if (!f.lineup.includes(artistId) || !upcoming(f, today)) continue;
    const until = nextRun(f, today)?.until ?? Number.MAX_SAFE_INTEGER;
    if (!best || until < best.until) best = { f, until };
  }
  return best?.f;
}

/**
 * Who you follow on a lineup, in a few words: "ILLENIUM, who you follow",
 * "ILLENIUM and SUBTRONICS, who you follow", "ILLENIUM and 2 more you
 * follow". Names in lineup order. Undefined when no one.
 */
export function followingLine(festival: Festival, followed: readonly string[], nameOf: (id: string) => string | undefined) {
  const mine = new Set(followed);
  const names = festival.lineup.filter((id) => mine.has(id)).map(nameOf).filter((n): n is string => !!n);
  if (!names.length) return undefined;
  if (names.length === 1) return `${names[0]}, who you follow`;
  if (names.length === 2) return `${names[0]} and ${names[1]}, who you follow`;
  return `${names[0]} and ${names.length - 1} more you follow`;
}
