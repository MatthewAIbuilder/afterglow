import type { Festival } from '../models';

/**
 * Who sounds alike, learned from lineups. Artists the nightly EDMTrain import
 * adds have no sound tags, so nothing you like ever spills over to them. But
 * festivals book artists who fit together, and a festival day even more so:
 * two artists who keep sharing bills (and days) are probably close. Pure: the
 * nightly job (scripts/lineup-similar.ts) publishes the pairs in the hosted
 * catalogue's "similar" list, which the taste engine already reads first.
 *
 * Each shared festival counts less the bigger its lineup (a 20-act bass
 * weekend says more than a 140-act city festival), a shared day counts
 * extra, and pairs are scored like a cosine: shared weight over the two
 * artists' own weights. Only pairs where at least one artist has no sound
 * tags are published (sound tags stay the judge between tagged artists), only
 * after at least `minShared` festivals together, scaled down when the
 * shared festivals were few and huge (`evidence`), capped at `maxScore` so a
 * guess from lineups never counts as much as sounding the same.
 */
export const LINEUP_SIMILAR = { minShared: 2, maxScore: 0.7, minScore: 0.3, perArtist: 6, maxPairs: 4000, evidence: 0.6 } as const;

export type SimilarPair = { artist: string; other: string; score: number };

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function lineupSimilarities(
  festivals: readonly Pick<Festival, 'id' | 'lineup' | 'artistDays'>[],
  tagged: (artistId: string) => boolean,
  rules: { minShared: number; maxScore: number; minScore: number; perArtist: number; maxPairs: number; evidence: number } = LINEUP_SIMILAR,
): SimilarPair[] {
  const own = new Map<string, number>();
  const shared = new Map<string, { w: number; n: number }>();
  for (const f of festivals) {
    const acts = [...new Set(f.lineup)];
    if (acts.length < 2) continue;
    const w = 1 / Math.sqrt(acts.length);
    for (const a of acts) own.set(a, (own.get(a) ?? 0) + w);
    for (let i = 0; i < acts.length; i++) {
      for (let j = i + 1; j < acts.length; j++) {
        const a = acts[i];
        const b = acts[j];
        if (tagged(a) && tagged(b)) continue;
        const da = f.artistDays?.[a];
        const db = f.artistDays?.[b];
        const sameDay = !!da && !!db && da.some((d) => db.includes(d));
        const k = key(a, b);
        const s = shared.get(k) ?? { w: 0, n: 0 };
        s.w += sameDay ? w * 1.5 : w;
        s.n += 1;
        shared.set(k, s);
      }
    }
  }
  const pairs: SimilarPair[] = [];
  for (const [k, s] of shared) {
    if (s.n < rules.minShared) continue;
    const [a, b] = k.split('|');
    const cos = s.w / Math.sqrt((own.get(a) ?? 1) * (own.get(b) ?? 1));
    // Two big city festivals together say less than two small bass weekends: scale by how much evidence there is.
    const sure = Math.min(1, s.w / rules.evidence);
    const score = Math.min(rules.maxScore, Math.round(cos * sure * 100) / 100);
    if (score >= rules.minScore) pairs.push({ artist: a, other: b, score });
  }
  // Each artist's closest few, strongest pairs first.
  pairs.sort((p, q) => q.score - p.score || key(p.artist, p.other).localeCompare(key(q.artist, q.other)));
  const count = new Map<string, number>();
  const kept: SimilarPair[] = [];
  for (const p of pairs) {
    if ((count.get(p.artist) ?? 0) >= rules.perArtist || (count.get(p.other) ?? 0) >= rules.perArtist) continue;
    kept.push(p);
    count.set(p.artist, (count.get(p.artist) ?? 0) + 1);
    count.set(p.other, (count.get(p.other) ?? 0) + 1);
    if (kept.length >= rules.maxPairs) break;
  }
  return kept;
}
