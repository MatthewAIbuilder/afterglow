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
  const tags = new Set([...Object.keys(a.sound), ...Object.keys(b.sound)]) as Set<SoundTag>;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const t of tags) {
    const x = a.sound[t] ?? 0;
    const y = b.sound[t] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na && nb ? (trust * dot) / Math.sqrt(na * nb) : 0;
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Similarity that prefers what a source knows (e.g. listening data) and falls
 * back to sound tags. With nothing provided it is exactly soundSimilarity.
 */
export function similarityWith(provided: readonly ArtistSimilarity[] = []): Similarity {
  if (provided.length === 0) return soundSimilarity;
  const known = new Map<string, number>();
  for (const s of provided) {
    if (s.artistId === s.otherId || !Number.isFinite(s.score)) continue;
    known.set(pairKey(s.artistId, s.otherId), Math.min(1, Math.max(0, s.score)));
  }
  return (a, b) => known.get(pairKey(a.id, b.id)) ?? soundSimilarity(a, b);
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
