import type { Artist, SoundTag, TasteProfile } from '../../data/types';
import { soundSimilarity } from '../taste/similarity';

/**
 * Pure layout for the My Sound map. No React, so it is easy to test and
 * later to move server-side.
 *
 * 1. Your strongest match is pinned at the centre.
 * 2. Every other artist gets a direction from its sound (each sound tag owns
 *    a compass point; neighbouring sounds sit next to each other). Directions
 *    are then eased toward an even spread, keeping their order, so the map
 *    stays balanced around you. Weaker matches drift further out.
 * 3. A relaxation pass pushes artists apart, treating each one as its bubble
 *    plus its name label, so nothing overlaps.
 */

const RING_ORDER: SoundTag[] = ['melodic-bass', 'dubstep', 'riddim', 'trap', 'techno', 'house'];
const MIN_R = 30;
export const MAX_R = 78;
const GAP = 16;
const SPREAD = 110; // extra distance for the weakest match
const EVENNESS = 0.75; // 0 = true sound angles, 1 = perfectly even ring
export const LABEL_OFFSET = 8; // space between bubble and name
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

const angleOf = (tag: SoundTag) => (RING_ORDER.indexOf(tag) / RING_ORDER.length) * Math.PI * 2 - Math.PI / 2;

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
type Node = PlacedArtist & { hx: number; hy: number; pinned: boolean; parts: Part[] };

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
  const lowest = ranked[ranked.length - 1].affinity;
  const range = Math.max(0.01, top.affinity - lowest);

  // Sound angle for everyone but the centre, then ease toward an even ring.
  const others = ranked.slice(1).map((o) => {
    const d = soundDirection(o.artist);
    return { ...o, angle: Math.atan2(d.y, d.x) };
  });
  const byAngle = [...others].sort((a, b) => a.angle - b.angle);
  const n = byAngle.length;
  const assigned = new Map<string, number>();
  if (n > 0) {
    // Start the even ring at the average offset so the rotation stays close to the true sounds.
    let offset = 0;
    byAngle.forEach((o, i) => {
      const even = (i / n) * Math.PI * 2;
      offset += Math.atan2(Math.sin(o.angle - even), Math.cos(o.angle - even));
    });
    offset /= n;
    byAngle.forEach((o, i) => {
      const even = (i / n) * Math.PI * 2 + offset;
      const diff = Math.atan2(Math.sin(even - o.angle), Math.cos(even - o.angle));
      assigned.set(o.artist.id, o.angle + diff * EVENNESS);
    });
  }

  const nodes: Node[] = ranked.map(({ artist, affinity }, i) => {
    const r = bubbleRadius(affinity);
    const parts = footprint(artist.name, r);
    if (i === 0) return { artist, affinity, r, x: 0, y: 0, hx: 0, hy: 0, pinned: true, parts };
    const a = assigned.get(artist.id) ?? 0;
    const dist = topR + r + GAP * 2 + ((top.affinity - affinity) / range) * SPREAD;
    const hx = Math.cos(a) * dist;
    const hy = Math.sin(a) * dist;
    return { artist, affinity, r, x: hx, y: hy, hx, hy, pinned: false, parts };
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
            const min = pa.r + pb.r + GAP;
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
  const regions = [...groups.entries()].map(([tag, g]) => {
    const a = Math.atan2(g.y, g.x);
    return { tag, x: Math.cos(a) * (reach + 22), y: Math.sin(a) * (reach + 22) };
  });

  return { bubbles, regions, bounds: { minX, maxX, minY, maxY } };
}

/** Cosine similarity of sound profiles. Lives in taste/similarity; re-exported so existing imports keep working. */
export { soundSimilarity };
