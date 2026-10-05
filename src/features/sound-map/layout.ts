import type { Artist, SoundTag, TasteProfile } from '../../data/types';
import { soundSimilarity } from '../taste/similarity';

/**
 * Pure layout for the My Sound map. No React, so it is easy to test and
 * later to move server-side.
 *
 * 1. Your strongest match is pinned at the centre.
 * 2. Every other artist joins the group of their main sound. Each group is a
 *    cluster round you, in ring order (each sound owns a compass point;
 *    neighbouring sounds sit next to each other), in a wedge sized by how
 *    many artists it holds; inside, the strongest matches sit at the heart
 *    and the rest spiral out like a sunflower.
 * 3. A relaxation pass pushes artists apart, treating each one as its bubble
 *    plus its name label, so nothing overlaps, with a wider channel between
 *    different sounds so each group reads on its own.
 */

/**
 * Where each sound sits around the ring, in sixths of a turn from the top.
 * The six electronic sounds keep their original evenly spaced places; the
 * wider sounds sit in the gaps next to their closest neighbours (pop between
 * house and melodic bass, with indie and rock either side; hip-hop by trap).
 */
const RING_PLACE: Record<SoundTag, number> = {
  'melodic-bass': 0,
  rock: 0.5,
  dubstep: 1,
  riddim: 2,
  trap: 3,
  'hip-hop': 3.5,
  techno: 4,
  indie: 4.5,
  house: 5,
  pop: 5.5,
};
const MIN_R = 30;
export const MAX_R = 78;
const GAP = 22;
/** Extra room between artists of different sounds (the channels between groups). */
const GROUP_SPACE = 30;
/** The golden angle: a sunflower's spiral, so a cluster packs evenly round its heart. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
export const LABEL_OFFSET = 8; // space between bubble and name
/** Two sound names closer than this (across, down) would print over each other. */
const REGION_GAP = { x: 72, y: 22 };
const LABEL_H = 32; // name + percentage

export type PlacedArtist = {
  artist: Artist;
  affinity: number;
  x: number;
  y: number;
  r: number;
};

export type RegionLabel = { tag: SoundTag; x: number; y: number };

export type MapLayout = {
  bubbles: PlacedArtist[];
  regions: RegionLabel[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
};

/** Half the tappable box around a sound name (a label is drawn 120 wide, about 16 tall). */
export const REGION_HIT = { x: 60, y: 14 } as const;

/** The sound name at a point in layout coordinates, if any (nearest first). */
export function regionAt(regions: readonly RegionLabel[], x: number, y: number): SoundTag | undefined {
  return regions
    .filter((r) => Math.abs(x - r.x) <= REGION_HIT.x && Math.abs(y - r.y) <= REGION_HIT.y)
    .sort((a, b) => Math.hypot(x - a.x, y - a.y) - Math.hypot(x - b.x, y - b.y))[0]?.tag;
}

const angleOf = (tag: SoundTag) => (RING_PLACE[tag] / 6) * Math.PI * 2 - Math.PI / 2;

/** Artists with no sound yet share one group. */
const NO_TAG = 'none';
const mainTag = (artist: Artist): string => {
  const strongest = (Object.entries(artist.sound) as [SoundTag, number][]).filter(([, w]) => w > 0).sort((p, q) => q[1] - p[1])[0];
  return strongest && strongest[0] in RING_PLACE ? strongest[0] : NO_TAG;
};
const norm = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
const circularMean = (angles: number[]) => Math.atan2(angles.reduce((s, a) => s + Math.sin(a), 0), angles.reduce((s, a) => s + Math.cos(a), 0));

export const bubbleRadius = (affinity: number) => {
  const t = Math.min(1, Math.max(0, (affinity - 0.3) / 0.7));
  return MIN_R + (MAX_R - MIN_R) * Math.pow(t, 1.6);
};

/** Rough width of the uppercase name label, used for spacing. */
const labelWidth = (name: string, r: number) => Math.max(name.length * (r < 40 ? 7.2 : 8.4) + 10, 44);

/** Direction of an artist's sound, as a unit vector. */
function soundDirection(artist: Artist) {
  let x = 0;
  let y = 0;
  for (const [tag, w] of Object.entries(artist.sound) as [SoundTag, number][]) {
    x += Math.cos(angleOf(tag)) * w;
    y += Math.sin(angleOf(tag)) * w;
  }
  const len = Math.hypot(x, y);
  return len > 0.001 ? { x: x / len, y: y / len } : { x: 0, y: 1 };
}

type Part = { dx: number; dy: number; r: number };
type Node = PlacedArtist & { hx: number; hy: number; pinned: boolean; parts: Part[]; tag?: string };

/** A bubble plus two circles covering its label: a cheap but honest footprint. */
function footprint(name: string, r: number): Part[] {
  const w = labelWidth(name, r);
  const ly = r + LABEL_OFFSET + LABEL_H / 2;
  const lr = Math.max(LABEL_H / 2, w / 4);
  return [
    { dx: 0, dy: 0, r },
    { dx: -w / 4, dy: ly, r: lr },
    { dx: w / 4, dy: ly, r: lr },
  ];
}

/** The strongest matches that get a full label, and that the map's first view frames. */
export const FULL_LABELS = 12;

/**
 * The zoom that frames the map's heart: your strongest `core` matches, with
 * room for their labels, keeping your top match dead centre (the map opens
 * centred on it). Never below `min`, so bubbles stay readable; the rest of
 * a big map is a swipe away. Pure.
 */
export function fitScale(
  layout: MapLayout,
  width: number,
  height: number,
  { core = FULL_LABELS, min = 0.5, max = 1.1 }: { core?: number; min?: number; max?: number } = {},
): number {
  const heart = [...layout.bubbles].sort((a, b) => b.affinity - a.affinity).slice(0, core);
  if (!heart.length) return max;
  const halfW = Math.max(1, ...heart.map((b) => Math.abs(b.x) + b.r));
  const halfH = Math.max(1, ...heart.map((b) => Math.max(Math.abs(b.y - b.r), Math.abs(b.y + b.r + LABEL_OFFSET + LABEL_H))));
  const s = Math.min((width / 2 - 12) / halfW, (height / 2 - 12) / halfH);
  return Math.min(max, Math.max(min, s));
}

/** Most bubbles on the map at once: enough to feel like a universe, few enough to stay calm and fast. */
export const MAP_MAX = 40;

/**
 * Who is on the map: artists the app knows something about (a starting
 * prediction, or signal from what you did, including spill-over from similar
 * sounds), best matches first, at most MAP_MAX. Everyone on a big lineup the
 * app knows nothing about yet stays off until your reactions reach them, so
 * the map grows as it learns. Pure.
 */
export function artistsOnMap(
  artists: Artist[],
  taste: TasteProfile,
  informed: Record<string, boolean>,
  max = MAP_MAX,
): Artist[] {
  return artists
    .filter((a) => informed[a.id])
    .sort((a, b) => (taste[b.id] ?? 0) - (taste[a.id] ?? 0))
    .slice(0, max);
}

export function computeLayout(artists: Artist[], taste: TasteProfile): MapLayout {
  const ranked = [...artists]
    .map((artist) => ({ artist, affinity: taste[artist.id] ?? 0 }))
    .sort((a, b) => b.affinity - a.affinity);
  if (ranked.length === 0) return { bubbles: [], regions: [], bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };

  const top = ranked[0];
  const topR = bubbleRadius(top.affinity);

  // Everyone but the centre is grouped by their main sound. Each sound is a cluster of its
  // own (its strongest artists at its heart, the rest spiralling out like a sunflower), and
  // the clusters sit round you in ring order, each in a wedge sized by how many it holds,
  // with room between them, so the map reads as a few clear constellations of sound.
  const others = ranked.slice(1).map((o) => {
    const d = soundDirection(o.artist);
    return { ...o, angle: Math.atan2(d.y, d.x), tag: mainTag(o.artist), r: bubbleRadius(o.affinity) };
  });
  const groupsOf = new Map<string, typeof others>();
  for (const o of others) groupsOf.set(o.tag, [...(groupsOf.get(o.tag) ?? []), o]);
  const ordered = [...groupsOf.entries()]
    .map(([tag, list]) => ({ tag, list: [...list].sort((p, q) => q.affinity - p.affinity), at: tag === NO_TAG ? circularMean(list.map((o) => o.angle)) : angleOf(tag as SoundTag) }))
    .sort((p, q) => norm(p.at) - norm(q.at));
  const home = new Map<string, { x: number; y: number }>();
  if (others.length) {
    // Wedges by count, then the whole ring turned so each sits near its sound's true place.
    const per = (Math.PI * 2) / others.length;
    let cursor = 0;
    const wedges = ordered.map((g) => {
      const centre = cursor + (per * g.list.length) / 2;
      cursor += per * g.list.length;
      return centre;
    });
    let sx = 0;
    let sy = 0;
    ordered.forEach((g, i) => {
      sx += Math.cos(g.at - wedges[i]) * g.list.length;
      sy += Math.sin(g.at - wedges[i]) * g.list.length;
    });
    const turn = ordered.length > 1 ? Math.atan2(sy, sx) : ordered[0].at - wedges[0];
    ordered.forEach((g, i) => {
      // How much room the cluster needs, roughly: the area of its bubbles (and their labels).
      const size = Math.sqrt(g.list.reduce((sum, o) => sum + (o.r + GAP) * (o.r + GAP + LABEL_H * 0.6), 0));
      const angle = wedges[i] + turn;
      const dist = topR + GAP * 4 + size * 1.25;
      const cx = Math.cos(angle) * dist;
      const cy = Math.sin(angle) * dist;
      const step = g.list.reduce((sum, o) => sum + o.r, 0) / g.list.length + GAP;
      g.list.forEach((o, k) => {
        // A sunflower spiral round the cluster's heart: strongest first, at the middle.
        const rho = step * 1.1 * Math.sqrt(k);
        const theta = angle + k * GOLDEN;
        home.set(o.artist.id, { x: cx + Math.cos(theta) * rho, y: cy + Math.sin(theta) * rho });
      });
    });
  }

  const nodes: Node[] = ranked.map(({ artist, affinity }, i) => {
    const r = bubbleRadius(affinity);
    const parts = footprint(artist.name, r);
    if (i === 0) return { artist, affinity, r, x: 0, y: 0, hx: 0, hy: 0, pinned: true, parts };
    const h = home.get(artist.id) ?? { x: 0, y: topR + r + GAP };
    return { artist, affinity, r, x: h.x, y: h.y, hx: h.x, hy: h.y, pinned: false, parts, tag: mainTag(artist) };
  });

  for (let step = 0; step < 400; step++) {
    for (const n of nodes) {
      if (n.pinned) continue;
      n.x += (n.hx - n.x) * 0.04;
      n.y += (n.hy - n.y) * 0.04;
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        for (const pa of a.parts) {
          for (const pb of b.parts) {
            let dx = b.x + pb.dx - (a.x + pa.dx);
            let dy = b.y + pb.dy - (a.y + pa.dy);
            let d = Math.hypot(dx, dy);
            if (d < 0.001) {
              dx = Math.cos(i * 7 + j);
              dy = Math.sin(i * 7 + j);
              d = 1;
            }
            // Two different sounds keep a wider channel between them, so each group reads on its own.
            const min = pa.r + pb.r + GAP + (a.tag && b.tag && a.tag !== b.tag ? GROUP_SPACE : 0);
            if (d >= min) continue;
            const push = min - d;
            const ux = dx / d;
            const uy = dy / d;
            // The pinned centre never moves; otherwise bigger bubbles move less.
            const wa = a.pinned ? 0 : b.pinned ? 1 : b.r / (a.r + b.r);
            const wb = 1 - wa;
            a.x -= ux * push * wa;
            a.y -= uy * push * wa;
            b.x += ux * push * wb;
            b.y += uy * push * wb;
          }
        }
      }
    }
  }

  const bubbles = nodes.map(({ artist, affinity, x, y, r }) => ({ artist, affinity, x, y, r }));

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let reach = 0;
  for (const n of nodes) {
    for (const p of n.parts) {
      minX = Math.min(minX, n.x + p.dx - p.r);
      maxX = Math.max(maxX, n.x + p.dx + p.r);
      minY = Math.min(minY, n.y + p.dy - p.r);
      maxY = Math.max(maxY, n.y + p.dy + p.r);
      reach = Math.max(reach, Math.hypot(n.x + p.dx, n.y + p.dy) + p.r);
    }
  }

  // Faint region names sit just outside the constellation, in the direction
  // of the artists they describe.
  const groups = new Map<SoundTag, { x: number; y: number }>();
  for (const node of nodes) {
    if (node.pinned) continue; // the centre is you, not a region
    const strongest = (Object.entries(node.artist.sound) as [SoundTag, number][]).sort((p, q) => q[1] - p[1])[0];
    if (!strongest) continue;
    const tag = strongest[0];
    const len = Math.hypot(node.x, node.y);
    const dir = len > 1 ? { x: node.x / len, y: node.y / len } : { x: Math.cos(angleOf(tag)), y: Math.sin(angleOf(tag)) };
    const g = groups.get(tag) ?? { x: 0, y: 0 };
    groups.set(tag, { x: g.x + dir.x, y: g.y + dir.y });
  }
  // Strongest regions first (most artists pulling that way); a label that would sit on top of a
  // stronger one is left out, so neighbouring sounds never print over each other.
  const placed = [...groups.entries()]
    .map(([tag, g]) => ({ tag, a: Math.atan2(g.y, g.x), weight: Math.hypot(g.x, g.y) }))
    .sort((p, q) => q.weight - p.weight);
  const kept: RegionLabel[] = [];
  for (const { tag, a } of placed) {
    // Just beyond that sound's own group (not the whole map), so the name sits by its artists.
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    let own = 0;
    for (const node of nodes) {
      if (node.pinned || mainTag(node.artist) !== tag) continue;
      for (const p of node.parts) own = Math.max(own, (node.x + p.dx) * ux + (node.y + p.dy) * uy + p.r);
    }
    const out = (own || reach) + 26;
    const x = ux * out;
    const y = uy * out;
    if (kept.some((r) => Math.abs(r.x - x) < REGION_GAP.x && Math.abs(r.y - y) < REGION_GAP.y)) continue;
    kept.push({ tag, x, y });
  }
  // In the order the map meets them, as before.
  const regions = [...groups.keys()].flatMap((tag) => kept.filter((r) => r.tag === tag));

  return { bubbles, regions, bounds: { minX, maxX, minY, maxY } };
}

/** Cosine similarity of sound profiles. Lives in taste/similarity; re-exported so existing imports keep working. */
export { soundSimilarity };

/**
 * Who the map can draw from: everyone, or one festival's lineup (in the
 * catalogue's artist order; the map ranks them itself).
 */
export function mapCandidates(artists: Artist[], lineup?: readonly string[]): Artist[] {
  if (!lineup) return artists;
  const on = new Set(lineup);
  return artists.filter((a) => on.has(a.id));
}

/** Below this many artists, a festival's map is too sparse to say much, so the screen offers a way to add more. */
export const SPARSE_MAP = 5;
