import type { Activity } from '../social/models';
import type { Notice } from './inbox';
import { t } from '../../i18n';

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
      out.push({ at: a.createdAt, notice: { at: Date.parse(a.createdAt) || undefined, id: `follow:${a.id}`, kind: 'follow', title: t('@{handle} started following you', { handle }), body: t('See their profile, and follow back if you like.'), href: `/u/${handle}` } });
    } else if (a.kind === 'tag') {
      out.push({ at: a.createdAt, notice: { at: Date.parse(a.createdAt) || undefined, id: `tag:${a.id}`, kind: 'tag', title: t('@{handle} tagged you in a video', { handle }), body: t('It’s on your profile under Tagged. Open it to watch, or hide it.'), href: `/shared/${a.memoryId}` } });
    } else if (a.kind === 'comment') {
      const what = look.videoOf(a.memoryId) ?? t('your video');
      const said = a.text.length > 80 ? `${a.text.slice(0, 79).trimEnd()}…` : a.text;
      out.push({ at: a.createdAt, notice: { at: Date.parse(a.createdAt) || undefined, id: `comment:${a.id}`, kind: 'comment', title: t('@{handle} commented on {what}', { handle, what }), body: `“${said}”`, href: `/comments/${a.memoryId}` } });
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
    const who = !rest.length
      ? `@${first}`
      : rest.length === 1
        ? t('@{first} and @{second}', { first, second: rest[0] })
        : t('@{first} and {n} others', { first, n: rest.length });
    const what = look.videoOf(memoryId) ?? t('your video');
    // The id follows the newest like, so a new like on the same video is news again.
    out.push({ at: g.at, notice: { at: Date.parse(g.at) || undefined, id: `like:${memoryId}:${g.ids[0]}`, kind: 'like', title: t('{who} liked {what}', { who, what }), body: t('Tap to watch it.'), href: `/shared/${memoryId}` } });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).map((x) => x.notice);
}
