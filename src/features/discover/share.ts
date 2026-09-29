import type { Festival } from '../../data/models';

/**
 * A clip as plain text for the share sheet: who and what, a link to that
 * moment in the original video, and where to catch them live. Pure.
 */
export function clipShareText(
  artistName: string,
  clipTitle: string,
  link: string,
  festival: Festival | undefined,
  appName: string,
): string {
  const live = festival ? `Playing ${festival.name}${festival.dates ? `, ${festival.dates}` : ''}` : undefined;
  return [`${artistName}, ${clipTitle}`, link, [live, `Found on ${appName}`].filter(Boolean).join('\n')].join('\n\n');
}
