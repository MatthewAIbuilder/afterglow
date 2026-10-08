/**
 * Animated backgrounds for the top of a profile, in place of a cover photo.
 * Each is drawn in code (no images), loops seamlessly, and stays still with
 * reduced motion. A few are free; the rest come with Afterglow Plus. A few
 * are made for one person each (the panda garden, the frog pond, the toe
 * beach, the gnome garden) and nobody else can choose them. Pure.
 */
import { TOE_FRIENDS } from '../toes/toes';
import { t } from '../../i18n';

export type BackdropId =
  | 'aurora'
  | 'pride'
  | 'starfield'
  | 'nebula'
  | 'lasers'
  | 'synthwave'
  | 'equalizer'
  | 'waves'
  | 'fireflies'
  | 'bass'
  | 'lava'
  | 'prism'
  | 'vortex'
  | 'panda'
  | 'frog'
  | 'toes'
  | 'daisy'
  | 'gnome';

export type Backdrop = {
  id: BackdropId;
  name: string;
  /** A few words on what moves. */
  about: string;
  /** Needs Afterglow Plus. */
  plus: boolean;
  /** Only these accounts may use it (and theirs shows it by default). */
  only?: readonly string[];
  /** A gift: only for accounts given it (a sprout from Afterglow's developer that came with it). */
  gift?: true;
};

/** Whose profile gets the panda garden (their Afterglow account). */
export const PANDA_FRIENDS: readonly string[] = ['8EEXIUNCQghOnejeAOygGMSl6Bp1'];

/** Whose profile gets the gnome garden (the same account as the panda garden). */
export const GNOME_FRIENDS: readonly string[] = ['8EEXIUNCQghOnejeAOygGMSl6Bp1'];

/** Whose profile gets the frog pond. */
export const FROG_FRIENDS: readonly string[] = ['6i9w14pQcdR05jYEUvPmadkQ6NZ2'];

/** Whose profile gets the toe beach: the same account the hidden toes are for. */
export const TOE_BEACH_FRIENDS: readonly string[] = TOE_FRIENDS;

export const BACKDROPS: readonly Backdrop[] = [
  { id: 'aurora', name: t('Aurora'), about: t('Northern lights rippling across the sky'), plus: false },
  { id: 'pride', name: t('Pride'), about: t('A rainbow flag waving, hearts of every colour rising'), plus: false },
  { id: 'starfield', name: t('Starfield'), about: t('Twinkling stars and the odd shooting star'), plus: false },
  { id: 'nebula', name: t('Nebula'), about: t('Clouds of colour drifting through space'), plus: false },
  { id: 'lasers', name: t('Laser show'), about: t('Beams sweeping from both sides of the stage'), plus: true },
  { id: 'synthwave', name: t('Sunset grid'), about: t('A neon sun over a grid rolling towards you'), plus: true },
  { id: 'equalizer', name: t('Equalizer'), about: t('Bars bouncing to a beat'), plus: true },
  { id: 'waves', name: t('Ocean waves'), about: t('Layers of water rolling past at night'), plus: true },
  { id: 'fireflies', name: t('Fireflies'), about: t('Little lights rising and swaying'), plus: true },
  { id: 'bass', name: t('Bass rings'), about: t('Rings rolling out with every drop'), plus: true },
  { id: 'lava', name: t('Lava lamp'), about: t('Warm blobs rising and sinking'), plus: true },
  { id: 'prism', name: t('Prism'), about: t('A holographic shimmer sliding across'), plus: true },
  { id: 'vortex', name: t('Vortex'), about: t('Rings of light turning around the centre'), plus: true },
  { id: 'panda', name: t('Panda garden'), about: t('Made just for you: pandas, bamboo and falling blossoms'), plus: false, only: PANDA_FRIENDS },
  { id: 'frog', name: t('Frog pond'), about: t('Made just for you: frogs on lily pads, fireflies and a green glow'), plus: false, only: FROG_FRIENDS },
  { id: 'daisy', name: t('Neon daisy'), about: t('A gift: giant neon daisies turning under carnival lights'), plus: false, gift: true },
  { id: 'toes', name: t('Toe beach'), about: t('Made just for you: footprints in the sand, wiggling toes and a sunset'), plus: false, only: TOE_BEACH_FRIENDS },
  { id: 'gnome', name: t('Gnome garden'), about: t('Made just for you: gnomes among the toadstools, lanterns and fireflies'), plus: false, only: GNOME_FRIENDS },
];

const BY_ID = new Map(BACKDROPS.map((b) => [b.id, b]));

export const isBackdropId = (v: unknown): v is BackdropId => typeof v === 'string' && BY_ID.has(v as BackdropId);

export const backdropOf = (id: string | undefined) => (id ? BY_ID.get(id as BackdropId) : undefined);

/** The backgrounds this account is offered: its own special one and gifts first, then everyone's. */
export function backdropChoices(uid: string | undefined, gifts: readonly string[] = []): Backdrop[] {
  const mine = BACKDROPS.filter((b) => (b.only && uid && b.only.includes(uid)) || (b.gift && gifts.includes(b.id)));
  return [...mine, ...BACKDROPS.filter((b) => !b.only && !b.gift)];
}

/** Whether `uid` may use it now: made for them, given to them, free, or with Plus. */
export function canUse(b: Backdrop, uid: string | undefined, plus: boolean, gifts: readonly string[] = []): boolean {
  if (b.only) return !!uid && b.only.includes(uid);
  if (b.gift) return gifts.includes(b.id);
  return !b.plus || plus;
}

/** A special background made for this account, if there is one (the newest, for someone with more than one). */
export const madeFor = (uid: string | undefined) => [...BACKDROPS].reverse().find((b) => b.only && uid && b.only.includes(uid));

/**
 * What the top of a profile shows. The chosen background when the owner may
 * use it (a Plus one stops showing when Plus ends); otherwise their special
 * one, if they have one and haven't turned it off (`'none'`: the cover photo
 * or a plain top); otherwise nothing, so the cover photo shows.
 */
export function shownBackdrop(chosen: string | undefined, uid: string | undefined, plus: boolean): BackdropId | undefined {
  const b = backdropOf(chosen);
  // A gift background: the database only lets someone given it choose it, so a chosen one is theirs.
  if (b?.gift) return b.id;
  if (b && canUse(b, uid, plus)) return b.id;
  if (chosen === NO_BACKDROP) return undefined;
  return madeFor(uid)?.id;
}

/** Saved as the choice when someone turns their special background off for a plain look. */
export const NO_BACKDROP = 'none';

/** A saved choice read back: a known background, `'none'`, or nothing. */
export const cleanBackdrop = (v: unknown): string | undefined => (isBackdropId(v) || v === NO_BACKDROP ? v : undefined);
