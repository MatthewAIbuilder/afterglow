import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { GNOME_FRIENDS } from '../../profile/backdrops';
import { bloomNotices, sproutNotices, wildNotices, claimsToSend, cleanClaims, cleanGifts, CLAIM_KEEP_MS, GIFT_REFUSED_MAX, giftsToSend, giftTried, nextDue, passingOn, queueClaim, retryDelay, seedGifts, tidy, type Gift } from '../outbox';
import {
  CATERPILLAR_FRIENDS,
  KEEPS_EVERY_KIND,
  cleanBloomed,
  festivalDaysOf,
  garden,
  gardenLine,
  giftTitle,
  givableKinds,
  growthLine,
  growthOf,
  keptKinds,
  keptSprouts,
  kindListed,
  kindOf,
  newlyBloomed,
  giftStage,
  grownName,
  isReceived,
  passable,
  toPass,
  stageName,
  readSproutLink,
  seedsLeft,
  seedsLine,
  sproutIdFrom,
  sproutLink,
  wildKind,
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
    // Marked going on the Saturday morning: only Saturday and Sunday count.
    const since = new Date(2026, 11, 5, 9).getTime();
    expect(festivalDaysOf([f], ['cc'], new Date(2026, 11, 7).getTime(), () => since)).toHaveLength(2);
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
    // Every grown kind in your garden can be given away (giving moves it), the one you were given first.
    expect(givableKinds(view)).toEqual(['seedling', 'wanderer', 'bass']);
    expect(passable(view).map((s) => s.id)).toEqual(['b', 'a']);
    expect(toPass(view, 'wanderer')?.id).toBe('a');
    expect(toPass(view, 'plur')).toBeUndefined();
    expect(isReceived(view[0])).toBe(true);
    expect(isReceived({ ...view[1], id: 'starter' })).toBe(false);
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

  it('keeps trying a gift with no signal, but gives up after a few refusals and gives the seed back', () => {
    let g: Gift = { id: 'dddddddddddddddddddd', kind: 'plur', at: 1, sent: false, tries: 0 };
    for (let i = 0; i < 20; i++) g = giftTried(g, false, 100 + i);
    expect(g.failed).toBeUndefined();
    expect(seedGifts([g])).toHaveLength(1);
    for (let i = 0; i < GIFT_REFUSED_MAX - 1; i++) g = giftTried(g, true, 200 + i);
    expect(g.failed).toBeUndefined();
    g = giftTried(g, true, 300);
    expect(g).toMatchObject({ failed: true, refused: GIFT_REFUSED_MAX });
    expect(giftsToSend([g], 10_000_000)).toEqual([]);
    expect(nextDue([g], [])).toBeUndefined();
    expect(seedGifts([g])).toEqual([]);
    expect(cleanGifts([g])[0]).toMatchObject({ failed: true, refused: GIFT_REFUSED_MAX });
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

  it('says when one of your sprouts bloomed', () => {
    const now = at(10, 20);
    const list = bloomNotices([{ id: 'a', kind: 'wanderer', at: at(10, 19) }, { id: 'b', kind: 'plur', at: at(9, 1) }], now);
    expect(list.map((n) => [n.id, n.title, n.body])).toEqual([['bloom:a', 'Your sprout bloomed into a Wanderer sprout', 'You can give it away now: it moves to their garden.']]);
  });

  it('a wild sprout: a grown kind picked by the festival and night, and bell news', () => {
    const k = wildKind('wild:cyclops-cove-4:2026-12-05');
    expect(k).not.toBe('seedling');
    expect(wildKind('wild:cyclops-cove-4:2026-12-05')).toBe(k);
    const kinds = new Set(Array.from({ length: 30 }, (_, i) => wildKind(`wild:f:2026-12-${i}`)));
    expect(kinds.size).toBeGreaterThan(3);
    const list = wildNotices([{ id: 'wild:x:2026-10-19', kind: 'bass', from: '', at: at(10, 19), foundAt: 'Cove' }], at(10, 20));
    expect(list[0].title).toBe('A wild Bass sprout appeared at Cove');
  });
  it('gnome hats: arrive as a hat, grow into a gnome, and only a grown one someone gave you can be passed on', () => {
    const keeper = GNOME_FRIENDS[0];
    expect(keptKinds(keeper)).toEqual(['gnome']);
    expect(keptKinds('someone')).toEqual([]);
    expect(keptSprouts('someone', at(1, 1))).toEqual([]);
    // The keeper's own hat, planted when it shipped (or when they started, if later).
    const [own] = keptSprouts(keeper, at(1, 1));
    expect(own).toMatchObject({ id: 'kept-gnome', kind: 'gnome', at: kindOf('gnome').plantedAt });
    expect(keptSprouts(keeper, at(12, 1))[0].at).toBe(at(12, 1));
    // A hat someone gave you grows from when it arrived, always into a gnome.
    const given = { id: 'hat1', kind: 'gnome' as const, from: keeper, name: 'Grace', at: at(10, 10) };
    expect(garden([given], none, {}, at(10, 11))[0]).toMatchObject({ shown: 'gnome', stage: 0 });
    expect(stageName('gnome', 0)).toBe('Gnome hat');
    expect(growthLine(garden([given], none, {}, at(10, 11))[0].growth!, 'gnome')).toBe('Gnome hat · 6 more growth to peeking out');
    const j: Journey = { ...none, festivalDays: [at(10, 11), at(10, 12), at(10, 13), at(10, 14), at(10, 15)] };
    const grown = garden([given], j, {}, at(10, 16));
    expect(grown[0]).toMatchObject({ shown: 'gnome', stage: 3 });
    expect(newlyBloomed(grown, {})).toEqual({ hat1: 'gnome' });
    // Remembered grown, it stays grown.
    expect(garden([given], none, { hat1: 'gnome' }, at(10, 16))[0].stage).toBe(3);
    // Not until it's grown can it be passed on; the keeper gives them any time; their own one never goes.
    expect(passable(garden([given], none, {}, at(10, 11)))).toEqual([]);
    expect(passable(grown).map((s) => s.id)).toEqual(['hat1']);
    expect(givableKinds(garden([given], none, {}, at(10, 11)), 'someone')).toEqual(['seedling']);
    expect(givableKinds(grown, 'someone')).toEqual(['seedling', 'gnome']);
    expect(givableKinds([], keeper)).toEqual(['seedling', 'gnome']);
    const ownGrown = garden([own], j, {}, at(12, 1));
    expect(ownGrown[0].stage).toBe(3);
    expect(passable(ownGrown)).toEqual([]);
    // How it looks given: a hat.
    expect(giftStage('gnome')).toBe(0);
    expect(giftStage('seedling')).toBe(2);
    expect(giftStage('plur')).toBe(3);
    expect(grownName('gnome')).toBe('Gnome');
    // Listed among the kinds to collect only for someone who has one, or keeps them.
    expect(kindListed(kindOf('gnome'), new Set())).toBe(false);
    expect(kindListed(kindOf('gnome'), new Set(['gnome']))).toBe(true);
    expect(kindListed(kindOf('gnome'), new Set(), keeper)).toBe(true);
    expect(kindListed(kindOf('plur'), new Set())).toBe(true);
  });
  it('caterpillars: their keeper and the every-kind keeper give them; one grows into a butterfly and can then be passed on', () => {
    const jannik = CATERPILLAR_FRIENDS[0];
    const all = KEEPS_EVERY_KIND[0];
    expect(keptKinds(jannik)).toEqual(['caterpillar']);
    expect(keptKinds(all)).toEqual(['gnome', 'caterpillar']);
    expect(keptKinds(GNOME_FRIENDS[0])).toEqual(['gnome']);
    expect(keptSprouts(all, at(1, 1)).map((s) => s.id)).toEqual(['kept-gnome', 'kept-caterpillar']);
    expect(givableKinds([], jannik)).toEqual(['seedling', 'caterpillar']);
    expect(givableKinds([], all)).toEqual(['seedling', 'gnome', 'caterpillar']);
    const given = { id: 'cat1', kind: 'caterpillar' as const, from: jannik, name: 'Jannik', at: at(10, 10) };
    expect(garden([given], none, {}, at(10, 11))[0]).toMatchObject({ shown: 'caterpillar', stage: 0 });
    expect(stageName('caterpillar', 0)).toBe('Caterpillar');
    expect(growthLine(garden([given], none, {}, at(10, 11))[0].growth!, 'caterpillar')).toBe('Caterpillar · 6 more growth to munching');
    const j: Journey = { ...none, festivalDays: [at(10, 11), at(10, 12), at(10, 13), at(10, 14), at(10, 15)] };
    const grown = garden([given], j, {}, at(10, 16));
    expect(grown[0]).toMatchObject({ shown: 'caterpillar', stage: 3 });
    expect(grownName('caterpillar')).toBe('Butterfly');
    expect(giftStage('caterpillar')).toBe(0);
    expect(givableKinds(garden([given], none, {}, at(10, 11)), 'someone')).toEqual(['seedling']);
    expect(givableKinds(grown, 'someone')).toEqual(['seedling', 'caterpillar']);
    expect(kindListed(kindOf('caterpillar'), new Set())).toBe(false);
    expect(kindListed(kindOf('caterpillar'), new Set(), all)).toBe(true);
    expect(kindListed(kindOf('gnome'), new Set(), all)).toBe(true);
  });
  it('a hat on its way to someone has left your garden, uses no seed, and is kept until someone has it', () => {
    const hat: Gift = { id: 'passaaaaaaaaaaaaaaaa', kind: 'gnome', via: 'hat1aaaaaaaaaaaaaaaa', at: at(10, 1), sent: true, tries: 0 };
    const plain: Gift = { id: 'plainaaaaaaaaaaaaaaa', kind: 'seedling', at: at(10, 1), sent: true, tries: 0 };
    expect([...passingOn([hat, plain])]).toEqual(['hat1aaaaaaaaaaaaaaaa']);
    expect([...passingOn([{ ...hat, takenBack: true }, { ...hat, id: 'xaaaaaaaaaaaaaaaaaaa', failed: true }])]).toEqual([]);
    expect(seedGifts([hat, plain]).map((g) => g.id)).toEqual([plain.id]);
    // Long after: a plain one is let go, the hat stays so it can still be taken back.
    expect(tidy([hat, plain], [], at(12, 30)).gifts.map((g) => g.id)).toEqual([hat.id]);
    expect(cleanGifts([hat, { ...plain, via: 'not an id!' }])).toEqual([hat, plain]);
  });
});
