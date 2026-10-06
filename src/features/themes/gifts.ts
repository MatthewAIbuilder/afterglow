import { t } from '../../i18n';
import type { GardenSprout } from '../sprouts/sprouts';
import type { Notice } from '../notifications/inbox';
import type { ThemeId } from '../../theme/palettes';
import { THEMES } from './themes';

/**
 * Gift themes: a few themes (each with its profile background) that nobody
 * can pick, only be given. Only Afterglow's developer can give them, with a
 * sprout: whoever picks up that sprout has the theme from then on. A new
 * account wears it as soon as its profile is made; an account that already
 * had one is told it's there. The database checks all of it (firestore.rules:
 * `sprouts` take a `theme` only from these handles, and a profile shows a
 * gift background only with a grant made from a sprout that came with it).
 * Pure.
 */

/** Who can give theme gifts (handles are never reassigned). Keep in step with firestore.rules. */
export const GIFT_GIVER_HANDLES: readonly string[] = ['matt.raves'];

/** The themes that can only be given. Keep in step with firestore.rules. */
export const GIFT_THEME_IDS: readonly ThemeId[] = THEMES.filter((x) => x.gift).map((x) => x.id);

export const isGiftTheme = (v: unknown): v is ThemeId => typeof v === 'string' && (GIFT_THEME_IDS as readonly string[]).includes(v);

export const canGiveThemes = (handle: string | undefined) => !!handle && GIFT_GIVER_HANDLES.includes(handle);

/** A gift theme in your garden: the sprout it came with. */
export type ThemeGift = { theme: ThemeId; sprout: string; from: string; handle?: string; name?: string; at: number };

/**
 * The gift themes this account has: every one for the giver, otherwise the
 * ones that came with sprouts it picked up (first one each).
 */
export function giftThemesOf(garden: readonly GardenSprout[], handle: string | undefined): ThemeGift[] {
  if (canGiveThemes(handle)) return GIFT_THEME_IDS.map((theme) => ({ theme, sprout: '', from: '', at: 0 }));
  const out: ThemeGift[] = [];
  for (const g of [...garden].sort((a, b) => a.at - b.at)) {
    if (!g.theme || out.some((x) => x.theme === g.theme)) continue;
    out.push({ theme: g.theme, sprout: g.id, from: g.from, ...(g.handle ? { handle: g.handle } : {}), ...(g.name ? { name: g.name } : {}), at: g.at });
  }
  return out;
}

/** "Neon Daisy is yours": one bell notice per theme given. */
export function themeGiftNotices(gifts: readonly ThemeGift[], themeName: (id: ThemeId) => string): Notice[] {
  return gifts
    .filter((g) => g.sprout)
    .map((g) => ({
      id: `theme-gift:${g.theme}`,
      at: g.at,
      kind: 'sprout' as const,
      title: g.handle ? t('@{handle} gave you a theme: {theme}', { handle: g.handle, theme: themeName(g.theme) }) : t('You were given a theme: {theme}', { theme: themeName(g.theme) }),
      body: t('It came with your sprout. A look for the whole app, and a profile background to match.'),
      href: `/themes?gift=${g.theme}`,
    }));
}

/**
 * The gift the theme page should show next, once its grant is saved (so the
 * matching profile background is allowed): put it on, when it came to a
 * brand-new account and that account now has its profile, or offer it, when
 * it came to an account that already had one. `already`: it's being worn,
 * so there's nothing to show, only to mark as shown.
 */
export function giftToShow(
  gifts: readonly (ThemeGift & { granted: boolean; shown: boolean; wearOnArrival?: boolean })[],
  wearing: ThemeId,
  hasProfile: boolean,
): { sprout: string; theme: ThemeId; wear: boolean; already: boolean } | undefined {
  const g = gifts.find((x) => x.sprout && !x.shown && x.granted);
  if (!g || (g.wearOnArrival && !hasProfile)) return undefined;
  return { sprout: g.sprout, theme: g.theme, wear: !!g.wearOnArrival, already: g.theme === wearing };
}
