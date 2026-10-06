import { SUPPORT_EMAIL } from '../../config/app';
import { shortCount } from '../profile/profileView';

/**
 * Words for profiles, in one place. The guidelines are what everyone agrees
 * to when creating a profile (the App Store asks apps with shared content for
 * terms people accept, a way to report, a way to block, and a contact).
 */
export const GUIDELINES: string[] = [
  'Share only videos you filmed yourself.',
  'Keep it friendly: no hate, harassment, threats or explicit content.',
  'No spam, and don’t pretend to be someone else.',
  'Report anything that breaks these, and block anyone you don’t want to see. Reports are reviewed, and accounts that break the guidelines are removed.',
];

export const contactLine = () => (SUPPORT_EMAIL ? `Questions or problems: ${SUPPORT_EMAIL}` : undefined);

/** "Going to EDC Orlando 2026 and ACL 2026", "Going to 3 festivals". */
export function goingLine(names: string[]): string | undefined {
  if (!names.length) return undefined;
  if (names.length > 3) return `Going to ${names.length} festivals`;
  return `Going to ${names.length < 2 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`}`;
}

/** "1 follower", "12 followers". */
export const followersLabel = (n: number) => `${n} ${n === 1 ? 'follower' : 'followers'}`;
/** "3 following". */
export const followingLabel = (n: number) => `${n} following`;
/** "1 like", "12 likes". */
export const likesLabel = (n: number) => `${n} ${n === 1 ? 'like' : 'likes'}`;
export const commentsLabel = (n: number) => `${n} ${n === 1 ? 'comment' : 'comments'}`;
/** Under the speech bubble in Discover: how many ("12", "1.2K"), or the word when there are none yet (or it isn't known). */
export const commentCaption = (n?: number) => (n ? shortCount(n) : 'Comment');
