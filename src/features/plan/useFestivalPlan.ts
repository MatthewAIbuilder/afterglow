import { useMemo } from 'react';
import { APP_NAME } from '../../config/app';
import type { Festival } from '../../data/types';
import { useCatalog } from '../../state/catalog';
import { usePlan } from '../../state/plan';
import { useTaste } from '../../state/taste';
import { buildSchedule, rankLineup } from './plan';
import { festivalRoute } from './route';
import { planCard, planText, routeText } from './share';

/**
 * Your plan for a festival, from your live taste and must-sees: ranked picks,
 * the schedule and full-day route once set times are out, and the text and
 * card to share. Shared by "Your festival" and the plan card.
 */
export function useFestivalPlan(festival: Festival) {
  const { taste, informed } = useTaste();
  const { artists } = useCatalog();
  const { mustSeesAt } = usePlan();

  const picks = useMemo(
    () => rankLineup({ festival, artists, taste, informed, pinned: mustSeesAt(festival.id) }),
    [festival, artists, taste, informed, mustSeesAt],
  );
  const schedule = useMemo(() => (festival.sets?.length ? buildSchedule(festival, picks) : null), [festival, picks]);
  // Every day set to set, from the same live taste and must-sees.
  const route = useMemo(
    () => (festival.sets?.length ? festivalRoute({ festival, artists, taste, informed, pinned: mustSeesAt(festival.id) }) : undefined),
    [festival, artists, taste, informed, mustSeesAt],
  );
  // Once set times are out, you share the whole route; before, your picks.
  const text = useMemo(
    () => (route && routeText(festival, route, APP_NAME)) ?? planText(festival, picks, schedule, APP_NAME),
    [festival, route, picks, schedule],
  );
  const card = useMemo(() => planCard(festival, picks, route), [festival, picks, route]);
  return { picks, schedule, route, text, card };
}
