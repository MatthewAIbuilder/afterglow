/**
 * Finding an artist on a lineup by typing part of their name. Pure.
 * Ignores case, accents and punctuation, so "adrian" finds ADRIÁN MILLS,
 * "contra" finds CØNTRA and "kiki" finds KI/KI.
 */

/** Lowercase letters and digits, words separated by single spaces. */
export function normalize(text: string) {
  return text
    .replace(/[Øø]/g, 'o')
    .replace(/&/g, ' and ')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Does the name contain what was typed? An empty search matches everyone. */
export function matchesName(name: string, query: string) {
  const q = normalize(query);
  if (!q) return true;
  const n = normalize(name);
  return n.includes(q) || n.replace(/ /g, '').includes(q.replace(/ /g, ''));
}

/** Lineups longer than this get a search field. */
export const SEARCH_FROM = 12;
