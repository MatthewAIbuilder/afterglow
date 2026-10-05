import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCloseFriends } from '../../state/closeFriends';
import { useSocial } from '../../state/social';
import type { Profile, SharedMemory } from '../social/models';

/** How many of the people you follow are read for the orbit and the activity. */
const FRIENDS_READ = 30;

/**
 * The people you follow, read each time the Friends tab comes into view:
 * close friends first (so the orbit's inner ring is always there), then
 * others, up to FRIENDS_READ; and the moments they shared lately. Nobody
 * you've blocked, nobody whose account is gone. `profiles` is undefined
 * until read.
 */
export function useFriendsCircle() {
  const social = useSocial();
  const meUid = social.profile?.uid;
  const { ids: close } = useCloseFriends(social.user?.uid);
  const [profiles, setProfiles] = useState<Profile[] | undefined>();
  const [memories, setMemories] = useState<SharedMemory[]>([]);
  const followingRef = useRef(social.following);
  useEffect(() => {
    followingRef.current = social.following;
  }, [social.following]);
  const followingKey = [...social.following].sort().join('|');
  const closeKey = close.join('|');
  useFocusEffect(
    useCallback(() => {
      if (!meUid) return;
      let live = true;
      const following = followingRef.current;
      const first = (closeKey ? closeKey.split('|') : []).filter((u) => following.has(u));
      const uids = [...new Set([...first, ...following])].slice(0, FRIENDS_READ);
      if (!uids.length) {
        setProfiles([]);
        setMemories([]);
        return;
      }
      Promise.all(uids.map((u) => social.service.profileOf(u).catch(() => null))).then(
        (list) => live && setProfiles(list.filter((p): p is Profile => !!p)),
      );
      social.service
        .memoriesBy(uids, 20)
        .then((list) => live && setMemories(list))
        .catch(() => {});
      return () => {
        live = false;
      };
      // followingKey stands for who you follow.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [meUid, social.service, followingKey, closeKey]),
  );
  const shown = profiles?.filter((p) => !social.blocked.has(p.uid));
  return { profiles: shown, memories, close: close.filter((id) => social.following.has(id) && !social.blocked.has(id)) };
}
