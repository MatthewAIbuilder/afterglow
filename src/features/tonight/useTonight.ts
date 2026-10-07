import { useMemo } from 'react';
import { useNow } from '../../lib/useNow';
import { useCatalog } from '../../state/catalog';
import { useGoing } from '../../state/going';
import { useGoingShows } from '../../state/goingShows';
import { useWeekends } from '../../state/weekends';
import { showTonight } from '../festivalMode/showEvent';
import { tonightFestival, type Tonight } from './tonight';

/**
 * The festival you're going to that's on right now (as it is for you), else
 * the one-night show you're going to tonight (as a one-night event, from noon
 * on its day to noon the next), checked every minute.
 */
export function useTonight(): (Tonight & { at: Date }) | undefined {
  const catalog = useCatalog();
  const { going } = useGoing();
  const { shows } = useGoingShows();
  const { forYou } = useWeekends();
  const now = useNow();
  const minute = Math.floor(now.getTime() / 60_000);
  return useMemo(() => {
    const at = new Date(minute * 60_000);
    const t = tonightFestival(catalog.festivals.map(forYou), going, at) ?? showTonight(shows, catalog.shows, at);
    return t && { ...t, at };
  }, [catalog.festivals, catalog.shows, forYou, going, shows, minute]);
}
