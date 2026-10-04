import type { SoundTag } from '../../data/models';

/**
 * How an artist's sprout looks. Pure. A few big names have a hand-made
 * signature sprout inspired by their world (a cyclops, a phoenix, a lion's
 * mane), never their logos; everyone else gets one built from their sound
 * (which accessory pool, which leaves) and their photo's colour (the tint),
 * picked by a hash of their id so each artist's sprout is their own and the
 * same for everyone.
 */
export type Face = 'smile' | 'joy' | 'bliss' | 'wink' | 'shades' | 'sparkle' | 'sleepy' | 'cool' | 'cyclops' | 'hollow' | 'glasses' | 'alien' | 'stitched' | 'fang';
export type LeafShape = 'round' | 'heart' | 'pointed' | 'jagged' | 'petal' | 'wide';
/** What sits on top of the stem. */
export type Top = 'none' | 'phoenix' | 'pumpkin' | 'halo' | 'cake' | 'crown' | 'tree' | 'cream' | 'balloons' | 'bolt' | 'flower' | 'stars' | 'feather' | 'record' | 'note' | 'heart' | 'star' | 'daisy' | 'speaker' | 'moon';
/** What it wears on its body. */
export type Wear =
  | 'none'
  | 'horns'
  | 'wings'
  | 'fringe'
  | 'wool'
  | 'devil'
  | 'helmet'
  | 'bunny'
  | 'stitches'
  | 'snake'
  | 'antennae'
  | 'monster'
  | 'mask'
  | 'hood'
  | 'headphones'
  | 'cap'
  | 'chain'
  | 'bow'
  | 'beanie'
  | 'mohawk'
  | 'scarf';
/** Drawn behind the body. */
export type Back = 'none' | 'mane' | 'glow-ring';

export type ArtistLook = {
  body: [string, string, string];
  leaf: [string, string];
  face: Face;
  leafShape: LeafShape;
  top: Top;
  wear: Wear;
  back: Back;
  accent: string;
  /** Hand-made for this artist. */
  signature: boolean;
  /** One line on what it is: "A cyclops sprout". */
  theme: string;
};

type Spec = Omit<ArtistLook, 'signature' | 'back'> & { back?: Back };

const GREEN: [string, string, string] = ['#B6F7CF', '#5BD48E', '#1F8C50'];
const LEAF: [string, string] = ['#8FF0B4', '#239255'];

/** Signature sprouts, by folded artist name. */
const SIGNATURES: Record<string, Spec> = {
  subtronics: { body: ['#E6FFB0', '#9BE84E', '#3E8F1A'], leaf: ['#C8F78A', '#4C9A22'], face: 'cyclops', leafShape: 'jagged', top: 'bolt', wear: 'horns', accent: '#B36BFF', theme: 'A cyclops sprout' },
  illenium: { body: ['#FFE6B8', '#FFA35C', '#C2462A'], leaf: ['#FFC46B', '#D9532B'], face: 'bliss', leafShape: 'petal', top: 'phoenix', wear: 'wings', accent: '#FF6A3D', theme: 'A phoenix sprout' },
  skrillex: { body: GREEN, leaf: LEAF, face: 'glasses', leafShape: 'jagged', top: 'none', wear: 'fringe', accent: '#FF3D7F', theme: 'A sprout with the swoop' },
  zedsdead: { body: ['#FAF8FF', '#D4D0EC', '#8C88B8'], leaf: ['#C9C6E6', '#6E6A9A'], face: 'hollow', leafShape: 'pointed', top: 'moon', wear: 'none', accent: '#9BE84E', theme: 'A ghostly sprout' },
  rlgrime: { body: GREEN, leaf: ['#9FE07A', '#3E7D2A'], face: 'fang', leafShape: 'pointed', top: 'pumpkin', wear: 'none', accent: '#FF8A1F', theme: 'A Halloween sprout' },
  wooli: { body: ['#FFFFFF', '#ECE6D6', '#B8AE92'], leaf: LEAF, face: 'joy', leafShape: 'round', top: 'none', wear: 'wool', accent: '#E8D9B0', theme: 'A woolly sprout' },
  sevenlions: { body: ['#FFF1C2', '#F2C46B', '#B07A24'], leaf: ['#E8F08A', '#8A9A2E'], face: 'cool', leafShape: 'pointed', top: 'none', wear: 'none', back: 'mane', accent: '#E89A2E', theme: 'A lion sprout' },
  slander: { body: GREEN, leaf: LEAF, face: 'wink', leafShape: 'round', top: 'halo', wear: 'devil', accent: '#FFD58A', theme: 'Half angel, half devil' },
  spacelaces: { body: ['#D8F4FF', '#7FC8F0', '#2D6FA8'], leaf: ['#9FE6FF', '#2A7FA8'], face: 'sparkle', leafShape: 'wide', top: 'stars', wear: 'helmet', accent: '#7FD3FF', theme: 'An astronaut sprout' },
  steveaoki: { body: GREEN, leaf: LEAF, face: 'joy', leafShape: 'round', top: 'cake', wear: 'none', accent: '#FF85C8', theme: 'A cake sprout' },
  troyboi: { body: GREEN, leaf: LEAF, face: 'cool', leafShape: 'wide', top: 'crown', wear: 'chain', accent: '#FFD24A', theme: 'A royal sprout' },
  alisonwonderland: { body: ['#FFF4FA', '#F7C6E0', '#C27BA6'], leaf: LEAF, face: 'sparkle', leafShape: 'heart', top: 'none', wear: 'bunny', accent: '#FF85C8', theme: 'A Wonderland bunny' },
  ofthetrees: { body: ['#E9E1C6', '#A99A6A', '#5E5230'], leaf: ['#9FD68A', '#3E7D2A'], face: 'bliss', leafShape: 'wide', top: 'tree', wear: 'none', accent: '#7FD87A', theme: 'A forest sprout' },
  sanholo: { body: ['#E8FFFB', '#B9A8FF', '#FF9EDB'], leaf: ['#BFF5FF', '#8A7CFF'], face: 'sparkle', leafShape: 'petal', top: 'star', wear: 'none', back: 'glow-ring', accent: '#9FF0FF', theme: 'A holographic sprout' },
  zomboy: { body: ['#D6EBAE', '#8DB060', '#4C6B2C'], leaf: ['#B6D98A', '#4E7A2E'], face: 'stitched', leafShape: 'jagged', top: 'none', wear: 'stitches', accent: '#A6E05A', theme: 'A zombie sprout' },
  marshmello: { body: ['#FFFFFF', '#F3F0F8', '#C9C4D8'], leaf: LEAF, face: 'joy', leafShape: 'round', top: 'heart', wear: 'none', accent: '#FFB1DA', theme: 'A marshmallow sprout' },
  djsnake: { body: GREEN, leaf: LEAF, face: 'wink', leafShape: 'pointed', top: 'none', wear: 'snake', accent: '#3FC8A0', theme: 'A sprout with a snake friend' },
  atliens: { body: ['#D2FFE6', '#4FE39A', '#118A55'], leaf: ['#9FF7C6', '#118A55'], face: 'alien', leafShape: 'wide', top: 'none', wear: 'antennae', accent: '#6CFF9E', theme: 'An alien sprout' },
  tokimonsta: { body: ['#E4D8FF', '#A98CFF', '#5B3FB0'], leaf: LEAF, face: 'fang', leafShape: 'heart', top: 'flower', wear: 'monster', accent: '#FF85C8', theme: 'A little monster' },
  sloth: { body: ['#EEDCC2', '#B8936A', '#6B4A2E'], leaf: ['#A6D98A', '#4C7A34'], face: 'sleepy', leafShape: 'round', top: 'none', wear: 'mask', accent: '#C9A57E', theme: 'A sloth sprout' },
  whippedcream: { body: GREEN, leaf: LEAF, face: 'joy', leafShape: 'round', top: 'cream', wear: 'none', accent: '#FFE0EC', theme: 'A whipped cream sprout' },
  reaper: { body: ['#D8D4E8', '#8E88AA', '#3E3A58'], leaf: ['#A8A2C8', '#4A4668'], face: 'hollow', leafShape: 'pointed', top: 'moon', wear: 'hood', accent: '#B9B3DA', theme: 'A reaper sprout' },
  levity: { body: GREEN, leaf: LEAF, face: 'joy', leafShape: 'round', top: 'balloons', wear: 'none', accent: '#6FC3FF', theme: 'A floating sprout' },
  ghengar: { body: ['#E4D8FF', '#9A7CE0', '#4A2E8A'], leaf: ['#C6B2FF', '#5A3EA0'], face: 'fang', leafShape: 'jagged', top: 'moon', wear: 'devil', accent: '#B36BFF', theme: 'A spooky sprout' },
};

/** Accessory pools by sound, for everyone without a signature. */
const POOLS: Record<SoundTag | 'none', { tops: Top[]; wears: Wear[]; leaf: LeafShape; faces: Face[]; tint: string }> = {
  dubstep: { tops: ['bolt', 'speaker', 'none'], wears: ['headphones', 'cap', 'none'], leaf: 'jagged', faces: ['cool', 'fang', 'wink'], tint: '#5B8CFF' },
  riddim: { tops: ['bolt', 'speaker', 'none'], wears: ['headphones', 'mohawk', 'cap'], leaf: 'jagged', faces: ['cool', 'fang', 'shades'], tint: '#3FC8C0' },
  trap: { tops: ['bolt', 'star', 'none'], wears: ['cap', 'chain', 'headphones'], leaf: 'pointed', faces: ['cool', 'wink', 'shades'], tint: '#FF5F8F' },
  'melodic-bass': { tops: ['flower', 'stars', 'feather', 'moon'], wears: ['none', 'scarf', 'headphones'], leaf: 'petal', faces: ['bliss', 'sparkle', 'joy'], tint: '#A97CFF' },
  house: { tops: ['record', 'note', 'none'], wears: ['chain', 'none', 'cap'], leaf: 'wide', faces: ['shades', 'joy', 'cool'], tint: '#FFA86B' },
  techno: { tops: ['record', 'speaker', 'none'], wears: ['none', 'headphones', 'chain'], leaf: 'wide', faces: ['shades', 'cool', 'smile'], tint: '#8FA6D6' },
  pop: { tops: ['heart', 'star', 'flower'], wears: ['bow', 'none', 'scarf'], leaf: 'heart', faces: ['joy', 'sparkle', 'wink'], tint: '#FF85C8' },
  indie: { tops: ['daisy', 'note', 'moon'], wears: ['beanie', 'scarf', 'none'], leaf: 'round', faces: ['smile', 'sleepy', 'bliss'], tint: '#7FD8A4' },
  rock: { tops: ['bolt', 'star', 'none'], wears: ['mohawk', 'chain', 'none'], leaf: 'pointed', faces: ['cool', 'wink', 'fang'], tint: '#FF7A5C' },
  'hip-hop': { tops: ['crown', 'star', 'note'], wears: ['cap', 'chain', 'none'], leaf: 'wide', faces: ['cool', 'shades', 'smile'], tint: '#FFC861' },
  none: { tops: ['star', 'flower', 'note', 'daisy'], wears: ['none', 'beanie', 'scarf'], leaf: 'round', faces: ['smile', 'joy', 'wink'], tint: '#A97CFF' },
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

type ArtistLike = { id: string; name: string; sound?: Partial<Record<SoundTag, number>>; color?: string };

/** The artist's main sound, or none when they have no sound tags. */
function mainSound(a: ArtistLike): SoundTag | 'none' {
  let best: SoundTag | 'none' = 'none';
  let w = 0;
  for (const [k, v] of Object.entries(a.sound ?? {}) as [SoundTag, number][]) if (v > w) [best, w] = [k, v];
  return best;
}

export function artistLook(a: ArtistLike): ArtistLook {
  const sig = SIGNATURES[foldName(a.name)];
  if (sig) return { back: 'none', ...sig, signature: true };
  const sound = mainSound(a);
  const pool = POOLS[sound];
  const h = hashOf(a.id);
  const tint = isHex(a.color) ? a.color : pool.tint;
  // The body stays a sprout green, tinted towards the artist; the accent is their colour.
  const body: [string, string, string] = [mix(GREEN[0], tint, 0.25), mix(GREEN[1], tint, 0.42), mix(GREEN[2], tint, 0.4)];
  const top = pool.tops[h % pool.tops.length];
  const wear = pool.wears[(h >>> 4) % pool.wears.length];
  return {
    body,
    leaf: [mix(LEAF[0], tint, 0.15), mix(LEAF[1], tint, 0.15)],
    face: pool.faces[(h >>> 8) % pool.faces.length],
    leafShape: pool.leaf,
    top: top === 'none' && wear === 'none' ? 'star' : top,
    wear,
    back: 'none',
    accent: tint,
    signature: false,
    theme: THEME[sound],
  };
}

const THEME: Record<SoundTag | 'none', string> = {
  dubstep: 'A heavy sprout',
  riddim: 'A riddim sprout',
  trap: 'A trap sprout',
  'melodic-bass': 'A dreamy sprout',
  house: 'A groovy sprout',
  techno: 'A late-night sprout',
  pop: 'A sparkly sprout',
  indie: 'A cosy sprout',
  rock: 'A loud sprout',
  'hip-hop': 'A fresh sprout',
  none: 'Their own sprout',
};

/** Which artists have a hand-made signature sprout (folded names). */
export const SIGNATURE_NAMES = Object.keys(SIGNATURES);
