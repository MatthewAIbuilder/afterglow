/**
 * Animated backgrounds for the top of a profile, in place of a cover photo.
 * Each is drawn in code (no images), loops seamlessly, and stays still with
 * reduced motion. A few are free; the rest come with Afterglow Plus. One is
 * made for a single person (the panda garden, the frog pond) and nobody else can choose it. Pure.
 */

export type BackdropId =
  | 'aurora'
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
  | 'frog';

export type Backdrop = {
  id: BackdropId;
  name: string;
  /** A few words on what moves. */
  about: string;
  /** Needs Afterglow Plus. */
  plus: boolean;
  /** Only these accounts may use it (and theirs shows it by default). */
  only?: readonly string[];
};

/** Whose profile gets the panda garden (their Afterglow account). */
export const PANDA_FRIENDS: readonly string[] = ['8EEXIUNCQghOnejeAOygGMSl6Bp1'];

/** Whose profile gets the frog pond. */
export const FROG_FRIENDS: readonly string[] = ['6i9w14pQcdR05jYEUvPmadkQ6NZ2'];

export const BACKDROPS: readonly Backdrop[] = [
  { id: 'aurora', name: 'Aurora', about: 'Northern lights rippling across the sky', plus: false },
  { id: 'starfield', name: 'Starfield', about: 'Twinkling stars and the odd shooting star', plus: false },
  { id: 'nebula', name: 'Nebula', about: 'Clouds of colour drifting through space', plus: false },
  { id: 'lasers', name: 'Laser show', about: 'Beams sweeping from both sides of the stage', plus: true },
  { id: 'synthwave', name: 'Sunset grid', about: 'A neon sun over a grid rolling towards you', plus: true },
  { id: 'equalizer', name: 'Equalizer', about: 'Bars bouncing to a beat', plus: true },
  { id: 'waves', name: 'Ocean waves', about: 'Layers of water rolling past at night', plus: true },
  { id: 'fireflies', name: 'Fireflies', about: 'Little lights rising and swaying', plus: true },
  { id: 'bass', name: 'Bass rings', about: 'Rings rolling out with every drop', plus: true },
  { id: 'lava', name: 'Lava lamp', about: 'Warm blobs rising and sinking', plus: true },
  { id: 'prism', name: 'Prism', about: 'A holographic shimmer sliding across', plus: true },
  { id: 'vortex', name: 'Vortex', about: 'Rings of light turning around the centre', plus: true },
  { id: 'panda', name: 'Panda garden', about: 'Made just for you: pandas, bamboo and falling blossoms', plus: false, only: PANDA_FRIENDS },
  { id: 'frog', name: 'Frog pond', about: 'Made just for you: frogs on lily pads, fireflies and a green glow', plus: false, only: FROG_FRIENDS },
];

const BY_ID = new Map(BACKDROPS.map((b) => [b.id, b]));

export const isBackdropId = (v: unknown): v is BackdropId => typeof v === 'string' && BY_ID.has(v as BackdropId);

export const backdropOf = (id: string | undefined) => (id ? BY_ID.get(id as BackdropId) : undefined);

/** The backgrounds this account is offered: its own special one first, then everyone's. */
export function backdropChoices(uid: string | undefined): Backdrop[] {
  const mine = BACKDROPS.filter((b) => b.only && uid && b.only.includes(uid));
  return [...mine, ...BACKDROPS.filter((b) => !b.only)];
}

/** Whether `uid` may use it now: made for them, free, or with Plus. */
export function canUse(b: Backdrop, uid: string | undefined, plus: boolean): boolean {
  if (b.only) return !!uid && b.only.includes(uid);
  return !b.plus || plus;
}

/** A special background made for this account, if there is one. */
export const madeFor = (uid: string | undefined) => BACKDROPS.find((b) => b.only && uid && b.only.includes(uid));

/**
 * What the top of a profile shows. The chosen background when the owner may
 * use it (a Plus one stops showing when Plus ends); otherwise their special
 * one, if they have one and haven't turned it off (`'none'`: the cover photo
 * or a plain top); otherwise nothing, so the cover photo shows.
 */
export function shownBackdrop(chosen: string | undefined, uid: string | undefined, plus: boolean): BackdropId | undefined {
  const b = backdropOf(chosen);
  if (b && canUse(b, uid, plus)) return b.id;
  if (chosen === NO_BACKDROP) return undefined;
  return madeFor(uid)?.id;
}

/** Saved as the choice when someone turns their special background off for a plain look. */
export const NO_BACKDROP = 'none';

/** A saved choice read back: a known background, `'none'`, or nothing. */
export const cleanBackdrop = (v: unknown): string | undefined => (isBackdropId(v) || v === NO_BACKDROP ? v : undefined);
