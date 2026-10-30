import { useEffect, useMemo, useState } from 'react';
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
import { yearCard, type YearInput, yearStats } from './year';
import { tasteMix } from '../taste/lean';
import { useSeen } from '../../state/seen';
import { useWeekends } from '../../state/weekends';
import { useSetsSeen } from '../../state/setsSeen';
import { useFitChecks } from '../../state/fitChecks';
import { readTrails } from '../care/trailStore';
import { daysOf, trailStats } from '../care/trail';
import { unitsFor } from '../festivals/near';

const locale = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
};

/** How far your festival trail says you walked at each festival (meters), read once from the phone. */
export function useTrailMeters(): Record<string, number> {
  const [meters, setMeters] = useState<Record<string, number>>({});
  useEffect(() => {
    let live = true;
    void readTrails().then((trails) => {
      if (!live) return;
      const out: Record<string, number> = {};
      for (const [id, points] of Object.entries(trails)) out[id] = daysOf(points).reduce((n, d) => n + trailStats(d.points).meters, 0);
      setMeters(out);
    });
    return () => {
      live = false;
    };
  }, []);
  return meters;
}

/** Everything a recap is built from, for one festival. */
function useRecapInputs() {
  const { isGoing } = useGoing();
  const { memories } = useMemories();
  const { mustSeesAt } = usePlan();
  const { ratings } = useRatings();
  const { taste } = useTaste();
  const catalog = useCatalog();
  const today = useToday();
  const { sets } = useSetsSeen();
  const { fits } = useFitChecks();
  const walked = useTrailMeters();
  const miles = unitsFor(locale()) === 'mi';
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
        seen: Object.values(sets)
          .filter((x) => x.festivalId === festival.id)
          .sort((a, b) => a.at - b.at)
          .map((x) => ({ artistId: x.artistId, ...(x.verdict ? { verdict: x.verdict } : {}) })),
        walkedMeters: walked[festival.id],
        miles,
        fits: fits.filter((f) => f.festivalId === festival.id).length,
      }),
    [isGoing, memories, mustSeesAt, ratings, taste, catalog, today, sets, fits, walked, miles],
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

/** Everything your year is built from. */
function useYearInput(year: number): YearInput {
  const { going } = useGoing();
  const { memories } = useMemories();
  const { ratings } = useRatings();
  const { taste, informed } = useTaste();
  const { seen } = useSeen();
  const catalog = useCatalog();
  const today = useToday();
  const { forYou } = useWeekends();
  const extra = useYearExtras();
  return useMemo(
    () => ({
      ...extra,
      year,
      festivals: catalog.festivals.map(forYou),
      going,
      memories,
      seen,
      ratings,
      taste,
      informed,
      sounds: tasteMix(catalog.artists, taste, informed),
      artist: catalog.artist,
      today,
    }),
    [year, catalog, forYou, going, memories, seen, ratings, taste, informed, today, extra],
  );
}

/** Your year on Afterglow as a card (undefined when there's nothing yet). */
export function useYear(year: number) {
  const input = useYearInput(year);
  return useMemo(() => yearCard(input), [input]);
}

/** Your year as numbers and lists, for Wrapped. */
export function useYearStats(year: number) {
  const input = useYearInput(year);
  return useMemo(() => ({ stats: yearStats(input), sounds: input.sounds }), [input]);
}

/** What the year adds from this phone: sets you saw, how far you walked, your fit checks. */
export function useYearExtras() {
  const { sets } = useSetsSeen();
  const { fits } = useFitChecks();
  const walked = useTrailMeters();
  const miles = unitsFor(locale()) === 'mi';
  return useMemo(() => ({ setsSeen: Object.values(sets), walked, miles, fits: fits.map((f) => f.at) }), [sets, walked, miles, fits]);
}
