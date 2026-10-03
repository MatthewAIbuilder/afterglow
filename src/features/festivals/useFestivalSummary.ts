import { useMemo } from 'react';
import type { Artist, Festival } from '../../data/types';
import { useToday } from '../../lib/useToday';
import { useCatalog } from '../../state/catalog';
import { useNearby } from '../../state/nearby';
import { useTaste } from '../../state/taste';
import { coverPhotos } from './cover';
import { lineupReach } from './links';
import { countdown } from './when';

/** A match at least this strong counts as an artist "you'll love" on festival cards. */
export const LOVE = 0.8;

/**
 * What a festival card needs to say about a festival for you: its lineup best
 * match first, how many you'll love, its clips, the countdown, whether set
 * times are out, how far away it is, and the faces for its cover.
 */
export function useFestivalSummary(festival: Festival) {
  const { artist: artistById, clips } = useCatalog();
  const { taste } = useTaste();
  const today = useToday();
  const { distanceTo, units } = useNearby();
  const ranked = useMemo(
    () =>
      festival.lineup
        .map((id) => artistById(id))
        .filter((a): a is Artist => !!a)
        .sort((a, b) => (taste[b.id] ?? 0) - (taste[a.id] ?? 0)),
    [festival, artistById, taste],
  );
  const loved = ranked.filter((a) => (taste[a.id] ?? 0) >= LOVE).length;
  const cover = useMemo(() => coverPhotos(festival, artistById), [festival, artistById]);
  return {
    ranked,
    loved,
    reach: lineupReach(festival, clips),
    soon: countdown(festival, today),
    timesOut: !!festival.sets?.length,
    away: distanceTo(festival),
    units,
    cover,
    today,
  };
}

/** "3 you'll love" or "52 acts". */
export const lovedLine = (loved: number, acts: number) => (loved > 0 ? `${loved} you’ll love` : `${acts} ${acts === 1 ? 'act' : 'acts'}`);
