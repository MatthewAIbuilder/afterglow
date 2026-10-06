import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SharedMemory } from '../social/models';
import { useMemories } from '../../state/memories';
import { useSocial } from '../../state/social';
import type { Memory } from './models';
import { webMoments } from './webVideo';

/**
 * Your moments, for Memories and your profile's Moments. In the app: the
 * videos kept on this phone. On the website (which keeps no files): the
 * videos you shared, read from the server each time the page shows and
 * whenever an upload finishes, plus any still uploading from this page.
 */
export function useMoments(): { memories: Memory[]; uriOf: (name: string) => string; fromServer: boolean } {
  const mem = useMemories();
  const social = useSocial();
  const uid = social.user?.uid;
  const uploading = Object.keys(social.sharing).length;
  const [shared, setShared] = useState<{ uid: string; list: SharedMemory[] } | undefined>();
  const fromServer = mem.sessionOnly;
  // Read again each time the page shows.
  const [shown, setShown] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setShown((n) => n + 1);
    }, []),
  );
  useEffect(() => {
    // `uploading` is a dependency so a finished upload reads the list again.
    if (!fromServer || !uid || !shown) return;
    let live = true;
    social.service
      .memoriesOf(uid)
      .then((list) => live && setShared({ uid, list }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [fromServer, uid, shown, uploading, social.service]);
  const memories = useMemo(
    () => (fromServer ? webMoments(mem.memories, shared && shared.uid === uid ? shared.list : []) : mem.memories),
    [fromServer, mem.memories, shared, uid],
  );
  return { memories, uriOf: mem.uriOf, fromServer };
}
