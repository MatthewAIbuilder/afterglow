import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { sproutNotices, claimsToSend, cleanClaims, cleanGifts, CLAIM_KEEP_MS, giftsToSend, queueClaim, retryDelay, tidy, type Gift } from '../outbox';
import {
  cleanBloomed,
  festivalDaysOf,
  garden,
  gardenLine,
  giftTitle,
  givableKinds,
  growthLine,
  growthOf,
  newlyBloomed,
  readSproutLink,
  seedsLeft,
  seedsLine,
  sproutIdFrom,
  sproutLink,
  type Journey,
} from '../sprouts';

const at = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h).getTime();
const none: Journey = { watched: [], filmed: [], gave: [], festivalDays: [] };
const card = { id: 'abcdefghijkmnpqrstuv', kind: 'plur' as const, from: 'uid-1', handle: 'maya', name: 'Maya Chen' };

describe('sprout codes', () => {
  it('make a link a phone camera opens, and read it back', () => {
    const link = sproutLink(card);
    expect(link).toBe('https://afterglowmusic.app/sprout/abcdefghijkmnpqrstuv?u=uid-1&h=maya&k=plur&n=Maya%20Chen');
    expect(readSproutLink(link)).toEqual(card);
    expect(readSproutLink(link.replace('https://afterglowmusic.app', 'afterglow:/'))).toEqual(card);
  });

  it('turn away anything else', () => {
    expect(readSproutLink('https://example.com/sprout/abcdefghijkmnpqrstuv?u=a&h=maya')).toBeUndefined();
    expect(readSproutLink('https://afterglowmusic.app/add/maya?u=a&c=b')).toBeUndefined();
    expect(readSproutLink('https://afterglowmusic.app/sprout/short?u=a&h=maya')).toBeUndefined();
    // An unknown kind is a plain sprout.
    expect(readSproutLink('https://afterglowmusic.app/sprout/abcdefghijkmnpqrstuv?u=a&h=maya&k=gold')?.kind).toBe('seedling');
  });

  it('ids are long and from a safe alphabet', () => {
    const id = sproutIdFrom(Array.from({ length: 20 }, (_, i) => i * 13));
    expect(id).toMatch(/^[a-z2-9]{20}$/);
  });

  it('say who gave what', () => {
    expect(giftTitle(card)).toBe('Maya Chen gave you a PLUR sprout');
    expect(giftTitle({ name: 'Sam', kind: 'seedling' })).toBe('Sam gave you a Sprout');
  });
});

describe('seeds', () => {
  it('a few a day, more on a festival day, new ones at 4 AM', () => {
    const now = at(10, 3, 20);
    const given = [at(10, 3, 9), at(10, 3, 18), at(10, 3, 2) /* yesterday's quest day */];
    expect(seedsLeft(given, now, false)).toBe(3);
    expect(seedsLeft(given, now, true)).toBe(8);
    expect(seedsLine(3, false)).toBe('3 of 5 seeds left today');
    expect(seedsLine(0, false)).toBe('No seeds left today. New ones at 4 AM.');
    expect(seedsLine(8, true)).toBe('8 of 10 seeds left today · festival day, double seeds');
  });
});

describe('growing', () => {
  it('grows with what you do after it arrives, through four stages', () => {
    const since = at(10, 1);
    const j: Journey = { ...none, watched: [{ at: at(9, 30) }, { at: at(10, 2), sound: 'dubstep' }, { at: at(10, 2), sound: 'riddim' }] };
    const g = growthOf(j, since, at(10, 3));
    expect(g.points).toBe(2);
    expect(g.stage).toBe(0);
    expect(g.leaning).toBe('bass');
    expect(growthLine(g)).toBe('Seed · 4 more growth to sprout');
    const big = growthOf({ ...j, festivalDays: [at(10, 2), at(10, 3)], gave: [at(10, 2)] }, since, at(10, 4));
    expect(big.points).toBe(2 + 16 + 4);
    expect(big.stage).toBe(2);
    expect(big.leaning).toBe('wanderer');
  });

  it('the kind it blooms into follows what grew it most', () => {
    const since = at(10, 1);
    const now = at(10, 20);
    expect(growthOf({ ...none, gave: Array(10).fill(at(10, 2)) }, since, now).leaning).toBe('plur');
    expect(growthOf({ ...none, filmed: Array(12).fill(at(10, 2, 21)) }, since, now).leaning).toBe('spotlight');
    expect(growthOf({ ...none, filmed: [...Array(11).fill(at(10, 2, 21)), at(10, 3, 6)] }, since, now).leaning).toBe('sunrise');
    expect(growthOf({ ...none, watched: Array(40).fill({ at: at(10, 2), sound: 'house' }) }, since, now).leaning).toBe('groove');
    expect(growthOf({ ...none, watched: Array(40).fill({ at: at(10, 2), sound: 'melodic-bass' }) }, since, now).leaning).toBe('melody');
  });

  it('counts the festival days you’re going to, up to now', () => {
    const f = { id: 'cc', startDate: '2026-12-04', endDate: '2026-12-06' } as Festival;
    expect(festivalDaysOf([f], ['cc'], new Date(2026, 11, 5, 20).getTime())).toHaveLength(2);
    expect(festivalDaysOf([f], [], new Date(2026, 11, 7).getTime())).toHaveLength(0);
  });

  it('a garden remembers what each sprout bloomed into, and those kinds can be given', () => {
    const sprouts = [
      { id: 'a', kind: 'seedling' as const, from: '', at: at(10, 1) },
      { id: 'b', kind: 'bass' as const, from: 'u2', handle: 'sam', at: at(10, 2) },
    ];
    const j: Journey = { ...none, festivalDays: [at(10, 2), at(10, 3), at(10, 4), at(10, 5), at(10, 6)] };
    const view = garden(sprouts, j, {}, at(10, 7));
    expect(view.map((s) => [s.id, s.shown, s.stage])).toEqual([
      ['b', 'bass', 3],
      ['a', 'wanderer', 3],
    ]);
    expect(newlyBloomed(view, {})).toEqual({ a: 'wanderer' });
    // A received kind isn't yours to give until you grow it.
    expect(givableKinds(view, {})).toEqual(['seedling', 'wanderer']);
    // Remembered, it stays that kind whatever comes next.
    const later = garden(sprouts, { ...j, gave: Array(40).fill(at(10, 8)) }, { a: 'wanderer' }, at(10, 9));
    expect(later.find((s) => s.id === 'a')?.shown).toBe('wanderer');
    expect(gardenLine(view)).toBe('2 sprouts · 2 kinds');
    expect(cleanBloomed({ a: 'wanderer', b: 'gold', c: 'seedling' })).toEqual({ a: 'wanderer' });
  });
});

describe('outbox', () => {
  it('waits longer after each try', () => {
    expect(retryDelay(1)).toBe(15_000);
    expect(retryDelay(3)).toBe(60_000);
    expect(retryDelay(20)).toBe(300_000);
  });

  it('keeps one scan per sprout, sends it for the right account, and lets go after a few days', () => {
    let claims = queueClaim([], card, undefined, at(10, 3));
    claims = queueClaim(claims, card, 'me', at(10, 3));
    expect(claims).toHaveLength(1);
    expect(claimsToSend(claims, 'me', at(10, 3))).toHaveLength(1);
    const later = tidy([], claims, at(10, 3) + CLAIM_KEEP_MS + 1).claims;
    expect(later[0].state).toBe('gone');
    expect(cleanClaims([...claims, { card: { id: 'x' }, state: 'waiting', at: 1 }])).toHaveLength(1);
  });

  it('sends gifts oldest first and reads them back safely', () => {
    const gifts: Gift[] = [
      { id: 'bbbbbbbbbbbbbbbbbbbb', kind: 'seedling', at: 2, sent: false, tries: 0 },
      { id: 'aaaaaaaaaaaaaaaaaaaa', kind: 'plur', at: 1, sent: false, tries: 1, lastTry: 100 },
      { id: 'cccccccccccccccccccc', kind: 'plur', at: 0, sent: true, tries: 0 },
    ];
    expect(giftsToSend(gifts, 100).map((g) => g.id)).toEqual(['bbbbbbbbbbbbbbbbbbbb']);
    expect(giftsToSend(gifts, 100 + 15_000).map((g) => g.id)).toEqual(['aaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbb']);
    expect(cleanGifts([...gifts, { id: 'no', kind: 'plur', at: 1 }])).toHaveLength(3);
  });
});

describe('the bell', () => {
  it('says who picked up your sprouts lately, newest first', () => {
    const now = at(10, 20);
    const gifts: Gift[] = [
      { id: 'aaaaaaaaaaaaaaaaaaaa', kind: 'plur', at: at(10, 1), sent: true, tries: 0, claimedBy: { uid: 's', name: 'Sam' }, claimedAt: at(10, 18), note: 'Hi' },
      { id: 'bbbbbbbbbbbbbbbbbbbb', kind: 'seedling', at: at(10, 1), sent: true, tries: 0, claimedBy: { uid: 'j', handle: 'jojo' }, claimedAt: at(10, 19) },
      { id: 'cccccccccccccccccccc', kind: 'seedling', at: at(9, 1), sent: true, tries: 0, claimedBy: { uid: 'k', name: 'Kai' }, claimedAt: at(9, 2) },
      { id: 'dddddddddddddddddddd', kind: 'seedling', at: at(10, 19), sent: true, tries: 0 },
    ];
    expect(sproutNotices(gifts, now).map((n) => [n.title, n.body])).toEqual([
      ['@jojo picked up your Sprout', 'It’s growing in their garden now.'],
      ['Sam picked up your PLUR sprout', 'With your note: “Hi”. It’s growing in their garden now.'],
    ]);
  });
});
