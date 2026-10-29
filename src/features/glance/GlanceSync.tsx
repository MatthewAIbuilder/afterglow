import { useEffect, useMemo } from 'react';
import { hasGlance, shareGlance, syncLiveActivity } from '../../lib/glance';
import { useNow } from '../../lib/useNow';
import { useCatalog } from '../../state/catalog';
import { useAllDayHours } from '../../state/dayHours';
import { useGoing } from '../../state/going';
import { usePlan } from '../../state/plan';
import { useTaste } from '../../state/taste';
import { useWeekends } from '../../state/weekends';
import { festivalRoute } from '../plan/route';
import { activityShow, festivalGlance, glanceKey } from './glance';

/**
 * Keeps Afterglow outside the app in step with your plan (root layout, draws
 * nothing): the widgets and the Apple Watch get your festival at a glance
 * whenever it changes, and on a festival night the Live Activity shows the
 * set on your route now and the next. Checked every minute and when the app
 * comes back; the festival trail's background task keeps the Live Activity
 * current with the app closed. Only in builds that have it (1.0.6 on iPhone).
 */
export function GlanceSync() {
  const on = hasGlance();
  const now = useNow(60_000);
  const catalog = useCatalog();
  const { forYou } = useWeekends();
  const { going } = useGoing();
  const { taste, informed } = useTaste();
  const { mustSeesAt } = usePlan();
  const { all: hoursAt } = useAllDayHours();
  const festivals = useMemo(() => (on ? catalog.festivals.map(forYou) : []), [on, catalog.festivals, forYou]);
  // The full-day route of each festival you're going to that has set times: the same one "Your festival" shows.
  const routes = useMemo(() => {
    const out = new Map<string, ReturnType<typeof festivalRoute>>();
    for (const f of festivals) {
      if (going.includes(f.id) && f.sets?.length) out.set(f.id, festivalRoute({ festival: f, artists: catalog.artists, taste, informed, pinned: mustSeesAt(f.id), hours: hoursAt[f.id] }));
    }
    return out;
  }, [festivals, going, catalog.artists, taste, informed, mustSeesAt, hoursAt]);
  const glance = useMemo(() => festivalGlance(festivals, going, (f) => routes.get(f.id), now), [festivals, going, routes, now]);
  const key = glanceKey(glance);
  const showKey = JSON.stringify(activityShow(glance, now) ?? null);

  useEffect(() => {
    if (on) shareGlance(glance);
    // Only when what it says changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, key]);

  useEffect(() => {
    if (on) void syncLiveActivity(glance, now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, showKey]);

  return null;
}
