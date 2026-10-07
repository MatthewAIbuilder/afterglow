import { useMemo } from 'react';
import { useCatalog } from '../../state/catalog';
import { useFinds } from '../../state/finds';
import { useKandi } from '../../state/kandi';
import { useSprouts } from '../../state/sprouts';
import { artistLook } from './artistLook';
import { collection } from './collection';
import { decorFor, type DecorId } from './decor';
import { useMyShowcase } from './useMyShowcase';

/** The decorations you've earned for your garden (decor.ts). */
export function useGardenDecor(): DecorId[] {
  const { gifts, collected, artists } = useSprouts();
  const { received } = useKandi();
  const { finds } = useFinds();
  const catalog = useCatalog();
  const { pinned } = useMyShowcase();
  // Found the Portal potty: a portal opens in the garden.
  const portal = finds.some((f) => f.state === 'found' && f.creature === 'portapotty');
  // Sets you've completed (decorations aside: they're what this earns).
  const completeSets = useMemo(() => {
    const book = collection({
      kinds: collected,
      artists,
      catalogArtists: catalog.artists,
      lookOf: (id) => {
        const a = catalog.artist(id);
        return a ? artistLook(a) : undefined;
      },
      stickers: new Set(finds.filter((f) => f.state === 'found').map((f) => f.creature)),
      kandi: received,
    });
    return book.sets.filter((x) => x.id !== 'decor' && x.total > 0 && x.have === x.total).length;
  }, [collected, artists, catalog, finds, received]);
  return useMemo(
    () => decorFor({ given: gifts.filter((g) => g.claimedBy).length, kinds: collected, artists, kandi: received.length, pinned: pinned.length, completeSets, portal }),
    [gifts, collected, artists, received.length, pinned.length, completeSets, portal],
  );
}
