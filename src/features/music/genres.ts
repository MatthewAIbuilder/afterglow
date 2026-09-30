import type { SoundTag } from '../../data/models';

/**
 * Genre names from a music service, read as Afterglow's sounds. Pure.
 *
 * Only clear genres map to a sound. Broad labels ("electronic", "dance",
 * "edm") say too little to place anyone and are ignored rather than guessed.
 * Rules are checked in order, first match wins, so specific names ("melodic
 * dubstep") come before general ones ("dubstep").
 */
type Rule = { test: RegExp; sound: Partial<Record<SoundTag, number>> };

const RULES: Rule[] = [
  { test: /melodic (bass|dubstep)|future bass|chillstep/, sound: { 'melodic-bass': 1 } },
  { test: /riddim/, sound: { riddim: 1 } },
  { test: /dubstep|brostep|tearout|deathstep/, sound: { dubstep: 1 } },
  { test: /(edm|hybrid|festival|bass) trap|^trap edm$/, sound: { trap: 1 } },
  { test: /^trap$/, sound: { trap: 0.5, 'hip-hop': 0.5 } },
  { test: /techno/, sound: { techno: 1 } },
  { test: /house|big room/, sound: { house: 1 } },
  { test: /hip.?hop|\brap\b|drill|^trap /, sound: { 'hip-hop': 1 } },
  { test: /indie pop|bedroom pop/, sound: { indie: 1, pop: 0.5 } },
  { test: /indie|alternative$|^alternative\b(?! rock)/, sound: { indie: 1 } },
  { test: /rock|punk|metal|grunge|emo/, sound: { rock: 1 } },
  { test: /pop/, sound: { pop: 1 } },
];

/** One genre as sounds, or undefined when it doesn't clearly map. */
export function genreSound(genre: string): Partial<Record<SoundTag, number>> | undefined {
  const g = genre.trim().toLowerCase();
  return g ? RULES.find((r) => r.test.test(g))?.sound : undefined;
}

/**
 * An artist's genres as one sound profile, strongest sound = 1. Empty when
 * none of the genres map.
 */
export function genresToSound(genres: readonly string[]): Partial<Record<SoundTag, number>> {
  const sum: Partial<Record<SoundTag, number>> = {};
  for (const g of genres) {
    const s = genreSound(g);
    if (!s) continue;
    for (const [tag, w] of Object.entries(s) as [SoundTag, number][]) sum[tag] = (sum[tag] ?? 0) + w;
  }
  const max = Math.max(0, ...Object.values(sum).map((v) => v ?? 0));
  if (!max) return {};
  const out: Partial<Record<SoundTag, number>> = {};
  for (const [tag, w] of Object.entries(sum) as [SoundTag, number][]) out[tag] = Math.round((w / max) * 100) / 100;
  return out;
}
