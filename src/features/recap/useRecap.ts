import { useMemo } from 'react';
import type { Festival } from '../../data/models';
import { useToday } from '../../lib/useToday';
import { useCatalog } from '../../state/catalog';
import { useGoing } from '../../state/going';
import { useMemories } from '../../state/memories';
import { usePlan } from '../../state/plan';
import { useRatings } from '../../state/ratings';
import { useTaste } from '../../state/taste';
import { bySoonest } from '../festivals/shelves';
import { festivalRecap, hasRecap, type RecapInput } from './recap';

/** Everything a recap is built from, for one festival. */
function useRecapInputs() {
  const { isGoing } = useGoing();
  const { memories } = useMemories();
  const { mustSeesAt } = usePlan();
  const { ratings } = useRatings();
  const { taste } = useTaste();
  const catalog = useCatalog();
  const today = useToday();
  return useMemo(
    () =>
      (festival: Festival): RecapInput => ({
        festival,
        going: isGoing(festival.id),
        memories: memories.filter((m) => m.festivalId === festival.id),
        stars: mustSeesAt(festival.id),
        ratings,
        taste,
        artist: catalog.artist,
        today,
      }),
    [isGoing, memories, mustSeesAt, ratings, taste, catalog, today],
  );
}

/** Your recap of a festival as a card, once it's over and you were part of it. */
export function useRecap(festival: Festival | undefined) {
  const inputs = useRecapInputs();
  return useMemo(() => (festival ? festivalRecap(inputs(festival)) : undefined), [festival, inputs]);
}

/** Festivals with a recap for you, most recent first. */
export function useRecapFestivals(): Festival[] {
  const inputs = useRecapInputs();
  const { festivals } = useCatalog();
  const today = useToday();
  return useMemo(() => bySoonest(festivals.filter((f) => hasRecap(inputs(f))), today).reverse(), [festivals, inputs, today]);
}
