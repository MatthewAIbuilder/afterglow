import { useCallback, useMemo } from 'react';
import type { Show } from '../../data/models';
import { useToday } from '../../lib/useToday';
import { useCatalog } from '../../state/catalog';
import { useFollowedArtists } from '../../state/followedArtists';
import { useGoing } from '../../state/going';
import { useNearby } from '../../state/nearby';
import { useRatings } from '../../state/ratings';
import { useTaste } from '../../state/taste';
import { distanceKm, NEAR_KM } from '../festivals/near';
import { favouriteArtists } from '../profile/identity';
import { whereArtists, whereTheyPlay } from './where';

/**
 * Where the artists you follow and love play: the same faces as Profile's
 * Your artists row (plus everyone else you follow) and every upcoming
 * festival date and club show for them, soonest first.
 */
export function useWhereTheyPlay() {
  const catalog = useCatalog();
  const today = useToday();
  const { going } = useGoing();
  const { here, distanceTo } = useNearby();
  const { followed } = useFollowedArtists();
  const { ratings } = useRatings();
  const { taste, informed } = useTaste();

  const ids = useMemo(() => {
    const favourites = favouriteArtists({ artists: catalog.artists, taste, informed, ratings, followed }).map((f) => f.artist.id);
    return whereArtists(favourites, followed).filter((id) => catalog.artist(id));
  }, [catalog, taste, informed, ratings, followed]);

  const showKm = useCallback((s: Show) => (here && s.place ? distanceKm(here, s.place) : undefined), [here]);
  const dates = useMemo(
    () =>
      whereTheyPlay(ids, {
        artist: catalog.artist,
        festivalsOf: catalog.festivalsOf,
        showsOf: catalog.showsOf,
        going,
        today,
        distanceTo,
        showKm,
        nearKm: NEAR_KM,
      }),
    [ids, catalog, going, today, distanceTo, showKm],
  );
  return { ids, dates };
}
