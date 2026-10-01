import type { Artist, SoundTag } from '../../data/models';
import { SOUND_COLOR } from './colors';
import type { MapLayout, PlacedArtist } from './layout';

/**
 * What surrounds the bubbles on My Sound, worked out from the layout: a
 * nebula of colour behind each sound's artists, constellation lines between
 * artists who sound alike, and a field of stars far behind. Pure, so the
 * sky is the same every time for the same map.
 */

export type Nebula = { tag: SoundTag; color: string; x: number; y: number; r: number; weight: number };

/** Most nebulae drawn at once: the strongest sounds on the map. */
export const NEBULA_MAX = 6;
const NEBULA_MIN_R = 110;
const NEBULA_MAX_R = 300;

const mainSound = (a: Artist): SoundTag | undefined =>
  (Object.entries(a.sound) as [SoundTag, number][]).filter(([, w]) => w > 0).sort((p, q) => q[1] - p[1])[0]?.[0];

/**
 * A cloud of each sound's colour behind its artists: centred where they
 * gather (bigger bubbles pull harder), wide enough to hold them, brighter
 * the more of your map it holds. Strongest first.
 */
export function nebulae(layout: MapLayout, max = NEBULA_MAX): Nebula[] {
  const groups = new Map<SoundTag, PlacedArtist[]>();
  for (const b of layout.bubbles) {
    const tag = mainSound(b.artist);
    if (!tag) continue;
    groups.set(tag, [...(groups.get(tag) ?? []), b]);
  }
  const total = layout.bubbles.length || 1;
  return [...groups.entries()]
    .map(([tag, list]) => {
      const mass = list.reduce((s, b) => s + b.r * b.affinity, 0) || 1;
      const x = list.reduce((s, b) => s + b.x * b.r * b.affinity, 0) / mass;
      const y = list.reduce((s, b) => s + b.y * b.r * b.affinity, 0) / mass;
      const spread = Math.max(...list.map((b) => Math.hypot(b.x - x, b.y - y) + b.r));
      return {
        tag,
        color: SOUND_COLOR[tag],
        x,
        y,
        r: Math.min(NEBULA_MAX_R, Math.max(NEBULA_MIN_R, spread * 1.15)),
        weight: list.reduce((s, b) => s + b.affinity, 0) / total,
      };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, max);
}

export type Link = { a: string; b: string; x1: number; y1: number; x2: number; y2: number; strength: number };

/** How alike two artists must be to be joined. */
export const LINK_MIN = 0.6;
/** Lines from each artist, to the ones most like them. */
export const LINKS_PER = 2;
/** Longer than this and a line would cut across the whole map. */
export const LINK_REACH = 280;
/** Only your strongest matches form the constellation; everyone else is joined only when chosen. */
export const CONSTELLATION_OF = 12;
/** A chosen artist is joined to this many artists most like them. */
export const CHOSEN_LINKS = 3;

/** The lines from one chosen artist to the artists on the map most like them (at least half alike), wherever they are. */
export function chosenLinks(
  bubbles: readonly PlacedArtist[],
  id: string,
  similarity: (a: Artist, b: Artist) => number,
  max = CHOSEN_LINKS,
): Link[] {
  const p = bubbles.find((b) => b.artist.id === id);
  if (!p) return [];
  return bubbles
    .filter((q) => q !== p)
    .map((q) => ({ q, s: similarity(p.artist, q.artist) }))
    .filter((x) => x.s >= 0.5)
    .sort((x, y) => y.s - x.s || x.q.artist.id.localeCompare(y.q.artist.id))
    .slice(0, max)
    .map(({ q, s }) => ({ a: p.artist.id, b: q.artist.id, x1: p.x, y1: p.y, x2: q.x, y2: q.y, strength: s }));
}

/**
 * Constellation lines: each artist joined to the (up to `LINKS_PER`) artists
 * on the map most like them, when they're at least `LINK_MIN` alike and near
 * enough to read as a group. Each pair once.
 */
export function constellation(
  bubbles: readonly PlacedArtist[],
  similarity: (a: Artist, b: Artist) => number,
  { min = LINK_MIN, per = LINKS_PER, reach = LINK_REACH } = {},
): Link[] {
  const seen = new Set<string>();
  const links: Link[] = [];
  for (const p of bubbles) {
    const near = bubbles
      .filter((q) => q !== p && Math.hypot(q.x - p.x, q.y - p.y) <= reach)
      .map((q) => ({ q, s: similarity(p.artist, q.artist) }))
      .filter((x) => x.s >= min)
      .sort((x, y) => y.s - x.s || x.q.artist.id.localeCompare(y.q.artist.id))
      .slice(0, per);
    for (const { q, s } of near) {
      const key = [p.artist.id, q.artist.id].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ a: p.artist.id, b: q.artist.id, x1: p.x, y1: p.y, x2: q.x, y2: q.y, strength: s });
    }
  }
  return links;
}

export type Star = { x: number; y: number; r: number; group: 0 | 1 | 2 };

/** A small seeded random, so the stars sit in the same places every time. */
function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/**
 * Stars spread over an area `width` × `height` around the centre, in three
 * groups that twinkle out of step. Mostly tiny, a few brighter.
 */
export function starfield(width: number, height: number, count = 90, seed = 7): Star[] {
  const rand = seeded(seed);
  return Array.from({ length: count }, (_, i) => {
    const big = rand() > 0.9;
    return {
      x: (rand() - 0.5) * width,
      y: (rand() - 0.5) * height,
      r: big ? 1.3 + rand() * 0.6 : 0.5 + rand() * 0.6,
      group: (i % 3) as 0 | 1 | 2,
    };
  });
}

/** The colours around your top match: your strongest sounds on the map, up to three (the app's glow when none). */
export function heartColors(skies: readonly Nebula[]): string[] {
  const c = skies.slice(0, 3).map((n) => n.color);
  return c.length ? c : [SOUND_COLOR['melodic-bass']];
}
