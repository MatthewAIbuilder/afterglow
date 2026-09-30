import { useEffect, useMemo, useRef, useState } from 'react';
import { useCommunity } from '../../state/community';
import { useReactions } from '../../state/reactions';
import { useSocial } from '../../state/social';
import { likeChanges, sharedIdOf, wantedLikes } from './likes';

/**
 * Keeps your public likes in step with your likes on videos from the crowd:
 * one change at a time, only once you're signed in with a profile, and only
 * after everything saved on the phone has loaded. A change that fails (the
 * video is gone, its owner blocked you, no connection) isn't tried again until
 * the app next opens. Renders nothing.
 */
export function LikeSync() {
  const social = useSocial();
  const { reactions, hydrated: reactionsLoaded } = useReactions();
  const { owners, sent, markSent, hydrated } = useCommunity();
  const me = social.profile ? social.user?.uid : undefined;
  const ready = !!me && reactionsLoaded && hydrated;
  const wanted = useMemo(() => (me ? wantedLikes(reactions, owners, me) : new Map<string, string>()), [reactions, owners, me]);
  const mine = useMemo(() => new Set(me ? (sent[me] ?? []) : []), [sent, me]);
  const busy = useRef(false);
  const failed = useRef<Set<string>>(new Set());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!ready || !me || busy.current) return;
    const changes = likeChanges(wanted, mine);
    const like = changes.like.filter(([id]) => !failed.current.has(id));
    const unlike = changes.unlike.filter((id) => !failed.current.has(id));
    const next = like.length ? { on: true as const, id: like[0][0], owner: like[0][1] } : unlike.length ? { on: false as const, id: unlike[0], owner: '' } : undefined;
    if (!next) return;
    const sharedId = sharedIdOf(next.id)!;
    busy.current = true;
    (next.on ? social.service.like(sharedId, next.owner) : social.service.unlike(sharedId))
      .then(() => markSent(me, next.id, next.on))
      .catch(() => failed.current.add(next.id))
      .finally(() => {
        busy.current = false;
        setTick((t) => t + 1);
      });
  }, [ready, me, wanted, mine, social.service, markSent, tick]);

  return null;
}
