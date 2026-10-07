/**
 * Organizers' official logos shipped with the app (what they sent), until
 * they upload their own in the studio (`logoUrl`, `iconUrl` win). `logo` is
 * the wide wordmark (white on clear, for the night), `icon` a square mark for
 * round places (their profile face, rows, cards); `ratio` is the logo's width
 * over its height.
 */
export type OrgAssets = { logo: number; icon: number; ratio: number };

export const ORG_ASSETS: Record<string, OrgAssets> = {
  // Underground Alchemy's official logo (the user sent it on 2026-10-07): the flask with sparkles beside the wordmark.
  'underground-alchemy': {
    logo: require('../../../assets/organizers/underground-alchemy-logo.png'),
    icon: require('../../../assets/organizers/underground-alchemy-icon.png'),
    ratio: 1920 / 600,
  },
};
