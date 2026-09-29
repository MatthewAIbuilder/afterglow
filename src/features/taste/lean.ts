import { SOUND_TAGS, type Artist, type SoundTag, type TasteProfile } from '../../data/models';

/**
 * Which sounds your taste leans towards, for a line of plain words on My
 * Sound. Pure. Each artist the engine knows about pulls towards their sounds
 * by how far their match sits above neutral (50%); artists at or below
 * neutral pull nothing. The strongest sound always shows, and a second one
 * only when it carries at least `SECOND_SHARE` of the pull.
 */
export const SECOND_SHARE = 0.25;

/** How strongly your taste pulls towards each sound (see above), and the total. */
function soundPull(artists: Artist[], taste: TasteProfile, informed: Record<string, boolean>) {
  const pull: Partial<Record<SoundTag, number>> = {};
  let total = 0;
  for (const a of artists) {
    if (!informed[a.id]) continue;
    const w = Math.max(0, (taste[a.id] ?? 0) - 0.5);
    if (!w) continue;
    for (const [tag, amount] of Object.entries(a.sound) as [SoundTag, number][]) {
      pull[tag] = (pull[tag] ?? 0) + w * amount;
      total += w * amount;
    }
  }
  return { pull, total };
}

export function soundLean(artists: Artist[], taste: TasteProfile, informed: Record<string, boolean>): SoundTag[] {
  const { pull, total } = soundPull(artists, taste, informed);
  if (!total) return [];
  const ranked = SOUND_TAGS.filter((t) => pull[t]).sort((x, y) => (pull[y] ?? 0) - (pull[x] ?? 0));
  return ranked.slice(0, 2).filter((t, i) => i === 0 || (pull[t] ?? 0) / total >= SECOND_SHARE);
}

/** One sound's part of a mix: `share` 0 to 1, `percent` rounded so a mix adds up to exactly 100. */
export type SoundShare = { tag: SoundTag; share: number; percent: number };

/**
 * Weights per sound as a mix: largest first (ties in the usual sound order),
 * whole percentages that add up to 100 (largest remainder), sounds that round
 * to nothing left out. Empty when there's nothing to share out.
 */
export function toShares(weights: Partial<Record<SoundTag, number>>): SoundShare[] {
  const tags = SOUND_TAGS.filter((t) => (weights[t] ?? 0) > 0);
  const total = tags.reduce((sum, t) => sum + (weights[t] ?? 0), 0);
  if (!total) return [];
  const exact = tags.map((tag) => ({ tag, share: (weights[tag] ?? 0) / total }));
  const floors = exact.map((e) => Math.floor(e.share * 100));
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const byRemainder = exact.map((e, i) => i).sort((i, j) => exact[j].share * 100 - floors[j] - (exact[i].share * 100 - floors[i]) || i - j);
  for (const i of byRemainder) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return exact
    .map((e, i) => ({ ...e, percent: floors[i] }))
    .filter((e) => e.percent > 0)
    .sort((x, y) => y.share - x.share || SOUND_TAGS.indexOf(x.tag) - SOUND_TAGS.indexOf(y.tag));
}

/** Your taste as a mix of sounds: the same pull that says what you're leaning towards. */
export function tasteMix(artists: Artist[], taste: TasteProfile, informed: Record<string, boolean>): SoundShare[] {
  return toShares(soundPull(artists, taste, informed).pull);
}

/** An artist's sound as a mix, e.g. 80% melodic bass, 20% dubstep. Empty when their sound isn't known. */
export const artistMix = (artist: Artist): SoundShare[] => toShares(artist.sound);
