import { useCallback } from 'react';
import type { Festival } from '../../data/models';
import { useCatalog } from '../../state/catalog';
import { useGoingShows } from '../../state/goingShows';
import { eventById } from './showEvent';

/**
 * Finding a festival or a one-night show by id (`show:<id>`): for crews and
 * anything else that may be about a show. Shows you're going to are found
 * with no signal (a copy is kept on the phone).
 */
export function useEventLookup(): (id: string) => Festival | undefined {
  const catalog = useCatalog();
  const { shows } = useGoingShows();
  return useCallback((id: string) => eventById(id, { festival: catalog.festival, shows, liveShows: catalog.shows }), [catalog, shows]);
}
