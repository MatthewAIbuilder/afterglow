import type { SoundTag } from '../../data/models';
import type { SoundShare } from '../taste/lean';
import { t } from '../../i18n';

/**
 * How alike your taste is to someone's, from what they chose to show (their
 * top sounds, in order, and the festivals they're going to) and your own mix.
 * Worked out on the phone; nothing of yours is sent. Pure.
 */

/** Their top sounds are shown in order without numbers, so they're weighed like this. */
const RANK_WEIGHT = [0.5, 0.3, 0.2];
/** A shared festival adds this much (the rest is sound). */
const FESTIVAL_PART = 0.2;
/** Strong enough to mention in friends' activity. */
export const STRONG_MATCH = 80;

/**
 * 0 to 100, or undefined when either of you has no sound to compare. Sound
 * is the overlap of the two mixes (each sound counts the smaller share),
 * plus a little for a festival you're both going to.
 */
export function tasteMatch(mine: readonly SoundShare[], theirs: readonly SoundTag[], sharedFestivals = 0): number | undefined {
  if (!mine.length || !theirs.length) return undefined;
  const top = theirs.slice(0, RANK_WEIGHT.length);
  const sum = RANK_WEIGHT.slice(0, top.length).reduce((a, b) => a + b, 0);
  const their = new Map(top.map((t, i) => [t, RANK_WEIGHT[i] / sum]));
  // Your mix, cut to your top few too, so a long tail doesn't count against anyone.
  const mineTop = mine.slice(0, 4);
  const mineSum = mineTop.reduce((a, s) => a + s.share, 0) || 1;
  let overlap = 0;
  for (const s of mineTop) overlap += Math.min(s.share / mineSum, their.get(s.tag) ?? 0);
  const score = overlap * (1 - FESTIVAL_PART) + (sharedFestivals > 0 ? FESTIVAL_PART : 0);
  return Math.round(Math.min(1, score) * 100);
}

/** "92% taste match". */
export const matchLine = (percent: number) => t('{pct}% taste match', { pct: percent });
