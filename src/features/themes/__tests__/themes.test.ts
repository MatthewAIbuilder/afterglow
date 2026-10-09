import { describe, expect, it } from '@jest/globals';
import { DEFAULT_THEME, isThemeId, PALETTES, rgbaOf, THEME_IDS } from '../../../theme/palettes';
import { FROG_FRIENDS, PANDA_FRIENDS, TOE_BEACH_FRIENDS } from '../../profile/backdrops';
import { canUseTheme, cleanOffered, giftDue, madeTheme, offerKey, THEMES, themeChoices, themeOf, themeToRevert } from '../themes';

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('app themes', () => {
  it('every theme has a full palette and a description', () => {
    for (const id of THEME_IDS) {
      for (const v of Object.values(PALETTES[id])) expect(v).toMatch(/^#[0-9A-F]{6}$/);
      expect(themeOf(id).id).toBe(id);
    }
    expect(THEMES.map((t) => t.id).sort()).toEqual([...THEME_IDS].sort());
  });

  it('stays readable: the glow on the night, and words on the buttons', () => {
    for (const id of THEME_IDS) {
      const p = PALETTES[id];
      expect(contrast(p.glow, p.night)).toBeGreaterThanOrEqual(4.5);
      expect(contrast('#F3F0FF', p.night)).toBeGreaterThanOrEqual(12);
      expect(contrast('#F3F0FF', p.glowDeep)).toBeGreaterThanOrEqual(2.9);
    }
  });

  it('Afterglow is the default, unchanged', () => {
    expect(DEFAULT_THEME).toBe('afterglow');
    expect(PALETTES.afterglow.glow).toBe('#A97CFF');
    expect(PALETTES.afterglow.night).toBe('#0A0918');
    expect(rgbaOf('#A97CFF', 0.3)).toBe('rgba(169,124,255,0.3)');
    expect(themeOf('nonsense').id).toBe('afterglow');
    expect(isThemeId('lava')).toBe(true);
    expect(isThemeId('glitter')).toBe(false);
  });

  it('three are free (Afterglow, Aurora and Pride), the rest need Plus', () => {
    const everyone = themeChoices('someone');
    expect(everyone.filter((t) => !t.plus).map((t) => t.id)).toEqual(['afterglow', 'aurora', 'pride']);
    expect(everyone.length).toBeGreaterThanOrEqual(10);
    const lava = themeOf('lava');
    expect(canUseTheme(lava, 'u', false)).toBe(false);
    expect(canUseTheme(lava, 'u', true)).toBe(true);
  });

  it('the panda, frog and toe themes belong to one person each', () => {
    // The panda garden's owner has the gnome garden too: the newest is the one offered.
    expect(madeTheme(PANDA_FRIENDS[0])?.id).toBe('gnome');
    expect(themeChoices(PANDA_FRIENDS[0]).slice(0, 2).map((t) => t.id)).toEqual(['panda', 'gnome']);
    expect(canUseTheme(themeOf('gnome'), PANDA_FRIENDS[0], false)).toBe(true);
    expect(canUseTheme(themeOf('gnome'), FROG_FRIENDS[0], true)).toBe(false);
    expect(themeOf('gnome').backdrop).toBe('gnome');
    expect(madeTheme(FROG_FRIENDS[0])?.id).toBe('frog');
    expect(madeTheme(TOE_BEACH_FRIENDS[0])?.id).toBe('toes');
    expect(themeChoices(PANDA_FRIENDS[0])[0].id).toBe('panda');
    expect(themeChoices('someone').some((t) => t.only)).toBe(false);
    expect(canUseTheme(themeOf('frog'), PANDA_FRIENDS[0], true)).toBe(false);
    // Each pairs with its own profile background.
    expect(themeOf('toes').backdrop).toBe('toes');
  });

  it('takes a theme away only on what it knows', () => {
    expect(themeToRevert('lava', { uid: 'u', plus: false })).toBe('afterglow');
    expect(themeToRevert('lava', { uid: 'u', plus: true })).toBeUndefined();
    expect(themeToRevert('lava', { uid: 'u' })).toBeUndefined(); // Plus not read yet
    expect(themeToRevert('lava', {})).toBeUndefined(); // signed out
    expect(themeToRevert('panda', { uid: 'someone' })).toBe('afterglow');
    expect(themeToRevert('panda', { uid: PANDA_FRIENDS[0], plus: false })).toBeUndefined();
    expect(themeToRevert('aurora', { uid: 'u', plus: false })).toBeUndefined();
  });

  it('offers someone their own theme once', () => {
    const grace = PANDA_FRIENDS[0];
    expect(giftDue(grace, 'afterglow', [])).toBe(true);
    expect(giftDue(grace, 'gnome', [])).toBe(false);
    // Offered the panda garden before (kept as the account alone): the gnome garden is still offered, once.
    expect(giftDue(grace, 'panda', [grace])).toBe(true);
    expect(offerKey(grace, 'gnome')).toBe(`${grace}:gnome`);
    expect(giftDue(grace, 'afterglow', [grace, offerKey(grace, 'gnome')])).toBe(false);
    const frog = FROG_FRIENDS[0];
    expect(offerKey(frog, 'frog')).toBe(frog);
    expect(giftDue(frog, 'afterglow', [frog])).toBe(false);
    expect(giftDue('someone', 'afterglow', [])).toBe(false);
    expect(cleanOffered(['a', 3, 'b'])).toEqual(['a', 'b']);
    expect(cleanOffered('x')).toEqual([]);
  });
});
