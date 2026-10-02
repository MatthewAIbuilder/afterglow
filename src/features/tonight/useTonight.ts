import { useMemo } from 'react';
import { useNow } from '../../lib/useNow';
import { useCatalog } from '../../state/catalog';
import { useGoing } from '../../state/going';
import { useWeekends } from '../../state/weekends';
import { tonightFestival, type Tonight } from './tonight';

/** The festival you're going to that's on right now (as it is for you), checked every minute. */
export function useTonight(): (Tonight & { at: Date }) | undefined {
  const catalog = useCatalog();
  const { going } = useGoing();
  const { forYou } = useWeekends();
  const now = useNow();
  const minute = Math.floor(now.getTime() / 60_000);
  return useMemo(() => {
    const at = new Date(minute * 60_000);
    const t = tonightFestival(catalog.festivals.map(forYou), going, at);
    return t && { ...t, at };
  }, [catalog.festivals, forYou, going, minute]);
}
