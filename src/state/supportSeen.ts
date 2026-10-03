import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { useSocial } from './social';
import { unseenReplies } from '../features/admin/admin';
import type { SupportMessage } from '../features/social/models';

const KEY = 'supportSeen.v1';

/**
 * Your messages to support and how many replies you haven't seen (kept on
 * the phone: AsyncStorage `supportSeen.v1`, when you last looked). `seen()`
 * marks them read.
 */
export function useMySupport() {
  const social = useSocial();
  const signedIn = social.availability.ok && !!social.user;
  const [list, setList] = useState<SupportMessage[] | undefined>();
  const [seenAt, setSeenAt] = useState<number | undefined>();
  const load = useCallback(async () => {
    if (!signedIn) return;
    try {
      setList(await social.service.mySupport(50));
    } catch {
      // Keep what we had.
    }
  }, [signedIn, social.service]);
  useEffect(() => {
    void Promise.resolve().then(load);
    AsyncStorage.getItem(KEY)
      .then((v) => setSeenAt(Number(v) || 0))
      .catch(() => setSeenAt(0));
  }, [load]);
  const seen = useCallback(() => {
    const t = Date.now();
    setSeenAt(t);
    AsyncStorage.setItem(KEY, String(t)).catch(() => {});
  }, []);
  return { list, load, unseen: list && seenAt !== undefined ? unseenReplies(list, seenAt) : 0, seen };
}
