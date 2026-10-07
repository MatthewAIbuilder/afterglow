import { useCallback, useMemo } from 'react';
import { useCatalog } from '../../state/catalog';
import { useShowcase } from '../../state/showcase';
import { useSocial } from '../../state/social';
import { useSprouts } from '../../state/sprouts';
import { liveShowcase, toggleShowcase } from './showcase';
import type { ShowcaseCard } from './ShowcaseRow';

/**
 * Your showcase: the collectibles you've pinned that you still have, as
 * cards, and a way to pin or unpin one (`'full'` when three are pinned).
 */
export function useMyShowcase(): { pinned: string[]; cards: ShowcaseCard[]; toggle: (artistId: string) => 'pinned' | 'unpinned' | 'full' } {
  const account = useSocial().user?.uid ?? 'guest';
  const { artists } = useSprouts();
  const catalog = useCatalog();
  const { pinned: saved, save } = useShowcase(account);
  const pinned = useMemo(() => liveShowcase(saved, new Set(artists.map((a) => a.artistId))), [saved, artists]);
  const cards = useMemo(
    () =>
      pinned.flatMap((id) => {
        const a = artists.find((x) => x.artistId === id);
        const artist = catalog.artist(id);
        return a && artist ? [{ artistId: id, name: artist.name, tier: a.tier, ...(a.shiny ? { shiny: true } : {}) }] : [];
      }),
    [pinned, artists, catalog],
  );
  const toggle = useCallback(
    (artistId: string) => {
      const was = pinned.includes(artistId);
      const next = toggleShowcase(pinned, artistId);
      if (next.full) return 'full' as const;
      save(next.list);
      return was ? ('unpinned' as const) : ('pinned' as const);
    },
    [pinned, save],
  );
  return { pinned, cards, toggle };
}
