import type { Activity } from '../social/models';
import type { Notice } from './inbox';

/**
 * New followers, and likes and comments on your videos, as bell notices. Pure. People you
 * blocked, and people whose profile couldn't be found (a deleted account),
 * are left out. Likes on the same video come together: "@sam and 2 others
 * liked your video of HEDEX". Newest first.
 */
export type ActivityLookups = {
  /** @handle for a person, if they still have a profile. */
  handleOf: (uid: string) => string | undefined;
  /** What a video of yours is of ("your video of HEDEX"), if known. */
  videoOf: (memoryId: string) => string | undefined;
  blocked: ReadonlySet<string>;
};

export function activityNotices(items: Activity[], look: ActivityLookups): Notice[] {
  const out: { at: string; notice: Notice }[] = [];
  const likesByVideo = new Map<string, { handles: string[]; ids: string[]; at: string }>();
  for (const a of items) {
    const handle = look.handleOf(a.from);
    if (!handle || look.blocked.has(a.from)) continue;
    if (a.kind === 'follow') {
      out.push({ at: a.createdAt, notice: { id: `follow:${a.id}`, kind: 'follow', title: `@${handle} started following you`, body: 'See their profile, and follow back if you like.', href: `/u/${handle}` } });
    } else if (a.kind === 'comment') {
      const what = look.videoOf(a.memoryId) ?? 'your video';
      const said = a.text.length > 80 ? `${a.text.slice(0, 79).trimEnd()}…` : a.text;
      out.push({ at: a.createdAt, notice: { id: `comment:${a.id}`, kind: 'comment', title: `@${handle} commented on ${what}`, body: `“${said}”`, href: `/comments/${a.memoryId}` } });
    } else {
      const g = likesByVideo.get(a.memoryId) ?? { handles: [], ids: [], at: a.createdAt };
      if (!g.handles.includes(handle)) g.handles.push(handle);
      g.ids.push(a.id);
      if (a.createdAt > g.at) g.at = a.createdAt;
      likesByVideo.set(a.memoryId, g);
    }
  }
  for (const [memoryId, g] of likesByVideo) {
    const [first, ...rest] = g.handles;
    const who = rest.length ? `@${first} and ${rest.length === 1 ? `@${rest[0]}` : `${rest.length} others`}` : `@${first}`;
    const what = look.videoOf(memoryId) ?? 'your video';
    // The id follows the newest like, so a new like on the same video is news again.
    out.push({ at: g.at, notice: { id: `like:${memoryId}:${g.ids[0]}`, kind: 'like', title: `${who} liked ${what}`, body: 'Tap to watch it.', href: `/shared/${memoryId}` } });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).map((x) => x.notice);
}
