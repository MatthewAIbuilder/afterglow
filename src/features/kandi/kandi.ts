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
  /** Who it's for. */
  to: string;
  /** The letter beads, upper case. */
  word: string;
  /** Its bead pattern (`PATTERNS`). */
  beads: PatternId;
  /** Only the person it's for reads this. */
  note?: string;
  /** When it reached them (ISO). */
  createdAt: string;
};

export type KandiInput = { to: string; word: string; beads: PatternId; note?: string };

/** At most this many letter beads. */
export const WORD_MAX = 12;
export const NOTE_MAX = 140;

export type PatternId = 'rainbow' | 'pastel' | 'neon' | 'uv' | 'sunset' | 'ocean' | 'mono' | 'candy';

/** Bead patterns: the colours repeat round the bracelet. */
export const PATTERNS: readonly { id: PatternId; name: string; colors: readonly string[] }[] = [
  { id: 'rainbow', name: t('Rainbow'), colors: ['#FF4F6E', '#FF9A3D', '#FFE14D', '#5BE37A', '#4FB6FF', '#9B6BFF'] },
  { id: 'pastel', name: t('Pastel'), colors: ['#FFC4DD', '#FFE6A8', '#C4F2D2', '#C4E2FF', '#E2CCFF'] },
  { id: 'neon', name: t('Neon'), colors: ['#39FF88', '#FF2FD6', '#2FE4FF', '#FFF23A'] },
  { id: 'uv', name: t('UV glow'), colors: ['#C6FF3A', '#FF6AD5', '#7A5CFF', '#3AFFF0'] },
  { id: 'sunset', name: t('Sunset'), colors: ['#FF5E7E', '#FF8A4C', '#FFC24A', '#B5289E'] },
  { id: 'ocean', name: t('Ocean'), colors: ['#1FB7C9', '#3F7BFF', '#9FE8FF', '#1E3FA8'] },
  { id: 'mono', name: t('Black and white'), colors: ['#F4F4F6', '#1A1A22'] },
  { id: 'candy', name: t('Candy'), colors: ['#FF6AA8', '#FFFFFF', '#6AD7FF', '#FFFFFF'] },
];

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
  if (typeof o.from !== 'string' || typeof o.to !== 'string' || !word || !isPattern(o.beads)) return undefined;
  const note = cleanNote(o.note);
  return { id, from: o.from, to: o.to, word, beads: o.beads, createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date(0).toISOString(), ...(note ? { note } : {}) };
}

/** Kandi as visitors see it in a garden: the word, the beads and who made it (never the note). */
export type PublicKandi = { word: string; beads: PatternId; from?: string };
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
    out.push({ word, beads: o.beads, ...(from ? { from } : {}) });
  }
  return out;
}
