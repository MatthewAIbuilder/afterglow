import type { Artist, Festival } from '../../data/models';
import { whereWhen } from '../festivals/format';
import { t, tn } from '../../i18n';

/**
 * What goes out when you share a festival or an artist: a line or two a
 * friend can read in a message, then the link to the page on the website
 * (which opens in the app too). Pure.
 */
export const festivalUrl = (webUrl: string, id: string) => `${webUrl}/festival/${id}`;
export const artistUrl = (webUrl: string, id: string) => `${webUrl}/artist/${id}`;

/** "EDC Orlando 2026, Nov 6 to 8, Tinker Field, Orlando" + "110 acts on the lineup" + link. */
export function festivalShareText(festival: Festival, webUrl: string): string {
  const acts = festival.lineup.length;
  return [
    `${festival.name}, ${whereWhen(festival)}`,
    acts ? tn(acts, '{n} act on the lineup. Find your sets on Afterglow:', '{n} acts on the lineup. Find your sets on Afterglow:') : t('On Afterglow:'),
    festivalUrl(webUrl, festival.id),
  ].join('\n');
}

/** "SUBTRONICS on Afterglow" + "Playing Cyclops Cove 4 and Countdown NYE 2026" + link. */
export function artistShareText(artist: Artist, festivals: Festival[], webUrl: string): string {
  const names = festivals.map((f) => f.name);
  const playing =
    names.length === 0
      ? undefined
      : names.length === 1
        ? t('Playing {festival}', { festival: names[0] })
        : names.length === 2
          ? t('Playing {festival1} and {festival2}', { festival1: names[0], festival2: names[1] })
          : t('Playing {festivals} and {n} more', { festivals: names.slice(0, 2).join(', '), n: names.length - 2 });
  return [t('{artist} on Afterglow', { artist: artist.name }), ...(playing ? [playing] : []), artistUrl(webUrl, artist.id)].join('\n');
}
