import { useEffect, useSyncExternalStore } from 'react';
import { useSocial } from '../../state/social';
import { type CommentTarget, doneAsking, knownCommentCount, rememberCommentCount, shouldAsk, subscribe } from './commentCounts';

/**
 * The number of comments on a clip, or undefined until read (and when signed out, or profiles aren't
 * set up). Read when `enabled` (the card is on screen or next to it). Re-renders only when this count changes.
 */
export function useCommentCount(target: CommentTarget | undefined, enabled: boolean): number | undefined {
  const social = useSocial();
  const ok = social.availability.ok && !!social.user;
  const kind = target?.kind;
  const id = target?.id;
  const count = useSyncExternalStore(subscribe, () => (kind && id ? knownCommentCount({ kind, id }) : undefined));
  useEffect(() => {
    if (!ok || !enabled || !kind || !id) return;
    const t = { kind, id };
    if (!shouldAsk(t)) return;
    (kind === 'clip' ? social.service.clipCommentCount(id) : social.service.commentCount(id))
      .then((n) => rememberCommentCount(t, n))
      .catch(() => {})
      .finally(() => doneAsking(t));
  }, [ok, enabled, kind, id, social.service]);
  return ok ? count : undefined;
}
