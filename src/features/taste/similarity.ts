import type { Artist, ArtistSimilarity, SoundTag } from '../../data/models';

/** How alike two artists are, 0 to 1. Everything that asks "similar sound?" goes through one of these. */
export type Similarity = (a: Artist, b: Artist) => number;

/** How much a guessed sound (`Artist.soundGuessed`) is trusted, next to tags someone set. */
export const GUESS_TRUST = 0.8;

/**
 * Cosine similarity of two artists' sound tags. The default, and the fallback
 * for pairs a source says nothing about. A guessed sound on either side counts a little less.
 */
export function soundSimilarity(a: Artist, b: Artist) {
  const trust = a.soundGuessed || b.soundGuessed ? GUESS_TRUST : 1;
  // Every tag either has, a's first and then b's others (the same order, so the same sums, as a set of
  // both): without building that set, since this runs for thousands of pairs each time taste is worked out.
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const t in a.sound) {
    const x = a.sound[t as SoundTag] ?? 0;
    const y = b.sound[t as SoundTag] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  for (const t in b.sound) {
    if (Object.prototype.hasOwnProperty.call(a.sound, t)) continue;
    const y = b.sound[t as SoundTag] ?? 0;
    nb += y * y;
  }
  return na && nb ? (trust * dot) / Math.sqrt(na * nb) : 0;
}

/**
 * Similarity that prefers what a source knows (e.g. listening data) and falls
 * back to sound tags. With nothing provided it is exactly soundSimilarity.
 */
export function similarityWith(provided: readonly ArtistSimilarity[] = []): Similarity {
  if (provided.length === 0) return soundSimilarity;
  // Looked up by one artist and then the other (both ways round), so asking needs no new text for each pair.
  const known = new Map<string, Map<string, number>>();
  const put = (a: string, b: string, score: number) => {
    let row = known.get(a);
    if (!row) known.set(a, (row = new Map()));
    row.set(b, score);
  };
  for (const s of provided) {
    if (s.artistId === s.otherId || !Number.isFinite(s.score)) continue;
    const score = Math.min(1, Math.max(0, s.score));
    put(s.artistId, s.otherId, score);
    put(s.otherId, s.artistId, score);
  }
  return (a, b) => known.get(a.id)?.get(b.id) ?? soundSimilarity(a, b);
}

/**
 * The artists who sound most like `artist`, closest first: at most `max`,
 * each at least `min` alike. `candidates` decides where to look (the whole
 * catalogue, or one festival's lineup); the artist themselves is left out.
 */
export function mostSimilar(
  artist: Artist,
  candidates: readonly Artist[],
  similarity: Similarity,
  { max = 3, min = 0.3 }: { max?: number; min?: number } = {},
): Artist[] {
  return candidates
    .filter((a) => a.id !== artist.id)
    .map((a) => ({ a, s: similarity(artist, a) }))
    .filter((x) => x.s > min)
    .sort((p, q) => q.s - p.s)
    .slice(0, max)
    .map((x) => x.a);
}
