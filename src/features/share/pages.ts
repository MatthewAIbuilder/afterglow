import type { Artist, Festival } from '../../data/models';
import { whereWhen } from '../festivals/format';

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
    acts ? `${acts} ${acts === 1 ? 'act' : 'acts'} on the lineup. Find your sets on Afterglow:` : 'On Afterglow:',
    festivalUrl(webUrl, festival.id),
  ].join('\n');
}

/** "SUBTRONICS on Afterglow" + "Playing Cyclops Cove 4 and Countdown NYE 2026" + link. */
export function artistShareText(artist: Artist, festivals: Festival[], webUrl: string): string {
  const names = festivals.map((f) => f.name);
  const playing =
    names.length === 0 ? undefined : names.length <= 2 ? `Playing ${names.join(' and ')}` : `Playing ${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
  return [`${artist.name} on Afterglow`, ...(playing ? [playing] : []), artistUrl(webUrl, artist.id)].join('\n');
}
