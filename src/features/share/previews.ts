import type { Artist, Festival } from '../../data/models';
import { anyPhoto } from '../../data/members';

/**
 * Link previews for shared festival and artist pages. The website is one
 * page that draws everything in the browser, so a link preview (Messages,
 * WhatsApp, Instagram…) only ever saw "Afterglow". At build time
 * scripts/page-previews.ts writes a copy of that page for each festival and
 * artist with its own title and description; the app itself is unchanged.
 * Pure. Always English: it runs in Node at build time (no app language, and
 * nothing from `src/i18n`, which needs React Native), so it doesn't use
 * `whereWhen` from festivals/format.
 */
export type PagePreview = {
  path: string;
  title: string;
  description: string;
  url: string;
  image?: string;
  /** The image is a wide 1200 × 630 card (keeps the big preview); otherwise a square photo. */
  wide?: { alt: string };
};

/** "Nov 6 to 8, Tinker Field, Orlando": the catalogue's own words. */
const whereWhen = (festival: Pick<Festival, 'dates' | 'location'>) => [festival.dates, festival.location].filter(Boolean).join(', ');

const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

export function festivalPreview(festival: Festival, webUrl: string): PagePreview {
  const acts = festival.lineup.length;
  const where = whereWhen(festival);
  return {
    path: `festival/${festival.id}`,
    title: `${festival.name} · Afterglow`,
    description: cut(
      [where, acts ? `${acts} ${acts === 1 ? 'act' : 'acts'} on the lineup. Find your sets on Afterglow.` : 'On Afterglow.'].filter(Boolean).join(' · '),
      200,
    ),
    url: `${webUrl}/festival/${festival.id}`,
  };
}

export function artistPreview(artist: Artist, festivals: Festival[], webUrl: string): PagePreview {
  const names = festivals.map((f) => f.name);
  const playing =
    names.length === 0 ? '' : names.length <= 2 ? `Playing ${names.join(' and ')}. ` : `Playing ${names.slice(0, 2).join(', ')} and ${names.length - 2} more. `;
  return {
    path: `artist/${artist.id}`,
    title: `${artist.name} · Afterglow`,
    description: cut(`${playing}Live sets and where they play, on Afterglow.`, 200),
    url: `${webUrl}/artist/${artist.id}`,
    ...(anyPhoto(artist) ? { image: anyPhoto(artist) } : {}),
  };
}

/** Sprout links (`/sprout/<id>?…`): every one gets the same page, saying a sprout is waiting. */
export function sproutPreview(webUrl: string): PagePreview {
  return {
    path: 'sprout',
    title: 'A sprout for you · Afterglow',
    description: 'Someone gave you a sprout on Afterglow. Open it to keep it in your garden.',
    url: `${webUrl}/sprout`,
    image: `${webUrl}/sprout-og.png`,
    wide: { alt: 'A little green sprout with a heart: a sprout for you on Afterglow.' },
  };
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The site's page with this preview's title, description and address in place of the site-wide ones. */
export function withPreview(html: string, p: PagePreview): string {
  const meta = (attr: 'property' | 'name', key: string, value: string) => (doc: string) =>
    doc.replace(new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`), (_m, a: string, b: string) => `${a}${escape(value)}${b}`);
  return [
    (doc: string) => doc.replace(/<title>[^<]*<\/title>/, `<title>${escape(p.title)}</title>`),
    meta('name', 'description', p.description),
    meta('property', 'og:title', p.title),
    meta('property', 'og:description', p.description),
    meta('property', 'og:url', p.url),
    // The artist's photo in place of the site picture (a square, so no fixed size).
    (doc: string) =>
      p.image && p.wide
        ? meta('property', 'og:image:alt', p.wide.alt)(meta('property', 'og:image', p.image)(doc))
        : p.image
        ? meta('property', 'og:image', p.image)(doc)
            .replace(/\s*<meta property="og:image:(width|height|alt)" content="[^"]*" \/>/g, '')
            .replace(/(<meta name="twitter:card" content=")[^"]*(")/, '$1summary$2')
        : doc,
  ].reduce((doc, f) => f(doc), html);
}
