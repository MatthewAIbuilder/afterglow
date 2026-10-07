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
  /** The @handle its accounts' profiles use. */
  handle: string;
  /**
   * Its username on EDMTrain, for reference. EDMTrain's event feed doesn't
   * say who posted an event, so its events there are found by name and
   * venue in the studio (On EDMTrain), not by this.
   */
  edmtrain?: string;
  /**
   * Events it hosted that were found on its own public ticket pages (each
   * with that page as `source`): exactly what the page says, nothing
   * guessed (no lineup when none was listed; no town when none was given).
   * HQ or its team adds them to its page with a tap (`foundEvents`).
   */
  pastEvents?: readonly FoundEvent[];
};

/** An event found on an organizer's public ticket page. */
export type FoundEvent = { name: string; date: string; venue: string; city: string; source: string };

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
    handle: 'undergroundalchemy',
    edmtrain: 'u-alchemy',
    // From its Posh pages (posh.vip/g/events-by-undergroundalchemy), found 2026-10-07.
    pastEvents: [
      { name: 'Underground Alchemy Presents: A Halloween Forest Rave', date: '2024-10-26', venue: '1401 C CO RD 13', city: 'Orlando, FL', source: 'https://posh.vip/e/halloween-forest-rave-2' },
      { name: 'Journey', date: '2025-04-25', venue: '', city: '', source: 'https://posh.vip/e/journey-1' },
      { name: 'Afterglow - Festival Afterparty 18+', date: '2025-11-07', venue: '4910 Edgewater Dr', city: 'Orlando, FL', source: 'https://posh.vip/e/wizards-dungeon-edc-afters' },
      { name: "Back to 80's (An 80's themed No-Phones EDM party)", date: '2026-01-24', venue: 'Space Underground', city: '', source: 'https://posh.vip/e/back-to-80s-an-80s-themed-edm-party' },
      // Presented with Vivid Vybz.
      { name: 'After The Kingdom', date: '2026-04-26', venue: 'Space Underground', city: '', source: 'https://posh.vip/e/after-the-kingdom-1' },
    ],
  },
];
