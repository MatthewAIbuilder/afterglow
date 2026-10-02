import type { Artist, Clip, SoundTag } from '../../data/models';

/**
 * This or that, pure: a quick start for a new taste. Two live sets side by
 * side, you tap the one you'd rather hear, about eight times. Each pick is a
 * like on that clip, so it counts exactly like a like in Discover (spill-over
 * to similar sounds included) and My Sound takes shape within a minute.
 *
 * Pairs set two different sounds against each other while it can, so the
 * rounds cover your range instead of splitting hairs inside one sound.
 */

/** Rounds in a game. */
export const ROUNDS = 8;
/** Fewer pairs than this and the game isn't worth offering. */
export const ROUNDS_MIN = 3;

export type Pair = { a: Clip; b: Clip };
export type Answer = 'a' | 'b' | 'both' | 'neither';

/** An artist's strongest sound, if they have any tags. */
export function topSound(artist: Pick<Artist, 'sound'> | undefined): SoundTag | undefined {
  if (!artist) return undefined;
  let best: SoundTag | undefined;
  let weight = 0;
  for (const [tag, w] of Object.entries(artist.sound ?? {}) as [SoundTag, number][]) {
    if (w > weight) {
      best = tag;
      weight = w;
    }
  }
  return best;
}

/**
 * The game's pairs. One YouTube clip per artist with sound tags, never an
 * artist you've already rated or reacted to (`skip`); artists on the
 * festivals you chose come first, then the rest, each in catalogue order.
 * Each round takes the next artist from two different sounds, turning
 * through the sounds so every one gets a say. Deterministic.
 */
export function thisOrThatPairs(
  clips: readonly Clip[],
  artist: (id: string) => Artist | undefined,
  { prefer = [], skip = new Set<string>(), rounds = ROUNDS }: { prefer?: readonly string[]; skip?: ReadonlySet<string>; rounds?: number } = {},
): Pair[] {
  const picked = new Map<string, Clip>();
  const preferred = (c: Clip) => prefer.includes(c.festivalId);
  const ordered = [...clips.filter(preferred), ...clips.filter((c) => !preferred(c))];
  for (const c of ordered) {
    if (picked.has(c.artistId) || skip.has(c.artistId) || c.source?.provider !== 'youtube') continue;
    if (!topSound(artist(c.artistId))) continue;
    picked.set(c.artistId, c);
  }

  // A queue per sound, the sounds with the most artists first.
  const bySound = new Map<SoundTag, Clip[]>();
  for (const c of picked.values()) {
    const s = topSound(artist(c.artistId))!;
    bySound.set(s, [...(bySound.get(s) ?? []), c]);
  }
  const sounds = [...bySound.keys()].sort((x, y) => bySound.get(y)!.length - bySound.get(x)!.length);

  const pairs: Pair[] = [];
  let turn = 0;
  while (pairs.length < rounds) {
    const left = sounds.filter((s) => bySound.get(s)!.length);
    if (!left.length) break;
    if (left.length === 1) {
      const q = bySound.get(left[0])!;
      if (q.length < 2) break;
      pairs.push({ a: q.shift()!, b: q.shift()! });
      continue;
    }
    const first = left[turn % left.length];
    const second = left[(turn + 1) % left.length];
    pairs.push({ a: bySound.get(first)!.shift()!, b: bySound.get(second)!.shift()! });
    turn += 2;
  }
  return pairs;
}

/** The clips an answer likes. Preferring one set is no verdict on the other, so nothing is skipped. */
export function likedBy(answer: Answer, pair: Pair): string[] {
  if (answer === 'a') return [pair.a.id];
  if (answer === 'b') return [pair.b.id];
  if (answer === 'both') return [pair.a.id, pair.b.id];
  return [];
}

/** "Round 3 of 8". */
export const roundLine = (index: number, total: number) => `Round ${index + 1} of ${total}`;

/** How the game went, for its last screen: "You picked 6 sets." */
export function pickedLine(liked: number): string {
  if (!liked) return 'Nothing caught your ear this time.';
  return liked === 1 ? 'You picked 1 set.' : `You picked ${liked} sets.`;
}
