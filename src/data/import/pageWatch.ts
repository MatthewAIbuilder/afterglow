import { sharePicture } from './sitePicture';

/**
 * Watching festivals' official pages for news, pure (run every night by
 * scripts/page-watch.ts; the user asked for an automatic heads-up on
 * 2026-10-04). Nothing is imported from the page: it only notices new
 * artist names on it, set times appearing, or a new share picture (often the
 * lineup poster), and says so, so the owner can bring them in from HQ.
 */

/** What one look at a page found. */
export type PageFacts = {
  url: string;
  /** Artists Afterglow knows, named on the page but not on the festival's lineup yet. */
  names: string[];
  /** The page talks about set times and lists plenty of times. */
  setTimes: boolean;
  /** Its share picture (og:image). */
  picture?: string;
};

export type WatchState = { checkedAt: string; sites: Record<string, PageFacts> };

/** Set times are only flagged once the page shows at least this many times of day. */
export const TIMES_FOR_SET_TIMES = 6;
/** Names this short are too likely to be ordinary words on a page. */
const MIN_NAME = 4;
/** At most this many new names are listed per festival. */
export const NAMES_SHOWN = 15;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/** "&amp;", "&#39;" and the like, as the characters they stand for. */
export const decodeEntities = (s: string) => s.replace(/&(#?\w+);/g, (m, e: string) => ENTITIES[e.toLowerCase()] ?? (/^#\d+$/.test(e) ? String.fromCharCode(Number(e.slice(1))) : m));

/** A page's readable text: no scripts, styles or tags. */
export function pageText(html: string): string {
  return decodeEntities(html.replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lower case, no accents, letters and digits only: "Tiësto" and "TIESTO" match. */
export const fold = (s: string) =>
  ` ${s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;

/** The artists named on the page (whole words only), skipping those already on the lineup. */
export function namesOn(text: string, artists: readonly { id: string; name: string }[], lineup: ReadonlySet<string>): string[] {
  const page = fold(text);
  const out: string[] = [];
  for (const a of artists) {
    if (lineup.has(a.id)) continue;
    const n = fold(a.name);
    if (n.trim().replace(/ /g, '').length < MIN_NAME) continue;
    if (page.includes(n)) out.push(a.name);
  }
  return [...new Set(out)].sort((x, y) => x.localeCompare(y));
}

const TIME = /\b(?:[01]?\d|2[0-3])(?::[0-5]\d\s*(?:[ap]\.?m\.?)?|\s*[ap]\.?m\.?)(?![a-z0-9])/gi;

/** Whether the page has set times on it: it says so, and lists times of day. */
export function hasSetTimes(text: string): boolean {
  if (!/\b(set\s*times?|timetable|schedule|running order)\b/i.test(text)) return false;
  return (text.match(TIME) ?? []).length >= TIMES_FOR_SET_TIMES;
}

/** One look at a festival's page. */
export function pageFacts(html: string, url: string, artists: readonly { id: string; name: string }[], lineup: ReadonlySet<string>): PageFacts {
  const text = pageText(html);
  const picture = sharePicture(html, url);
  return { url, names: namesOn(text, artists, lineup), setTimes: hasSetTimes(text), ...(picture ? { picture } : {}) };
}

/** What's new since the last look, in plain words. The first look at a page (or a new address) says nothing. */
export function watchNotes(before: PageFacts | undefined, now: PageFacts): string[] {
  if (!before || before.url !== now.url) return [];
  const notes: string[] = [];
  const fresh = now.names.filter((n) => !before.names.includes(n));
  if (fresh.length) {
    const shown = fresh.slice(0, NAMES_SHOWN).join(', ');
    notes.push(`New names on the page, not on the lineup yet: ${shown}${fresh.length > NAMES_SHOWN ? ` and ${fresh.length - NAMES_SHOWN} more` : ''}.`);
  }
  if (now.setTimes && !before.setTimes) notes.push('Set times may be out: the page now mentions set times and lists times.');
  if (now.picture && before.picture && now.picture !== before.picture) notes.push(`Its share picture changed (often a new lineup poster): ${now.picture}`);
  return notes;
}

export type WatchNews = { id: string; name: string; url: string; notes: string[] };

/** The heads-up, as the body of a GitHub issue (which emails the owner). */
export function watchReport(news: readonly WatchNews[], hqUrl: string): string {
  const parts = news.map((n) => [`### ${n.name}`, `[Official page](${n.url})`, '', ...n.notes.map((x) => `- ${x}`)].join('\n'));
  return [
    'Afterglow’s nightly look at festivals’ official pages found something new.',
    '',
    ...parts.flatMap((p) => [p, '']),
    `To bring it in: open [Afterglow HQ](${hqUrl}) → Data, pick the festival, and paste the lineup or set times, or read a photo of them. Close this issue once it’s done.`,
  ].join('\n');
}
