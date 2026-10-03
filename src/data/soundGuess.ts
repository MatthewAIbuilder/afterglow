import type { Artist, CatalogSnapshot, SoundTag } from './models';

/**
 * Sounds for artists who came without any (most of the nightly EDMTrain
 * feed): a guess from the company they keep. Two kinds of evidence:
 *  - who they're billed with again and again (the catalogue's `similar`
 *    pairs, learned from shared lineups), each pulling towards that artist's sound;
 *  - the festivals they play: each lineup's overall sound, from the artists
 *    on it whose sound is known (a festival needs `FESTIVAL_MIN_TAGGED` of them).
 * Guesses spread a second round (from artists guessed in the first), a
 * little weaker. Each guess keeps its strongest sounds (at least `MIN_SHARE`
 * of the pull, at most `MAX_TAGS`), the strongest at 1, and is marked
 * `soundGuessed`, so the app can say so and trust it a little less. Artists
 * with sounds of their own are never touched; nothing changes when nobody
 * can be guessed (the same object comes back).
 */
export const GUESS = {
  /** How much one "billed together" pair counts, times its score. */
  pairWeight: 2,
  /** A festival with fewer artists of known sound than this says nothing. */
  festivalMinTagged: 3,
  /** A festival's pull is full once this many of its artists have a known sound. */
  festivalFullAt: 8,
  /** Less evidence than this and no guess is made. */
  minEvidence: 0.6,
  /** A sound needs this share of the pull to be kept. */
  minShare: 0.15,
  maxTags: 3,
  /** The second round's guesses lean on first-round guesses, which count this much. */
  secondRound: 0.6,
  /** How much sharper the guess is than the pull (1 keeps it as it is). */
  sharpen: 1.4,
  /** The artists sharing your day at a festival say this much more than the lineup as a whole. */
  dayWeight: 1.5,
} as const;

type Vec = Partial<Record<SoundTag, number>>;

const hasSound = (a: Artist) => Object.values(a.sound).some((v) => (v ?? 0) > 0);

/** A sound as shares adding to 1. */
function shares(v: Vec): Vec {
  let total = 0;
  for (const x of Object.values(v)) total += Math.max(0, x ?? 0);
  if (!total) return {};
  const out: Vec = {};
  for (const [k, x] of Object.entries(v)) if ((x ?? 0) > 0) out[k as SoundTag] = (x ?? 0) / total;
  return out;
}

function addTo(acc: Vec, v: Vec, w: number) {
  for (const [k, x] of Object.entries(v)) acc[k as SoundTag] = (acc[k as SoundTag] ?? 0) + (x ?? 0) * w;
}

/** The pull turned into a sound: sharpened, strongest few kept, the strongest at 1. */
export function soundFrom(pull: Vec): Vec | undefined {
  const sharp: Vec = {};
  for (const [k, x] of Object.entries(shares(pull))) sharp[k as SoundTag] = (x ?? 0) ** GUESS.sharpen;
  const kept = Object.entries(shares(sharp))
    .filter(([, x]) => (x ?? 0) >= GUESS.minShare)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, GUESS.maxTags);
  if (!kept.length) return undefined;
  const top = kept[0][1] ?? 1;
  const out: Vec = {};
  for (const [k, x] of kept) out[k as SoundTag] = Math.round(((x ?? 0) / top) * 20) / 20;
  return out;
}

export function withGuessedSounds(snapshot: CatalogSnapshot): CatalogSnapshot {
  const artists = snapshot.artists;
  if (!artists.some((a) => !hasSound(a))) return snapshot;

  // What's known so far: artists with their own sound (weight 1), then guesses.
  const known = new Map<string, { sound: Vec; weight: number }>();
  for (const a of artists) if (hasSound(a)) known.set(a.id, { sound: shares(a.sound), weight: 1 });

  // Each festival's overall sound, from its artists of known sound, and each of its days' (where the lineup says who plays when).
  const festivalsOf = new Map<string, { profile: Vec; trust: number }[]>();
  const profileOf = (ids: readonly string[]) => {
    const profile: Vec = {};
    let tagged = 0;
    for (const id of ids) {
      const k = known.get(id);
      if (!k) continue;
      addTo(profile, k.sound, 1);
      tagged++;
    }
    return tagged < GUESS.festivalMinTagged ? undefined : { profile: shares(profile), trust: Math.min(1, tagged / GUESS.festivalFullAt) };
  };
  const pullFrom = (id: string, entry: { profile: Vec; trust: number }) => {
    const list = festivalsOf.get(id) ?? [];
    list.push(entry);
    festivalsOf.set(id, list);
  };
  for (const f of snapshot.festivals) {
    const whole = profileOf(f.lineup);
    if (!whole) continue;
    const days = f.artistDays ?? {};
    const dayProfiles = new Map<string, { profile: Vec; trust: number } | undefined>();
    for (const day of f.days ?? []) dayProfiles.set(day, profileOf(f.lineup.filter((id) => days[id]?.includes(day))));
    for (const id of f.lineup) {
      if (known.has(id)) continue;
      pullFrom(id, whole);
      // Their own day(s), when known, say more than the whole lineup.
      for (const day of days[id] ?? []) {
        const p = dayProfiles.get(day);
        if (p) pullFrom(id, { profile: p.profile, trust: p.trust * GUESS.dayWeight });
      }
    }
  }

  // Who each artist is billed with.
  const pairs = new Map<string, { other: string; score: number }[]>();
  for (const s of snapshot.similarities ?? []) {
    if (s.artistId === s.otherId || !(s.score > 0)) continue;
    for (const [a, b] of [
      [s.artistId, s.otherId],
      [s.otherId, s.artistId],
    ]) {
      const list = pairs.get(a) ?? [];
      list.push({ other: b, score: Math.min(1, s.score) });
      pairs.set(a, list);
    }
  }

  const guessed = new Map<string, Vec>();
  for (const round of [0, 1]) {
    const found = new Map<string, Vec>();
    for (const a of artists) {
      if (known.has(a.id)) continue;
      const pull: Vec = {};
      let evidence = 0;
      for (const p of pairs.get(a.id) ?? []) {
        const k = known.get(p.other);
        if (!k) continue;
        const w = GUESS.pairWeight * p.score * k.weight;
        addTo(pull, k.sound, w);
        evidence += w;
      }
      // Festivals only in the first round (their sound comes from real tags; the second round would count them twice).
      if (round === 0)
        for (const f of festivalsOf.get(a.id) ?? []) {
          addTo(pull, f.profile, f.trust);
          evidence += f.trust;
        }
      if (evidence < GUESS.minEvidence) continue;
      const sound = soundFrom(pull);
      if (sound) found.set(a.id, sound);
    }
    // Added after the round, so the order artists come in never matters.
    for (const [id, sound] of found) {
      guessed.set(id, sound);
      known.set(id, { sound: shares(sound), weight: round === 0 ? GUESS.secondRound : GUESS.secondRound ** 2 });
    }
  }
  if (!guessed.size) return snapshot;
  return { ...snapshot, artists: artists.map((a) => (guessed.has(a.id) ? { ...a, sound: guessed.get(a.id)!, soundGuessed: true } : a)) };
}
