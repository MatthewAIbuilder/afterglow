import { useCallback, useMemo } from 'react';
import { useCatalog } from '../../state/catalog';
import { useRatings } from '../../state/ratings';
import { useReactions } from '../../state/reactions';
import { useTaste } from '../../state/taste';
import { PROVIDER_NAME } from '../music/models';
import { artistSignals } from '../taste/why';
import { favouritesOf, type PickLike, pickWhy, whyText } from './reasons';

/** Why each pick is on your list, as a line (see reasons.ts), from your live signals. */
export function usePickReasons(): (pick: PickLike) => string {
  const { taste, similarity, tasteClips, importedFrom } = useTaste();
  const { reactions } = useReactions();
  const { ratings } = useRatings();
  const { artists } = useCatalog();
  const favourites = useMemo(() => {
    const reacted = new Set<string>();
    for (const c of tasteClips) {
      const r = reactions[c.id];
      if (r && (r.liked || r.saved)) reacted.add(c.artistId);
    }
    return favouritesOf(artists, ratings, reacted, taste);
  }, [tasteClips, reactions, artists, ratings, taste]);
  return useCallback(
    (pick: PickLike) => {
      const signals = artistSignals(pick.artist.id, tasteClips, reactions, ratings, (importedFrom[pick.artist.id] ?? []).map((p) => PROVIDER_NAME[p]));
      return whyText(pickWhy(pick, signals, favourites, similarity));
    },
    [tasteClips, reactions, ratings, importedFrom, favourites, similarity],
  );
}
