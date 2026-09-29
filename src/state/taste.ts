import { useMemo } from 'react';
import { MOCK_TASTE } from '../data/mock';
import { computeTaste, startingPrior } from '../features/taste/engine';
import { similarityWith } from '../features/taste/similarity';
import { useCatalog } from './catalog';
import { useMusic } from './music';
import { useRatings } from './ratings';
import { useReactions } from './reactions';

/**
 * Live taste profile: the starting profile, reshaped by everything you have
 * reacted to and by a connected music library (a separate, smaller layer). Also hands out the similarity it used, so everything else that
 * asks "similar sound?" agrees with the engine.
 */
export function useTaste() {
  const { reactions } = useReactions();
  const { ratings } = useRatings();
  const { artists, clips, similarities } = useCatalog();
  // A connected music library: its own capped layer in the engine (see IMPORT_WEIGHT).
  const { imported, importing } = useMusic();
  const similarity = useMemo(() => similarityWith(similarities), [similarities]);
  return useMemo(
    () => ({
      ...computeTaste(startingPrior(MOCK_TASTE, imported), artists, clips, reactions, similarity, ratings, imported),
      similarity,
      /** Artists you've rated directly. */
      rated: artists.filter((a) => ratings[a.id]).length,
      /** Services whose library shapes the taste, and which of their artists Afterglow has. */
      importing,
      importedFrom: imported.from,
    }),
    [artists, clips, reactions, similarity, ratings, imported, importing],
  );
}
