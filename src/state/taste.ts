import { useMemo } from 'react';
import { MOCK_TASTE } from '../data/mock';
import { rememberedClips } from '../features/community/clips';
import { computeTaste, startingPrior } from '../features/taste/engine';
import { similarityWith } from '../features/taste/similarity';
import { useCatalog } from './catalog';
import { useCommunityArtists } from './community';
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
  // Community clips you reacted to count for their artist even after they've left the feed.
  const artistOf = useCommunityArtists();
  const allClips = useMemo(() => {
    const extra = rememberedClips(Object.keys(reactions), artistOf, new Set(clips.map((c) => c.id)));
    return extra.length ? [...clips, ...extra] : clips;
  }, [clips, reactions, artistOf]);
  return useMemo(
    () => ({
      ...computeTaste(startingPrior(MOCK_TASTE, imported), artists, allClips, reactions, similarity, ratings, imported),
      similarity,
      /** Every clip the taste rests on: the catalogue's plus community clips you reacted to. */
      tasteClips: allClips,
      /** Artists you've rated directly. */
      rated: artists.filter((a) => ratings[a.id]).length,
      /** Services whose library shapes the taste, and which of their artists Afterglow has. */
      importing,
      importedFrom: imported.from,
    }),
    [artists, allClips, reactions, similarity, ratings, imported, importing],
  );
}
