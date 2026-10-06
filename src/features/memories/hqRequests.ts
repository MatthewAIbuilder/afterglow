import { normalize } from '../festivals/search';
import type { MemoryTagInput } from './models';
import { KNOWN_FESTIVALS } from './past';

/**
 * Requests HQ gets by itself when someone tags a video with something
 * Afterglow doesn't have yet: a past festival typed in (so it can get a
 * unique badge of its own) or an artist typed in (so HQ adds them properly:
 * photo, sound, lineups). Pure: what to ask, each once per phone.
 */
export type HqRequest = { key: string; topic: 'festival' | 'other'; text: string };

/** Asked about before (keys), kept on the phone. */
export const HQ_ASKED_KEY = 'hqAsked.v1';
export const HQ_ASKED_MAX = 300;

/** A past festival Afterglow has nothing for: not on Afterglow under another year, not a well-known one. */
export function isNewPastFestival(past: { name: string; seriesId?: string } | undefined): boolean {
  if (!past || past.seriesId) return false;
  const n = normalize(past.name);
  return !KNOWN_FESTIVALS.some((k) => normalize(k.name) === n);
}

/** What to ask HQ about a video's tags, leaving out anything asked before. */
export function hqRequests(tag: Pick<MemoryTagInput, 'past' | 'festivalId' | 'artistId' | 'artistName'>, asked: readonly string[]): HqRequest[] {
  const out: HqRequest[] = [];
  const past = tag.festivalId ? undefined : tag.past;
  if (past && isNewPastFestival(past)) {
    const key = `festival:${normalize(past.name)}`;
    if (!asked.includes(key))
      out.push({
        key,
        topic: 'festival',
        text: `New festival added from a throwback: "${past.name}" (${past.year}${past.city ? `, ${past.city}` : ''}). It has no badge of its own yet: please make it a unique one, and add the festival if it comes back.`,
      });
  }
  if (tag.artistId && tag.artistName) {
    const key = `artist:${tag.artistId}`;
    if (!asked.includes(key))
      out.push({
        key,
        topic: 'other',
        text: `New artist named on a video: "${tag.artistName}" (id "${tag.artistId}"). They aren't on Afterglow yet: please add them with this id, and their videos will join their page.`,
      });
  }
  return out;
}

export const cleanAsked = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-HQ_ASKED_MAX) : []);
