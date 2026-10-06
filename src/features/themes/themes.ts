import { DEFAULT_THEME, isThemeId, PALETTES, type Palette, type ThemeId } from '../../theme/palettes';
import { type BackdropId, FROG_FRIENDS, PANDA_FRIENDS, TOE_BEACH_FRIENDS } from '../profile/backdrops';
import { t } from '../../i18n';

/**
 * App themes: a whole new look for Afterglow (the night, the glow, the
 * lights in the sky), each with a profile background to match. Afterglow and
 * Aurora are free; the rest come with Afterglow Plus; three are made for one
 * person each. Pure.
 */
export type AppTheme = {
  id: ThemeId;
  name: string;
  about: string;
  plus: boolean;
  /** Only these accounts may wear it. */
  only?: readonly string[];
  /** The profile background that goes with it. */
  backdrop?: BackdropId;
};

export const THEMES: readonly AppTheme[] = [
  { id: 'afterglow', name: 'Afterglow', about: t('The original: violet festival light at night'), plus: false },
  { id: 'aurora', name: 'Aurora', about: t('Northern-lights green on a deep blue night'), plus: false, backdrop: 'aurora' },
  { id: 'moonlight', name: 'Moonlight', about: t('Silver light, cool and calm'), plus: true, backdrop: 'starfield' },
  { id: 'nebula', name: 'Nebula', about: t('Pink starlight on deep space'), plus: true, backdrop: 'nebula' },
  { id: 'laser', name: 'Laser', about: t('Electric lime for the front row'), plus: true, backdrop: 'lasers' },
  { id: 'synthwave', name: 'Sunset grid', about: t('Hot pink and a neon dusk'), plus: true, backdrop: 'synthwave' },
  { id: 'ocean', name: 'Ocean', about: t('Cool blue, like a night swim'), plus: true, backdrop: 'waves' },
  { id: 'firefly', name: 'Firefly', about: t('Warm gold on a summer night'), plus: true, backdrop: 'fireflies' },
  { id: 'bass', name: 'Bass', about: t('Electric blue for the drop'), plus: true, backdrop: 'bass' },
  { id: 'lava', name: 'Lava', about: t('Molten orange and red'), plus: true, backdrop: 'lava' },
  { id: 'prism', name: 'Prism', about: t('Orchid and soft pastel light'), plus: true, backdrop: 'prism' },
  { id: 'panda', name: 'Panda garden', about: t('Made just for you: blossom pink and bamboo green'), plus: false, only: PANDA_FRIENDS, backdrop: 'panda' },
  { id: 'frog', name: 'Frog pond', about: t('Made just for you: lily-pad green and firefly light'), plus: false, only: FROG_FRIENDS, backdrop: 'frog' },
  { id: 'toes', name: 'Toe beach', about: t('Made just for you: sunset peach on the sand'), plus: false, only: TOE_BEACH_FRIENDS, backdrop: 'toes' },
];

const BY_ID = new Map(THEMES.map((t) => [t.id, t]));

export const themeOf = (id: string | undefined): AppTheme => BY_ID.get(id as ThemeId) ?? BY_ID.get(DEFAULT_THEME)!;
export const paletteOf = (id: ThemeId): Palette => PALETTES[id];

/** The themes this account is offered: its own special one first, then everyone's. */
export function themeChoices(uid: string | undefined): AppTheme[] {
  return [...THEMES.filter((t) => t.only && uid && t.only.includes(uid)), ...THEMES.filter((t) => !t.only)];
}

/** Whether `uid` may wear it: made for them, free, or with Plus. */
export function canUseTheme(t: AppTheme, uid: string | undefined, plus: boolean): boolean {
  if (t.only) return !!uid && t.only.includes(uid);
  return !t.plus || plus;
}

/** The theme made for this account, if there is one. */
export const madeTheme = (uid: string | undefined) => THEMES.find((t) => t.only && uid && t.only.includes(uid));

/**
 * The theme to go back to when the one being worn no longer belongs to
 * whoever's signed in: someone else's special theme, or a Plus theme once
 * Plus has ended. Only decides on what's known: `uid` undefined (signed out)
 * or `plus` undefined (not read yet) never takes a theme away.
 */
export function themeToRevert(current: ThemeId, who: { uid?: string; plus?: boolean }): ThemeId | undefined {
  const t = themeOf(current);
  if (t.only) return who.uid && !t.only.includes(who.uid) ? DEFAULT_THEME : undefined;
  if (t.plus && who.uid && who.plus === false) return DEFAULT_THEME;
  return undefined;
}

/** Whether to offer someone their own theme as a gift: they have one, aren't wearing it, and haven't been offered it. */
export function giftDue(uid: string | undefined, current: ThemeId, offered: readonly string[]): boolean {
  const mine = madeTheme(uid);
  return !!mine && !!uid && current !== mine.id && !offered.includes(uid);
}

export const cleanOffered = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-20) : []);

export { isThemeId };
