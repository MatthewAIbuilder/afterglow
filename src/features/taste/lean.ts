import { SOUND_TAGS, type Artist, type SoundTag, type TasteProfile } from '../../data/models';

/**
 * Which sounds your taste leans towards, for a line of plain words on My
 * Sound. Pure. Each artist the engine knows about pulls towards their sounds
 * by how far their match sits above neutral (50%); artists at or below
 * neutral pull nothing. The strongest sound always shows, and a second one
 * only when it carries at least `SECOND_SHARE` of the pull.
 */
export const SECOND_SHARE = 0.25;

export function soundLean(artists: Artist[], taste: TasteProfile, informed: Record<string, boolean>): SoundTag[] {
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
  if (!total) return [];
  const ranked = SOUND_TAGS.filter((t) => pull[t]).sort((x, y) => (pull[y] ?? 0) - (pull[x] ?? 0));
  return ranked.slice(0, 2).filter((t, i) => i === 0 || (pull[t] ?? 0) / total >= SECOND_SHARE);
}
