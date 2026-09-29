import { useMemo } from 'react';
import { MOCK_TASTE } from '../data/mock';
import { computeTaste } from '../features/taste/engine';
import { similarityWith } from '../features/taste/similarity';
import { useCatalog } from './catalog';
import { useFollows } from './follows';
import { useRatings } from './ratings';
import { useReactions } from './reactions';

/**
 * Live taste profile: the starting profile, reshaped by everything you have
 * reacted to. Also hands out the similarity it used, so everything else that
 * asks "similar sound?" agrees with the engine.
 */
export function useTaste() {
  const { reactions } = useReactions();
  const { ratings } = useRatings();
  const { followed } = useFollows();
  const { artists, clips, similarities } = useCatalog();
  const similarity = useMemo(() => similarityWith(similarities), [similarities]);
  return useMemo(
    () => ({
      ...computeTaste(MOCK_TASTE, artists, clips, reactions, similarity, ratings, followed),
      similarity,
      /** Artists you've rated directly. */
      rated: artists.filter((a) => ratings[a.id]).length,
    }),
    [artists, clips, reactions, similarity, ratings, followed],
  );
}
