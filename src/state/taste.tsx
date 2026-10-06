import { createContext, type ReactNode, useContext, useDeferredValue, useMemo } from 'react';
import { MOCK_TASTE } from '../data/mock';
import { rememberedClips } from '../features/community/clips';
import { reactedCards } from '../features/discover/soundcloud';
import { computeTaste, startingPrior } from '../features/taste/engine';
import { similarityWith, soundSimilarity } from '../features/taste/similarity';
import { useCatalog } from './catalog';
import { useCommunityArtists } from './community';
import { useMusic } from './music';
import { useRatings } from './ratings';
import { useReactions } from './reactions';

/**
 * Live taste profile: the starting profile, reshaped by everything you have
 * reacted to and by a connected music library (a separate, smaller layer). Also hands out the similarity it used, so everything else that
 * asks "similar sound?" agrees with the engine.
 *
 * Worked out once for the whole app (`TasteProvider`), not by every screen and
 * clip that asks: a swipe in Discover used to recompute it once per clip on
 * screen. Reactions feed it a moment later than they land (a deferred value),
 * so a swipe, like or save never waits for it.
 */
function useLiveTaste(enabled: boolean, defer: boolean) {
  const { reactions: now } = useReactions();
  const later = useDeferredValue(now);
  const reactions = defer ? later : now;
  const { ratings } = useRatings();
  const catalog = useCatalog();
  const { artists, clips, similarities } = catalog;
  // A connected music library: its own capped layer in the engine (see IMPORT_WEIGHT).
  const { imported, importing } = useMusic();
  // Only when this one works the taste out: every row on screen asks for the taste, and building the
  // lookup of thousands of pairs for each of them made long lists slow to open.
  const similarity = useMemo(() => (enabled ? similarityWith(similarities) : soundSimilarity), [enabled, similarities]);
  // Community clips you reacted to count for their artist even after they've left the feed.
  const artistOf = useCommunityArtists();
  const allClips = useMemo(() => {
    if (!enabled) return clips;
    const ids = Object.keys(reactions);
    const loaded = new Set(clips.map((c) => c.id));
    // So do SoundCloud cards: a like, save or skip there counts for the artist like a clip's.
    const extra = [...rememberedClips(ids, artistOf, loaded), ...reactedCards(ids, catalog, (id) => !!catalog.artist(id), loaded)];
    return extra.length ? [...clips, ...extra] : clips;
  }, [enabled, clips, reactions, artistOf, catalog]);
  // Back to backs count for everyone playing (data/b2b.ts).
  const b2b = useMemo(() => ({ playersOf: catalog.playersOf, membersOf: catalog.membersOf }), [catalog]);
  return useMemo(
    () =>
      enabled
        ? {
            ...computeTaste(startingPrior(MOCK_TASTE, imported), artists, allClips, reactions, similarity, ratings, imported, b2b),
            similarity,
            /** Every clip the taste rests on: the catalogue's plus community clips you reacted to. */
            tasteClips: allClips,
            /** Artists you've rated directly. */
            rated: artists.filter((a) => ratings[a.id]).length,
            /** Services whose library shapes the taste, and which of their artists Afterglow has. */
            importing,
            importedFrom: imported.from,
          }
        : null,
    [enabled, artists, allClips, reactions, similarity, ratings, imported, importing, b2b],
  );
}

export type LiveTaste = NonNullable<ReturnType<typeof useLiveTaste>>;

const TasteContext = createContext<LiveTaste | null>(null);

/** Works out your taste once for everything inside it. In the root layout, inside the stores it reads. */
export function TasteProvider({ children }: { children: ReactNode }) {
  const value = useLiveTaste(true, true);
  return <TasteContext.Provider value={value}>{children}</TasteContext.Provider>;
}

/** Your live taste: from `TasteProvider` when there is one, else worked out here (tests of single parts). */
export function useTaste(): LiveTaste {
  const shared = useContext(TasteContext);
  const own = useLiveTaste(shared === null, false);
  return (shared ?? own)!;
}
