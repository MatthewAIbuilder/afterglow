import { WEB_URL } from '../../config/app';
import { t } from '../../i18n';

/**
 * Kandi: friendship bracelets, like the ones traded at shows. Pony beads in
 * a pattern, letter beads spelling a short word ("PLUR", "BESTIES", "♥"),
 * and a note only the person you give it to reads. Left in their garden,
 * where it hangs for anyone visiting to see (the word and beads, never the
 * note). Pure.
 */
export type Kandi = {
  id: string;
  /** Who made it. */
  from: string;
  /** Who it's for ('' for kandi given by code that nobody has picked up yet). */
  to: string;
  /** The letter beads, upper case. */
  word: string;
  /** Its bead pattern (`PATTERNS`). */
  beads: PatternId;
  /** Only the person it's for reads this. */
  note?: string;
  /** A charm hanging from it (`CHARMS`). */
  charm?: CharmId;
  /** When it reached them (ISO). */
  createdAt: string;
};

export type KandiInput = { to: string; word: string; beads: PatternId; note?: string; charm?: CharmId };
/** Kandi given by code (a QR to scan or a link): for whoever picks it up first. Its id is made on the phone, so the code shows straight away. */
export type OpenKandiInput = { id: string; word: string; beads: PatternId; note?: string; charm?: CharmId };

/** At most this many letter beads. */
export const WORD_MAX = 12;
export const NOTE_MAX = 140;

export type PatternId = 'rainbow' | 'pastel' | 'neon' | 'uv' | 'sunset' | 'ocean' | 'mono' | 'candy' | 'glow' | 'galaxy' | 'pride' | 'gold' | 'fire';

/** Bead patterns: the colours repeat round the bracelet. Some glow in the dark, some sparkle, some shine like metal. */
export const PATTERNS: readonly { id: PatternId; name: string; colors: readonly string[]; glow?: true; sparkle?: true; metal?: true }[] = [
  { id: 'rainbow', name: t('Rainbow'), colors: ['#FF4F6E', '#FF9A3D', '#FFE14D', '#5BE37A', '#4FB6FF', '#9B6BFF'] },
  { id: 'pastel', name: t('Pastel'), colors: ['#FFC4DD', '#FFE6A8', '#C4F2D2', '#C4E2FF', '#E2CCFF'] },
  { id: 'neon', name: t('Neon'), colors: ['#39FF88', '#FF2FD6', '#2FE4FF', '#FFF23A'] },
  { id: 'uv', name: t('UV glow'), colors: ['#C6FF3A', '#FF6AD5', '#7A5CFF', '#3AFFF0'] },
  { id: 'sunset', name: t('Sunset'), colors: ['#FF5E7E', '#FF8A4C', '#FFC24A', '#B5289E'] },
  { id: 'ocean', name: t('Ocean'), colors: ['#1FB7C9', '#3F7BFF', '#9FE8FF', '#1E3FA8'] },
  { id: 'mono', name: t('Black and white'), colors: ['#F4F4F6', '#1A1A22'] },
  { id: 'candy', name: t('Candy'), colors: ['#FF6AA8', '#FFFFFF', '#6AD7FF', '#FFFFFF'] },
  { id: 'glow', name: t('Glow in the dark'), colors: ['#C8FFB0', '#9AFFD8', '#E8FFB0'], glow: true },
  { id: 'galaxy', name: t('Galaxy'), colors: ['#2A1A6E', '#5A2AB0', '#1A2A7A', '#8A4ADF'], sparkle: true },
  { id: 'pride', name: t('Pride'), colors: ['#E40303', '#FF8C00', '#FFED00', '#008026', '#004DFF', '#750787', '#FFFFFF', '#FFAFC8', '#74D7EE', '#613915'] },
  { id: 'gold', name: t('Gold'), colors: ['#FFD86B', '#FFF4C8', '#C9961E'], metal: true },
  { id: 'fire', name: t('Fire'), colors: ['#FFE14D', '#FF9A3D', '#FF4F2E', '#B8142A'] },
];

/** Charms that hang from a bracelet. */
export type CharmId = 'heart' | 'star' | 'alien' | 'mushroom' | 'smiley' | 'moon';
export const CHARMS: readonly { id: CharmId; name: string }[] = [
  { id: 'heart', name: t('Heart') },
  { id: 'star', name: t('Star') },
  { id: 'alien', name: t('Alien') },
  { id: 'mushroom', name: t('Mushroom') },
  { id: 'smiley', name: t('Smiley') },
  { id: 'moon', name: t('Moon') },
];
export const isCharm = (v: unknown): v is CharmId => CHARMS.some((c) => c.id === v);

export const isPattern = (v: unknown): v is PatternId => PATTERNS.some((p) => p.id === v);
export const patternOf = (id: PatternId) => PATTERNS.find((p) => p.id === id) ?? PATTERNS[0];

/** The letters a letter bead can carry (and a heart, a star, a flower, a smile). */
const BEAD = /[A-Z0-9 ♥★✿☺!?&+.]/u;

/** Typed letters as letter beads: upper case, only what beads carry, single spaces, at most `WORD_MAX`. */
export function cleanWord(v: unknown): string {
  if (typeof v !== 'string') return '';
  const up = v.toUpperCase().replace(/[<]3/g, '♥');
  let out = '';
  for (const ch of up) if (BEAD.test(ch)) out += ch;
  return out.replace(/\s+/g, ' ').trim().slice(0, WORD_MAX);
}

export const cleanNote = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX) : '');

/** Words to start from. */
export const WORD_IDEAS: readonly string[] = ['PLUR', 'BESTIES', 'RAVE FAM', '♥', 'HEADBANG', 'BASS', 'SMILE', 'GOOD VIBES'];

/** A kandi read back: undefined when it isn't one. */
export function kandiFrom(id: string, d: unknown): Kandi | undefined {
  if (!d || typeof d !== 'object') return undefined;
  const o = d as Record<string, unknown>;
  const word = cleanWord(o.word);
  if (typeof o.from !== 'string' || (o.to !== undefined && typeof o.to !== 'string') || !word || !isPattern(o.beads)) return undefined;
  const note = cleanNote(o.note);
  return { id, from: o.from, to: typeof o.to === 'string' ? o.to : '', word, beads: o.beads, createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date(0).toISOString(), ...(note ? { note } : {}), ...(isCharm(o.charm) ? { charm: o.charm } : {}) };
}

/** Kandi as visitors see it in a garden: the word, the beads and who made it (never the note). */
/** Kandi as visitors see it in a garden; `worn` is the one shown on its owner's profile. */
export type PublicKandi = { word: string; beads: PatternId; from?: string; charm?: CharmId; worn?: true };
export const PUBLIC_KANDI_MAX = 40;

export function cleanPublicKandi(raw: unknown): PublicKandi[] {
  if (!Array.isArray(raw)) return [];
  const out: PublicKandi[] = [];
  for (const r of raw.slice(0, PUBLIC_KANDI_MAX)) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const word = cleanWord(o.word);
    if (!word || !isPattern(o.beads)) continue;
    const from = typeof o.from === 'string' && /^[a-z0-9._]{1,30}$/.test(o.from) ? o.from : undefined;
    out.push({ word, beads: o.beads, ...(from ? { from } : {}), ...(isCharm(o.charm) ? { charm: o.charm } : {}), ...(o.worn === true ? { worn: true as const } : {}) });
  }
  return out;
}

// ---- Kandi given by code --------------------------------------------------

/** A kandi code's id: 20 letters and digits, made on the phone. */
export const KANDI_ID = /^[a-z0-9]{20}$/;

export type KandiCard = { id: string; from: string; handle: string; word: string; beads: PatternId };

/** The link a kandi code carries: who made it and how it looks, so it shows before anything is read. */
export function kandiLink(card: KandiCard, base = WEB_URL): string {
  const q = `u=${encodeURIComponent(card.from)}&h=${encodeURIComponent(card.handle)}&w=${encodeURIComponent(card.word)}&b=${card.beads}`;
  return `${base.replace(/\/+$/, '')}/kandi/${card.id}?${q}`;
}

/** A card from a link's parts, or the route params of `/kandi/[id]`. */
export function kandiCardFrom(parts: { id?: unknown; u?: unknown; h?: unknown; w?: unknown; b?: unknown }): KandiCard | undefined {
  const id = typeof parts.id === 'string' ? parts.id : '';
  const from = typeof parts.u === 'string' ? parts.u : '';
  const handle = typeof parts.h === 'string' ? parts.h.trim().toLowerCase().replace(/^@/, '') : '';
  const word = cleanWord(parts.w);
  if (!KANDI_ID.test(id) || !from || from.length > 128 || !word || !isPattern(parts.b)) return undefined;
  return { id, from, handle: /^[a-z0-9._]{1,30}$/.test(handle) ? handle : '', word, beads: parts.b };
}

/** A scanned or pasted kandi link, or undefined when it isn't one. */
export function readKandiLink(text: string): KandiCard | undefined {
  const m = /^(?:https:\/\/(?:www\.)?(?:afterglowmusic\.app|afterglowmusic\.web\.app)|afterglow:\/)\/kandi\/([a-z0-9]+)\?([^#]*)$/i.exec(text.trim());
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
  return kandiCardFrom({ id: m[1], u: params.u, h: params.h, w: params.w, b: params.b });
}
