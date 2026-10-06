/**
 * Event organizers who start out on Afterglow with a ready page: HQ's
 * Organizers tab sets one up from here with a tap (its page, and the email
 * that may sign in to its studio). Only what the organizer published
 * themselves (their name, site and Instagram); their events, lineups and
 * words are added by them in the studio.
 *
 * `loginEmail` is a test login while the organizer's own account isn't ready:
 * a "+" address on the support Gmail, so the confirmation email lands in the
 * support inbox. HQ changes it to the organizer's real email later (no app
 * update needed). See docs/organizers.md.
 */
export type OrgStarter = {
  id: string;
  name: string;
  tagline: string;
  website?: string;
  instagram?: string;
  /** A logo drawn by the app (features/organizers/OrgMark.tsx). */
  mark?: 'alchemy';
  /** The brand's own colour, for its page. */
  color?: string;
  loginEmail: string;
};

export const ORG_STARTERS: readonly OrgStarter[] = [
  {
    id: 'underground-alchemy',
    name: 'Underground Alchemy',
    tagline: 'After parties',
    website: 'https://undergroundalchemy.net',
    instagram: 'underground.alchemy',
    mark: 'alchemy',
    color: '#E9E6F2',
    loginEmail: 'afterglowmusic.support+alchemy@gmail.com',
  },
];
