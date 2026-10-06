import { WEB_URL } from '../../config/app';
import { t } from '../../i18n';

/**
 * Friend codes, pure: what a QR code says and how a scanned one is read.
 *
 * A code is a link (so a phone's own camera opens the website, which can add
 * you too) carrying everything needed to add someone with no signal: their
 * account id, @handle and first name, and their private friend code. The
 * friend code is what lets the scanner make the friendship both ways: only
 * someone who saw your code can, and a new code makes old ones stop working.
 */

export type FriendCard = {
  uid: string;
  handle: string;
  /** Their name as shown on the code (may be cut short). */
  name: string;
  /** Their private friend code. */
  code: string;
};

/** Friend codes are this many characters from `CODE_CHARS`. */
export const CODE_LENGTH = 12;
const CODE_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789';
/** Names on a code are cut to this many characters (the code stays small and easy to scan). */
export const CODE_NAME_MAX = 24;

const UID = /^[A-Za-z0-9_-]{1,128}$/;
const HANDLE = /^[a-z0-9._]{3,20}$/;
const CODE = /^[a-z0-9]{8,32}$/;

/** A new private friend code from random bytes (one character per byte). */
export function codeFrom(bytes: ArrayLike<number>): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_CHARS[(bytes[i] ?? 0) % CODE_CHARS.length];
  return out;
}

export const isFriendCode = (code: unknown): code is string => typeof code === 'string' && CODE.test(code);

/** The link a QR code shows: `https://afterglowmusic.app/add/sam?u=…&c=…&n=Sam`. */
export function friendLink(card: FriendCard, base = WEB_URL): string {
  const name = card.name.trim().slice(0, CODE_NAME_MAX);
  const q = `u=${encodeURIComponent(card.uid)}&c=${encodeURIComponent(card.code)}${name ? `&n=${encodeURIComponent(name)}` : ''}`;
  return `${base.replace(/\/+$/, '')}/add/${encodeURIComponent(card.handle)}?${q}`;
}

/** The parts of a link's address, or the route params of `/add/[handle]`. */
export function cardFrom(parts: { handle?: unknown; u?: unknown; c?: unknown; n?: unknown }): FriendCard | undefined {
  const handle = typeof parts.handle === 'string' ? parts.handle.trim().toLowerCase().replace(/^@/, '') : '';
  const uid = typeof parts.u === 'string' ? parts.u : '';
  const code = typeof parts.c === 'string' ? parts.c : '';
  if (!HANDLE.test(handle) || !UID.test(uid) || !CODE.test(code)) return undefined;
  const name = typeof parts.n === 'string' ? parts.n.replace(/\s+/g, ' ').trim().slice(0, CODE_NAME_MAX) : '';
  return { uid, handle, code, name: name || handle };
}

/**
 * What a scanned QR code says, if it's an Afterglow friend code (from any
 * Afterglow address, or the app's own `afterglow://add/…` link). Anything
 * else (a ticket, a menu, a website) is undefined.
 */
export function readFriendLink(text: string): FriendCard | undefined {
  const m = /^(?:https:\/\/(?:www\.)?(?:afterglowmusic\.app|afterglowmusic\.web\.app)|afterglow:\/)\/add\/([^/?#]+)\?([^#]*)$/i.exec(text.trim());
  if (!m) return undefined;
  const params: Record<string, string> = {};
  for (const pair of m[2].split('&')) {
    const i = pair.indexOf('=');
    if (i <= 0) continue;
    try {
      params[pair.slice(0, i)] = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
    } catch {
      return undefined;
    }
  }
  let handle: string;
  try {
    handle = decodeURIComponent(m[1]);
  } catch {
    return undefined;
  }
  return cardFrom({ handle, u: params.u, c: params.c, n: params.n });
}

/** A QR code's dark squares, row by row, from the encoder's flat list. */
export type QrGrid = { size: number; dark: (x: number, y: number) => boolean };

/** True for the three big corner squares, which a styled code draws on its own. */
export function isFinder(size: number, x: number, y: number): boolean {
  return (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
}

/** Top-left corners of the three finder squares. */
export const finders = (size: number): [number, number][] => [
  [0, 0],
  [size - 7, 0],
  [0, size - 7],
];

/** True inside the middle hole left for a face (error correction H covers up to about a quarter). */
export function inCentre(size: number, x: number, y: number, hole: number): boolean {
  const lo = Math.floor((size - hole) / 2);
  return x >= lo && x < lo + hole && y >= lo && y < lo + hole;
}

/**
 * Looks: deep dots that still scan well on the light card (`dots`, top-left
 * to bottom-right) and a bright glow around it (`glow`).
 */
export const CODE_THEMES = {
  glow: { label: t('Glow'), dots: ['#4B22B8', '#B0185A'], glow: ['#A97CFF', '#FF7EB6'] },
  sunset: { label: t('Sunset'), dots: ['#B0185A', '#C2410C'], glow: ['#FF7EB6', '#FFB86B'] },
  ocean: { label: t('Ocean'), dots: ['#0B5C9E', '#4B22B8'], glow: ['#6FC3FF', '#A97CFF'] },
  aurora: { label: t('Aurora'), dots: ['#0B7A5E', '#0B5C9E'], glow: ['#5BE3B5', '#6FC3FF'] },
} as const;
export type CodeTheme = keyof typeof CODE_THEMES;
export const THEME_ORDER = Object.keys(CODE_THEMES) as CodeTheme[];
export const isTheme = (t: unknown): t is CodeTheme => typeof t === 'string' && t in CODE_THEMES;
