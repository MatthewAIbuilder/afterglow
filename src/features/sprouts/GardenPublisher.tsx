import { useEffect, useMemo, useRef } from 'react';
import { useCatalog } from '../../state/catalog';
import { useSocial } from '../../state/social';
import { useSprouts } from '../../state/sprouts';
import { gardenKey, publicGarden } from './publicGarden';

/** Changes settle this long before the garden on your profile is updated. */
const SETTLE_MS = 4000;

/**
 * Keeps your garden on your profile as it is (publicGarden.ts): who lives
 * there, written when that changes, taken down when you hide it. Signed in
 * with a profile only; with no signal it tries again on the next change.
 * Renders nothing.
 */
export function GardenPublisher() {
  const social = useSocial();
  const sprouts = useSprouts();
  const catalog = useCatalog();
  const uid = social.user?.uid;
  const ready = !!uid && !!social.profile && social.availability.ok && sprouts.hydrated;
  const list = useMemo(() => publicGarden(sprouts.garden, sprouts.artists, (id) => catalog.artist(id)?.name), [sprouts.garden, sprouts.artists, catalog]);
  const key = sprouts.gardenShown ? gardenKey(list) : 'hidden';
  const listRef = useRef(list);
  useEffect(() => {
    listRef.current = list;
  });
  // What's on Afterglow now, per account ('hidden' once taken down).
  const sent = useRef<Record<string, string>>({});
  const { service } = social;
  useEffect(() => {
    if (!ready || !uid || sent.current[uid] === key) return;
    const timer = setTimeout(() => {
      const shown = key !== 'hidden';
      void service
        .publishGarden(shown ? listRef.current : null)
        .then(() => {
          sent.current[uid] = key;
        })
        .catch(() => {});
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [ready, uid, key, service]);
  return null;
}
