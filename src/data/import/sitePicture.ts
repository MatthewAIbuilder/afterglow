/**
 * The picture a festival's official site shares (its "og:image": what shows
 * when the link is pasted into a message). Often the lineup poster or the
 * festival's key art. Read by the nightly job (scripts/site-pictures.ts) from
 * the festival's `website` link; chosen by the owner on 2026-10-01. Pure.
 */

/** Most of a page read, in characters: the share picture is in its head. */
export const PAGE_MAX_CHARS = 1_500_000;

const META = /<meta\b[^>]*>/gi;
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
const value = (m: RegExpMatchArray | null) => (m ? (m[2] ?? m[3] ?? m[4] ?? '') : undefined);
const unescape = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&#x2F;/gi, '/')
    .replace(/&#47;/g, '/')
    .replace(/&quot;/g, '"')
    .trim();

/** Which share tags to trust, best first. */
const KEYS = ['og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'];

/**
 * The page's share picture as an https link (relative links resolved against
 * the page), or undefined when it has none, it isn't https, or it's an SVG
 * or icon rather than a picture.
 */
export function sharePicture(html: string, pageUrl: string): string | undefined {
  const found = new Map<string, string>();
  for (const tag of html.slice(0, PAGE_MAX_CHARS).match(META) ?? []) {
    const key = (value(attr(tag, 'property')) ?? value(attr(tag, 'name')))?.toLowerCase();
    const content = value(attr(tag, 'content'));
    if (key && content && KEYS.includes(key) && !found.has(key)) found.set(key, unescape(content));
  }
  for (const key of KEYS) {
    const raw = found.get(key);
    if (!raw) continue;
    let url: URL;
    try {
      url = new URL(raw, pageUrl);
    } catch {
      continue;
    }
    if (url.protocol !== 'https:') continue;
    if (/\.(svg|ico)$/i.test(url.pathname) || /favicon|apple-touch-icon/i.test(url.pathname)) continue;
    return url.toString();
  }
  return undefined;
}

/** The site's name for crediting the picture: "orlando.edc.com" from "https://www.orlando.edc.com/tickets". */
export const siteName = (link: string): string | undefined => {
  try {
    return new URL(link).hostname.replace(/^www\./, '') || undefined;
  } catch {
    return undefined;
  }
};
