import { useMemo } from 'react';
import { useCatalog } from '../../state/catalog';
import { useCollectionSeen } from '../../state/collectionSeen';
import { useFinds } from '../../state/finds';
import { useKandi } from '../../state/kandi';
import { useSocial } from '../../state/social';
import { useSprouts } from '../../state/sprouts';
import { isHolo } from '../finds/finds';
import { artistLook } from './artistLook';
import { collection } from './collection';
import { useGardenDecor } from './useGardenDecor';

/**
 * Your collection (collection.ts) from everything on the phone, which of it
 * is new since you last looked in Your collection, and whether everything
 * it's made from has been read yet.
 */
export function useMyCollection() {
  const sprouts = useSprouts();
  const catalog = useCatalog();
  const { finds, hydrated: findsReady } = useFinds();
  const kandi = useKandi();
  const decor = useGardenDecor();
  const social = useSocial();
  const book = useMemo(
    () =>
      collection({
        kinds: sprouts.collected,
        artists: sprouts.artists,
        catalogArtists: catalog.artists,
        lookOf: (id) => {
          const a = catalog.artist(id);
          return a ? artistLook(a) : undefined;
        },
        stickers: new Set(finds.filter((f) => f.state === 'found').map((f) => f.creature)),
        holo: finds.filter(isHolo).length,
        kandi: kandi.received,
        decor,
      }),
    [sprouts.collected, sprouts.artists, catalog, finds, kandi.received, decor],
  );
  const seenStore = useCollectionSeen(social.user?.uid ?? 'guest');
  const ready = seenStore.ready && sprouts.hydrated && findsReady && kandi.hydrated;
  const haveKeys = useMemo(() => book.sets.flatMap((x) => x.items.filter((i) => i.have).map((i) => `${x.id}:${i.key}`)), [book]);
  const { seen, save } = seenStore;
  // Nothing is new the first time (nothing seen saved yet).
  const fresh = useMemo(() => new Set(ready && seen ? haveKeys.filter((k) => !seen.includes(k)) : []), [ready, seen, haveKeys]);
  return { book, ready, haveKeys, fresh, seen, saveSeen: save };
}
