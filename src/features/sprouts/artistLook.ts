import type { SoundTag } from '../../data/models';
import { t } from '../../i18n';

/**
 * How an artist's collectible looks. Pure. A small glowing creature on a dark
 * round tile: the big names have a hand-made one inspired by their world (an
 * eye with tentacles, a phoenix, a lion), never their logos; everyone else
 * gets their sound's creature (a bass beast for dubstep, a moth for melodic
 * bass, a disco cat for house…) in their own colours, from their photo.
 */
export type Creature =
  | 'eye'
  | 'phoenix'
  | 'lion'
  | 'ghost'
  | 'pumpkin'
  | 'sheep'
  | 'twin'
  | 'astronaut'
  | 'rabbit'
  | 'spirit'
  | 'crystal'
  | 'skull'
  | 'serpent'
  | 'alien'
  | 'monster'
  | 'sloth'
  | 'reaper'
  | 'jelly'
  | 'beast'
  | 'bot'
  | 'wolf'
  | 'moth'
  | 'cat'
  | 'owl'
  | 'fox'
  | 'dragon'
  | 'bear'
  | 'wisp'
  // Festival places, for stickers (features/finds).
  | 'ferris'
  | 'rail'
  | 'sunrise'
  | 'lantern'
  | 'confetti'
  | 'frog'
  // Signatures added later.
  | 'wobble'
  | 'patchbear'
  | 'thornskull'
  | 'trooper'
  | 'mammoth';

/** A creature's colours: its body (light, mid, deep), a second colour pair, its glowing details and the light around it. */
export type Palette = { light: string; mid: string; deep: string; alt: string; altDeep: string; accent: string; glow: string };

export type ArtistLook = {
  creature: Creature;
  palette: Palette;
  /** The colour that stands for it in the app (names, borders). */
  accent: string;
  /** Hand-made for this artist. */
  signature: boolean;
  /** Its name: "The Watcher". */
  name: string;
  /** One line on what it is: "A big eye with wriggling tentacles". */
  theme: string;
  /** A little extra: a crown, or fangs. */
  extra?: 'crown' | 'fangs';
};

type Spec = Omit<ArtistLook, 'signature' | 'accent'> & { accent?: string };

const P = (light: string, mid: string, deep: string, alt: string, altDeep: string, accent: string, glow: string): Palette => ({ light, mid, deep, alt, altDeep, accent, glow });

/** Hand-made collectibles, by folded artist name. */
const SIGNATURES: Record<string, Spec> = {
  subtronics: { creature: 'eye', palette: P('#F4FFE0', '#B6F05A', '#3F8F1A', '#C9A2FF', '#5B2BB0', '#B36BFF', '#9BE84E'), name: t('The Watcher'), theme: t('A big eye with wriggling tentacles') },
  illenium: { creature: 'phoenix', palette: P('#FFF3D6', '#FF9A4A', '#C2362A', '#FFE08A', '#FF5A2A', '#FFD36B', '#FF7A3D'), name: t('The Phoenix'), theme: t('A phoenix rising in flame through a starry night') },
  sevenlions: { creature: 'lion', palette: P('#FFF1C9', '#F2B84B', '#A8661C', '#FFB347', '#B8541A', '#FFE9A8', '#F2A23A'), name: t('The Lion'), theme: t('A lion with a glowing mane') },
  zedsdead: { creature: 'ghost', palette: P('#FFFFFF', '#DCD8F2', '#8C88B8', '#9BE84E', '#3E8F1A', '#B6FF6A', '#9BE84E'), name: t('The Ghost'), theme: t('A friendly ghost with glowing eyes') },
  ghengar: { creature: 'ghost', palette: P('#F1E8FF', '#A98CF0', '#4A2E8A', '#FF6AD5', '#7A1E6A', '#FF8AE0', '#A06BFF'), name: t('The Phantom'), theme: t('A grinning phantom'), extra: 'fangs' },
  rlgrime: { creature: 'pumpkin', palette: P('#FFD9A0', '#FF8A1F', '#A8400C', '#8FD65A', '#2E6A1E', '#FFE36B', '#FF8A1F'), name: t('The Lantern'), theme: t('A pumpkin lit from inside') },
  wooli: { creature: 'mammoth', palette: P('#D9A877', '#9A6438', '#4E2C14', '#F6EBD2', '#CDB68C', '#FFE9B0', '#A9D4FF'), name: t('The Mammoth'), theme: t('A shaggy woolly mammoth with great curling tusks') },
  slander: { creature: 'trooper', palette: P('#A8F4FF', '#3E6E86', '#14263A', '#D9A33A', '#7A5212', '#FF9A2E', '#5FE6FF'), name: t('The Trooper'), theme: t('An armoured trooper bursting out of hyperspace') },
  spacelaces: { creature: 'astronaut', palette: P('#F2F8FF', '#C4D6EA', '#5A6E8C', '#2D4F8A', '#0E1A3A', '#7FD3FF', '#7FC8FF'), name: t('The Astronaut'), theme: t('A little astronaut lost in space') },
  alisonwonderland: { creature: 'rabbit', palette: P('#FFFFFF', '#F2E6F2', '#B98AB0', '#FFC2E0', '#FF85C8', '#FFD24A', '#FF9AD5'), name: t('The White Rabbit'), theme: t('A white rabbit, always late') },
  ofthetrees: { creature: 'spirit', palette: P('#F4F8EA', '#D6DEC4', '#8A9472', '#8FD67A', '#2E6A2A', '#E9FFB0', '#7FD87A'), name: t('The Forest spirit'), theme: t('A spirit of the forest') },
  sanholo: { creature: 'crystal', palette: P('#F2FFFD', '#B9A8FF', '#6A4FD0', '#FF9EDB', '#3FC8E0', '#9FF0FF', '#B99CFF'), name: t('The Prism'), theme: t('A holographic crystal') },
  sullivanking: { creature: 'thornskull', palette: P('#F4EEE6', '#D6CABD', '#6E5F58', '#C8344A', '#8A1E30', '#FF4A5E', '#E0324A'), name: t('The Thorn King'), theme: t('A grinning skull crowned with thorns and roses') },
  zomboy: { creature: 'skull', palette: P('#F4F7E8', '#C9D6A8', '#5E7A3A', '#A6E05A', '#2E4A1A', '#B6FF5A', '#A6E05A'), name: t('The Undead'), theme: t('A stitched-up skull with a green glow') },
  djsnake: { creature: 'serpent', palette: P('#C8FFE8', '#3FC8A0', '#0F6A58', '#FFE9A8', '#C9A050', '#FF5F8F', '#3FC8A0'), name: t('The Serpent'), theme: t('A coiled serpent') },
  atliens: { creature: 'alien', palette: P('#D9FFEA', '#5BE3A0', '#118A55', '#0E1A14', '#000000', '#6CFF9E', '#6CFF9E'), name: t('The Visitor'), theme: t('A visitor from another planet') },
  tokimonsta: { creature: 'monster', palette: P('#EEE4FF', '#A98CFF', '#5B3FB0', '#FF85C8', '#C23A8A', '#FFD24A', '#A98CFF'), name: t('The Little monster'), theme: t('A little monster with a flower') },
  sloth: { creature: 'sloth', palette: P('#F2E4CC', '#B8936A', '#6B4A2E', '#8FD67A', '#5A3A22', '#2E2018', '#C9A57E'), name: t('The Sloth'), theme: t('A sloth hanging around') },
  reaper: { creature: 'reaper', palette: P('#A8A2C8', '#5A5480', '#1E1A34', '#E8E4F8', '#8E88AA', '#B9F3FF', '#8FA6FF'), name: t('The Reaper'), theme: t('A hooded reaper under the moon') },
  levity: { creature: 'jelly', palette: P('#E8F8FF', '#6FC3FF', '#2A6AC8', '#B9F3FF', '#4A8AE8', '#FFFFFF', '#6FC3FF'), name: t('The Floater'), theme: t('A jellyfish floating by') },
  levelup: { creature: 'patchbear', palette: P('#C8F59A', '#78C84A', '#3E7A22', '#6A2E86', '#2E0F3E', '#B6FF6A', '#8FE05A'), name: t('The Patched bear'), theme: t('A stitched-up teddy with one eye sewn shut') },
  ganjawhitenight: { creature: 'wobble', palette: P('#FFB27A', '#E8762A', '#9A3E12', '#8E4FE0', '#3E1A6E', '#FF4FE0', '#FF4FE0'), name: t('The Wobbler'), theme: t('A round fellow with a glowing bucket for a head') },
  troyboi: { creature: 'cat', palette: P('#FFF2D6', '#D9A66B', '#7A4E26', '#2A2030', '#0E0A14', '#FFD24A', '#FFD24A'), name: t('The King cat'), theme: t('A cat with a crown'), extra: 'crown' },
};

/** One creature per sound, in the artist's colours, for everyone without a signature. */
const SOUND: Record<SoundTag | 'none', Spec> = {
  dubstep: { creature: 'beast', palette: P('#C9D8FF', '#5B8CFF', '#1E3A9A', '#F2EEE0', '#9A8E70', '#7FF0FF', '#5B8CFF'), name: t('The Bass beast'), theme: t('A horned bass beast') },
  riddim: { creature: 'bot', palette: P('#D6FFFB', '#3FC8C0', '#136A78', '#13202A', '#060A10', '#6CFFE0', '#3FC8C0'), name: t('The Riddim bot'), theme: t('A little robot that loves a wobble') },
  trap: { creature: 'wolf', palette: P('#FFD6E2', '#FF5F8F', '#8A1E48', '#FFF4F8', '#C9A8B8', '#FFE36B', '#FF5F8F'), name: t('The Night wolf'), theme: t('A wolf with glowing eyes') },
  'melodic-bass': { creature: 'moth', palette: P('#F1E8FF', '#A97CFF', '#4A2E9A', '#FFC6F0', '#FF85C8', '#FFF2B0', '#A97CFF'), name: t('The Moth'), theme: t('A moth drawn to the lights') },
  house: { creature: 'cat', palette: P('#FFE6D2', '#FFA86B', '#A84E1E', '#2A2030', '#0E0A14', '#FFE36B', '#FFA86B'), name: t('The Disco cat'), theme: t('A cat in shades under the mirror ball') },
  techno: { creature: 'owl', palette: P('#DCE6FA', '#8FA6D6', '#3A4A78', '#F2F6FF', '#5A6A90', '#FF5A5A', '#8FA6D6'), name: t('The Night owl'), theme: t('An owl that stays up till sunrise') },
  pop: { creature: 'jelly', palette: P('#FFE8F4', '#FF85C8', '#B83A8A', '#FFD6EC', '#FF6AB0', '#FFFFFF', '#FF85C8'), name: t('The Jelly'), theme: t('A sparkly jellyfish') },
  indie: { creature: 'fox', palette: P('#FFE2CC', '#F08A4A', '#9A3E16', '#FFFFFF', '#E8DCD0', '#7FD8A4', '#F08A4A'), name: t('The Fox'), theme: t('A curious fox') },
  rock: { creature: 'dragon', palette: P('#FFD6CC', '#FF7A5C', '#9A2A1E', '#FFE0A8', '#C98A3A', '#FFD24A', '#FF7A5C'), name: t('The Dragon'), theme: t('A small dragon breathing sparks') },
  'hip-hop': { creature: 'bear', palette: P('#FFEED0', '#E0A85A', '#7A4A1E', '#FFE08A', '#C9961E', '#FFF6D0', '#FFC861'), name: t('The Bear'), theme: t('A bear with a gold chain') },
  none: { creature: 'wisp', palette: P('#F4ECFF', '#B99CFF', '#5A3EB0', '#FFF2B0', '#FFC861', '#FFFFFF', '#B99CFF'), name: t('The Wisp'), theme: t('A little light that follows the music') },
};

/** Names folded for matching: lower case, letters and digits only. */
export const foldName = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
/** `a` mixed `t` of the way towards `b`. */
export function mix(a: string, b: string, t: number): string {
  const x = hex(a);
  const y = hex(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}
const isHex = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
/** How light a colour is, 0 to 1. */
const lightness = (c: string) => {
  const [r, g, b] = hex(c);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};
/** A photo's colour, lifted so a dark one still glows on the night tile. */
const lift = (c: string) => {
  const l = lightness(c);
  return l < 0.45 ? mix(c, '#FFFFFF', Math.min(0.5, 0.45 - l + 0.1)) : c;
};

type ArtistLike = { id: string; name: string; sound?: Partial<Record<SoundTag, number>>; color?: string };

/** The artist's main sound, or none when they have no sound tags. */
export function mainSound(a: Pick<ArtistLike, 'sound'>): SoundTag | 'none' {
  let best: SoundTag | 'none' = 'none';
  let w = 0;
  for (const [k, v] of Object.entries(a.sound ?? {}) as [SoundTag, number][]) if (v > w) [best, w] = [k, v];
  return best;
}

/** Their sound's creature in their colours: the body and glow take their colour; the eyes and details stay the creature's own. */
function tinted(p: Palette, tint: string): Palette {
  const t = lift(tint);
  return { ...p, light: mix(p.light, t, 0.2), mid: mix(p.mid, t, 0.6), deep: mix(p.deep, t, 0.45), glow: t };
}

export function artistLook(a: ArtistLike): ArtistLook {
  const sig = SIGNATURES[foldName(a.name)];
  if (sig) return { ...sig, accent: sig.accent ?? sig.palette.glow, signature: true };
  const spec = SOUND[mainSound(a)];
  const palette = isHex(a.color) ? tinted(spec.palette, a.color) : spec.palette;
  return { ...spec, palette, accent: palette.glow, signature: false };
}

/** Which artists have a hand-made collectible (folded names). */
export const SIGNATURE_NAMES = Object.keys(SIGNATURES);

/** Festival-place creatures, for stickers you find in the wild (features/finds). */
const PLACES: Record<PlaceCreature, Spec> = {
  ferris: { creature: 'ferris', palette: P('#FFE9F4', '#FF7EB6', '#B03A7A', '#7FD3FF', '#3A6AC8', '#FFE36B', '#FF7EB6'), name: t('The Ferris wheel'), theme: t('A Ferris wheel that lights up the night') },
  rail: { creature: 'rail', palette: P('#E9FFF4', '#5BE3B5', '#1F8C6A', '#D6DAE4', '#6A7086', '#FF5FCB', '#5BE3B5'), name: t('The Rail rider'), theme: t('Front row on the rail, glow sticks up') },
  sunrise: { creature: 'sunrise', palette: P('#FFF6D0', '#FFC24A', '#E8742A', '#FFB070', '#2E2458', '#FF8A5C', '#FFB347'), name: t('The Sunrise'), theme: t('Still dancing when the sun comes up') },
  lantern: { creature: 'lantern', palette: P('#FFF4D6', '#FFCF6B', '#B8761E', '#6A4C36', '#2E2018', '#FFE9A0', '#FFC861'), name: t('The Camp lantern'), theme: t('A lantern that keeps the campsite cosy') },
  confetti: { creature: 'confetti', palette: P('#F2E8FF', '#A97CFF', '#5A3EB0', '#FF7EB6', '#5BE3B5', '#FFE36B', '#A97CFF'), name: t('The Confetti popper'), theme: t('A burst of confetti at the drop') },
  frog: { creature: 'frog', palette: P('#DFFFD0', '#6CD85A', '#2A8A2E', '#BFEFFF', '#3A9AE0', '#FFFFFF', '#6CD85A'), name: t('The Water frog'), theme: t('A frog that reminds you to drink water') },
};
export type PlaceCreature = 'ferris' | 'rail' | 'sunrise' | 'lantern' | 'confetti' | 'frog';
export const PLACE_CREATURES = Object.keys(PLACES) as PlaceCreature[];

/** The sound creatures (no artist's identity), which stickers can use too. */
export const SOUND_CREATURES: readonly Creature[] = [...new Set(Object.values(SOUND).map((s) => s.creature))];

/** A sticker's creature: a festival place, or a sound creature in its own colours. Never an artist's hand-made one. */
export function stickerLook(creature: string): ArtistLook | undefined {
  const place = PLACES[creature as PlaceCreature];
  if (place) return { ...place, accent: place.palette.glow, signature: false };
  const sound = Object.values(SOUND).find((s) => s.creature === creature);
  return sound ? { ...sound, accent: sound.palette.glow, signature: false } : undefined;
}

/** Every look, for galleries and tests. */
export const ALL_LOOKS: readonly ArtistLook[] = [
  ...Object.values(SIGNATURES).map((s) => ({ ...s, accent: s.palette.glow, signature: true })),
  ...Object.values(SOUND).map((s) => ({ ...s, accent: s.palette.glow, signature: false })),
  ...Object.values(PLACES).map((s) => ({ ...s, accent: s.palette.glow, signature: false })),
];
