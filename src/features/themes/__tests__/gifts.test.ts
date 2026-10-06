import { describe, expect, it } from '@jest/globals';
import { backdropChoices, canUse, backdropOf } from '../../profile/backdrops';
import { cleanGifts } from '../../sprouts/outbox';
import type { GardenSprout } from '../../sprouts/sprouts';
import { canGiveThemes, GIFT_THEME_IDS, giftThemesOf, giftToShow, isGiftTheme, themeGiftNotices } from '../gifts';
import { canUseTheme, themeChoices, themeOf, themeToRevert } from '../themes';

const sprout = (over: Partial<GardenSprout>): GardenSprout => ({ id: 's1', kind: 'seedling', from: 'uM', handle: 'matt.raves', name: 'Matt', at: 1000, ...over });

describe('gift themes', () => {
  it('only @matt.raves gives them, and only the gift themes count', () => {
    expect(GIFT_THEME_IDS).toEqual(['daisy']);
    expect(canGiveThemes('matt.raves')).toBe(true);
    expect(canGiveThemes('maya')).toBe(false);
    expect(canGiveThemes(undefined)).toBe(false);
    expect(isGiftTheme('daisy')).toBe(true);
    expect(isGiftTheme('nebula')).toBe(false);
    expect(isGiftTheme(3)).toBe(false);
  });

  it('come from sprouts picked up (the first of each), or all of them for the giver', () => {
    const garden = [sprout({ id: 'b', theme: 'daisy', at: 2000 }), sprout({ id: 'a', theme: 'daisy', at: 1000 }), sprout({ id: 'c' })];
    expect(giftThemesOf(garden, 'sam')).toEqual([{ theme: 'daisy', sprout: 'a', from: 'uM', handle: 'matt.raves', name: 'Matt', at: 1000 }]);
    expect(giftThemesOf([sprout({})], 'sam')).toEqual([]);
    expect(giftThemesOf([], 'matt.raves').map((g) => g.theme)).toEqual(['daisy']);
  });

  it('can only be picked, worn and shown by someone who has them', () => {
    const daisy = themeOf('daisy');
    expect(themeChoices('u1').some((x) => x.id === 'daisy')).toBe(false);
    expect(themeChoices('u1', ['daisy'])[0].id).toBe('daisy');
    expect(canUseTheme(daisy, 'u1', true)).toBe(false);
    expect(canUseTheme(daisy, 'u1', false, ['daisy'])).toBe(true);
    const bg = backdropOf('daisy')!;
    expect(backdropChoices('u1').some((b) => b.id === 'daisy')).toBe(false);
    expect(backdropChoices('u1', ['daisy'])[0].id).toBe('daisy');
    expect(canUse(bg, 'u1', true)).toBe(false);
    expect(canUse(bg, 'u1', false, ['daisy'])).toBe(true);
  });

  it('go back to Afterglow only once the account’s gifts are known and it isn’t among them', () => {
    expect(themeToRevert('daisy', { uid: 'u1' })).toBeUndefined();
    expect(themeToRevert('daisy', { uid: 'u1', gifts: ['daisy'] })).toBeUndefined();
    expect(themeToRevert('daisy', { uid: 'u1', gifts: [] })).toBe('afterglow');
    expect(themeToRevert('daisy', { gifts: [] })).toBeUndefined();
  });

  it('are told in the bell, by who gave them', () => {
    const [n] = themeGiftNotices(giftThemesOf([sprout({ theme: 'daisy' })], 'sam'), (id) => themeOf(id).name);
    expect(n).toMatchObject({ id: 'theme-gift:daisy', kind: 'sprout', title: '@matt.raves gave you a theme: Neon Daisy', href: '/themes?gift=daisy', at: 1000 });
    // The giver's own aren't news.
    expect(themeGiftNotices(giftThemesOf([], 'matt.raves'), (id) => id)).toEqual([]);
  });

  it('are shown once their grant is saved: worn by a new account once it has a profile, offered otherwise', () => {
    const g = { theme: 'daisy' as const, sprout: 's1', from: 'uM', at: 1, granted: true, shown: false };
    expect(giftToShow([g], 'afterglow', true)).toEqual({ sprout: 's1', theme: 'daisy', wear: false, already: false });
    expect(giftToShow([{ ...g, wearOnArrival: true }], 'afterglow', false)).toBeUndefined();
    expect(giftToShow([{ ...g, wearOnArrival: true }], 'afterglow', true)).toMatchObject({ wear: true });
    expect(giftToShow([{ ...g, granted: false }], 'afterglow', true)).toBeUndefined();
    expect(giftToShow([{ ...g, shown: true }], 'afterglow', true)).toBeUndefined();
    expect(giftToShow([g], 'daisy', true)).toMatchObject({ already: true });
    // The giver's own (no sprout) are never shown.
    expect(giftToShow([{ ...g, sprout: '' }], 'afterglow', true)).toBeUndefined();
  });

  it('a gift theme on a sprout you give is kept on the phone, and nothing else is', () => {
    const base = { id: 'abcdefghijkmnpqrstuv', kind: 'seedling', at: 1, sent: false, tries: 0 };
    expect(cleanGifts([{ ...base, theme: 'daisy' }])[0].theme).toBe('daisy');
    expect(cleanGifts([{ ...base, theme: 'nebula' }])[0].theme).toBeUndefined();
  });
});
