import { useCallback } from 'react';
import { TIER_AT } from '../features/plan/plan';
import { isCold, isWarm } from '../features/taste/ratings';
import { useRatings } from './ratings';
import { useTaste } from './taste';

/**
 * Whether you'd love an artist: you rated them warmly, or the engine knows
 * them as a strong match you haven't turned down. Used to rank festivals and
 * for lineup news.
 */
export function useLoves(): (artistId: string) => boolean {
  const { ratings } = useRatings();
  const { taste, informed } = useTaste();
  return useCallback(
    (id: string) => isWarm(ratings[id]) || (!isCold(ratings[id]) && !!informed[id] && (taste[id] ?? 0) >= TIER_AT.strong),
    [ratings, informed, taste],
  );
}
