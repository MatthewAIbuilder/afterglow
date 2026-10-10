import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SharedMemory } from '../social/models';
import { useMemories } from '../../state/memories';
import { useSocial } from '../../state/social';
import type { Memory } from './models';
import { appMoments, onServer, webMoments } from './webVideo';

/**
 * Your moments, for Memories and your profile's Moments. In the app: the
 * videos kept on this phone, plus the ones you shared that it doesn't have
 * (from the website, another phone or an earlier install). On the website
 * (which keeps no files): the videos you shared plus any still uploading from
 * this page. The shared list is read each time the page shows and whenever an
 * upload finishes.
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
    if (!uid || !shown) return;
    let live = true;
    social.service
      .memoriesOf(uid)
      .then((list) => live && setShared({ uid, list }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [uid, shown, uploading, social.service]);
  const memories = useMemo(() => {
    const list = shared && shared.uid === uid ? shared.list : [];
    return fromServer ? webMoments(mem.memories, list) : appMoments(mem.memories, list);
  }, [fromServer, mem.memories, shared, uid]);
  // A shared video's picture is already a link; a kept one's is a file name.
  const fileUri = mem.uriOf;
  const uriOf = useCallback((name: string) => (onServer({ file: name }) ? name : fileUri(name)), [fileUri]);
  return { memories, uriOf, fromServer };
}
