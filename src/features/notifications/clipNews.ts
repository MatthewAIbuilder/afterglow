import type { Clip } from '../../data/models';
import type { Notice } from './inbox';

/**
 * New sets news: when a catalogue update brings new clips (the nightly
 * YouTube clips, or a hand-made catalogue), the bell says so for the artists
 * you'd love, and tapping it plays the first one in Discover. Worked out on
 * the phone by remembering every clip id seen. Pure.
 *
 * Like lineup news, the first look only takes note, and a clip is announced
 * once: the memory keeps up to CLIP_SEEN_MAX ids, oldest dropped first.
 */
export type ClipNewsItem = {
  /** Clips that arrived together, in catalogue order. */
  clips: string[];
  /** When they were noticed (ms). */
  at: number;
};

export type ClipMemory = {
  /** Every clip id seen, oldest first. */
  seen: string[];
  /** What arrived lately, newest last. */
  news: ClipNewsItem[];
};

export const EMPTY_CLIP_MEMORY: ClipMemory = { seen: [], news: [] };

/** New sets stay news this long. */
export const CLIP_NEWS_DAYS = 14;
/** At most this many arrivals are kept. */
export const CLIP_NEWS_MAX = 30;
/** At most this many clip ids are remembered. */
export const CLIP_SEEN_MAX = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Only official clips count: community videos come and go and are never news. */
const isCatalogueClip = (c: Clip) => !c.id.startsWith('community:');

/**
 * The memory after seeing these clips now. Returns the same object when
 * nothing changed (so nothing needs saving).
 */
export function trackClips(memory: ClipMemory, clips: Clip[], now: number): ClipMemory {
  const firstLook = memory.seen.length === 0;
  const had = new Set(memory.seen);
  const fresh: string[] = [];
  for (const c of clips) {
    if (!isCatalogueClip(c) || had.has(c.id)) continue;
    had.add(c.id);
    fresh.push(c.id);
  }
  const kept = memory.news.filter((n) => now - n.at < CLIP_NEWS_DAYS * DAY_MS);
  if (!fresh.length && kept.length === memory.news.length) return memory;
  const seen = fresh.length ? [...memory.seen, ...fresh].slice(-CLIP_SEEN_MAX) : memory.seen;
  const news = !firstLook && fresh.length ? [...kept, { clips: fresh, at: now }] : kept;
  return { seen, news: news.slice(-CLIP_NEWS_MAX) };
}

const names = (list: string[]) => (list.length === 1 ? list[0] : list.length === 2 ? `${list[0]} and ${list[1]}` : `${list[0]}, ${list[1]} and ${list.length - 2} more you’d love`);

/**
 * The bell's new sets: per arrival, newest first, the clips still in the
 * catalogue of artists you'd love that you haven't had on screen yet (one
 * name per artist). Opens Discover on the first of them.
 */
export function clipNotices(
  news: ClipNewsItem[],
  opts: {
    clip: (id: string) => Clip | undefined;
    loves: (artistId: string) => boolean;
    nameOf: (artistId: string) => string | undefined;
    /** Clips already on screen in Discover: nothing new about those. */
    watched: (clipId: string) => boolean;
  },
): Notice[] {
  const out: Notice[] = [];
  for (const n of [...news].reverse()) {
    const clips = n.clips.map(opts.clip).filter((c): c is Clip => !!c && opts.loves(c.artistId) && !opts.watched(c.id));
    const artists = [...new Set(clips.map((c) => c.artistId))];
    const named = artists.map(opts.nameOf).filter((x): x is string => !!x);
    if (!named.length) continue;
    const many = clips.length > 1;
    out.push({
      id: `clips:${n.at}`,
      kind: 'clips',
      href: `/?clip=${encodeURIComponent(clips[0].id)}`,
      title: `${many ? 'New live sets' : 'A new live set'} from ${names(named)}`,
      body: many ? 'Watch them in Discover.' : 'Watch it in Discover.',
    });
  }
  return out;
}

/** A saved memory read back safely: anything malformed is dropped. */
export function cleanClipMemory(raw: unknown): ClipMemory {
  if (!raw || typeof raw !== 'object') return EMPTY_CLIP_MEMORY;
  const o = raw as { seen?: unknown; news?: unknown };
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const news = Array.isArray(o.news)
    ? o.news.flatMap((n): ClipNewsItem[] => {
        if (!n || typeof n !== 'object') return [];
        const x = n as Record<string, unknown>;
        if (typeof x.at !== 'number') return [];
        const clips = strs(x.clips);
        return clips.length ? [{ clips, at: x.at }] : [];
      })
    : [];
  return { seen: strs(o.seen).slice(-CLIP_SEEN_MAX), news: news.slice(-CLIP_NEWS_MAX) };
}
