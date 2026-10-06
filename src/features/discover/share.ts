import type { Festival } from '../../data/models';
import { t } from '../../i18n';
import { datesLine } from '../festivals/format';

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
  const dates = festival && datesLine(festival);
  const live = festival
    ? dates
      ? t('Playing {festival}, {dates}', { festival: festival.name, dates })
      : t('Playing {festival}', { festival: festival.name })
    : undefined;
  return [`${artistName}, ${clipTitle}`, link, [live, t('Found on {app}', { app: appName })].filter(Boolean).join('\n')].join('\n\n');
}
