/**
 * Where real festival data comes from. See docs/catalogue.md for the
 * step-by-step guide.
 *
 * - catalogue/afterglow.json is bundled with the app. Anything in it is added
 *   to the demo data (or replaces it, with "mode": "replace").
 * - CATALOG_URL, if set, is a link to a catalogue file you host yourself (for
 *   example the "Raw" link of a file on GitHub). The app checks it each time
 *   it starts, keeps the last good copy for when you're offline, and never
 *   lets a broken file replace good data. Must start with https://.
 *   Leave it empty to use only the bundled file.
 *
 * It points at the website's catalogue.json, which the website's nightly
 * build fills with festivals from EDMTrain (docs/events-import.md). Festivals
 * in catalogue/afterglow.json always win over it.
 */
export const CATALOG_URL: string = 'https://afterglowmusic.web.app/catalogue.json';

/** Give up on the hosted file after this long and keep what the app has. */
export const CATALOG_TIMEOUT_MS = 8000;
