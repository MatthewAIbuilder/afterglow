import { COMMUNITY_PREFIX } from './clips';

/**
 * Public likes on shared videos, worked out from your own likes. Pure.
 *
 * Liking a video from the crowd (in Discover, Your clips or on the video
 * itself) is one like everywhere: it shapes your taste like any clip, and,
 * once you have a profile, the person who filmed it sees it. The phone keeps
 * which likes it has sent for each account, so the two stay in step: what's
 * liked and not sent is sent, what was sent and is no longer liked is taken
 * back.
 */
type Reactions = Record<string, { liked: boolean } | undefined>;

/** The shared memory behind a community clip id. */
export const sharedIdOf = (clipId: string) => (clipId.startsWith(COMMUNITY_PREFIX) ? clipId.slice(COMMUNITY_PREFIX.length) : undefined);

/** Community clips you like that should be public: clip id -> who shared it (never yourself). */
export function wantedLikes(reactions: Reactions, owners: Record<string, string>, me: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [id, r] of Object.entries(reactions)) {
    const owner = owners[id];
    if (r?.liked && owner && owner !== me && sharedIdOf(id)) out.set(id, owner);
  }
  return out;
}

/** What to send and take back so the public likes match `wanted`. */
export function likeChanges(wanted: Map<string, string>, sent: ReadonlySet<string>): { like: [string, string][]; unlike: string[] } {
  return {
    like: [...wanted].filter(([id]) => !sent.has(id)),
    unlike: [...sent].filter((id) => !wanted.has(id)),
  };
}

/** Bounded lists, newest last. */
export const OWNERS_MAX = 500;
export function withOwner(owners: Record<string, string>, clipId: string, uid: string): Record<string, string> {
  if (owners[clipId] === uid) return owners;
  const next = { ...owners };
  delete next[clipId];
  next[clipId] = uid;
  const keys = Object.keys(next);
  for (const k of keys.slice(0, Math.max(0, keys.length - OWNERS_MAX))) delete next[k];
  return next;
}
