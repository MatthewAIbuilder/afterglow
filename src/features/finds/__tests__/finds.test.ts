import { describe, expect, it } from '@jest/globals';
import {
  adopt,
  checked,
  cleanFinds,
  cleanHunt,
  codeFrom,
  type Find,
  findCardFrom,
  findLine,
  findLink,
  findsFor,
  findsToCheck,
  findsToSend,
  type Hunt,
  huntDateLine,
  huntLine,
  huntShareText,
  huntProgress,
  missed,
  nextFindDue,
  parseEndDate,
  queueFind,
  readFindLink,
  retryDelay,
  untilLine,
} from '../finds';

const card = { code: 'ferris2027', creature: 'ferris', name: 'Ferris wheel · Night Market' };

describe('sticker codes', () => {
  it('carry the creature and name, and read back from any Afterglow address', () => {
    const link = findLink(card);
    expect(link).toBe('https://afterglowmusic.app/find/ferris2027?c=ferris&n=Ferris%20wheel%20%C2%B7%20Night%20Market');
    expect(readFindLink(link)).toEqual(card);
    expect(readFindLink('https://afterglowmusic.web.app/find/ferris2027')).toEqual({ code: 'ferris2027', creature: 'wisp', name: 'A sticker' });
    expect(readFindLink('afterglow://find/ferris2027?c=frog&n=Hi')).toEqual({ code: 'ferris2027', creature: 'frog', name: 'Hi' });
  });

  it('turns down anything else', () => {
    expect(readFindLink('https://example.com/find/ferris2027')).toBeUndefined();
    expect(readFindLink('https://afterglowmusic.app/find/ab')).toBeUndefined();
    expect(readFindLink('https://afterglowmusic.app/sprout/ferris2027?u=x')).toBeUndefined();
    expect(findCardFrom({ code: 'NOT A CODE' })).toBeUndefined();
  });

  it('never shows an artist’s hand-made creature from a link', () => {
    // The eye is SUBTRONICS'; stickers can't be it.
    expect(findCardFrom({ code: 'abcdefgh', c: 'eye' })?.creature).toBe('wisp');
    expect(findCardFrom({ code: 'abcdefgh', c: 'beast' })?.creature).toBe('beast');
  });

  it('makes readable codes', () => {
    const c = codeFrom([0, 1, 2, 3, 4, 5, 6, 7, 8, 40]);
    expect(c).toHaveLength(10);
    expect(c).toMatch(/^[a-z2-9]+$/);
    expect(c).not.toMatch(/[lo01]/);
  });
});

describe('finding stickers', () => {
  const t0 = Date.UTC(2026, 9, 10, 20);
  it('keeps a scan once per sticker and account', () => {
    const one = queueFind([], card, 'me', t0);
    expect(one).toEqual([{ ...card, at: t0, account: 'me', state: 'checking', sent: false, tries: 0 }]);
    expect(queueFind(one, card, 'me', t0 + 5)).toHaveLength(1);
    expect(queueFind(one, card, 'other', t0 + 5)).toHaveLength(2);
    // Signed out, someone else's find on this phone isn't yours: it's kept as a new one.
    expect(queueFind(one, card, undefined, t0 + 5)).toHaveLength(2);
    // Signed in, your own signed-out scan of it already counts.
    const signedOut = queueFind([], card, undefined, t0);
    expect(queueFind(signedOut, card, undefined, t0 + 5)).toHaveLength(1);
    expect(queueFind(signedOut, card, 'me', t0 + 5)).toHaveLength(1);
  });

  it('takes Afterglow’s copy, and an end date counts from when you scanned', () => {
    const [f] = queueFind([], { ...card, creature: 'frog', name: 'Edited' }, 'me', t0);
    const sticker = { code: card.code, name: 'Ferris wheel', creature: 'ferris', huntId: 'nightmkt27', slot: 2, until: t0 + 1000 };
    expect(checked(f, sticker, t0 + 99_999_999)).toMatchObject({ state: 'found', name: 'Ferris wheel', creature: 'ferris', huntId: 'nightmkt27', slot: 2 });
    expect(checked({ ...f, at: t0 + 2000 }, sticker, t0 + 3000)).toMatchObject({ state: 'ended', until: t0 + 1000 });
    expect(checked(f, null, t0)).toMatchObject({ state: 'gone' });
  });

  it('checks and sends oldest first, waiting longer after each miss', () => {
    let finds = queueFind(queueFind([], card, 'me', t0), { ...card, code: 'second22' }, 'me', t0 + 10);
    expect(findsToCheck(finds, t0 + 20).map((f) => f.code)).toEqual(['ferris2027', 'second22']);
    finds = finds.map((f) => (f.code === 'second22' ? missed(f, t0 + 20) : checked(f, { code: f.code, name: 'F', creature: 'ferris' }, t0 + 20)));
    expect(findsToCheck(finds, t0 + 21).map((f) => f.code)).toEqual([]);
    expect(findsToCheck(finds, t0 + 20 + retryDelay(1)).map((f) => f.code)).toEqual(['second22']);
    expect(findsToSend(finds, 'me', t0 + 21).map((f) => f.code)).toEqual(['ferris2027']);
    expect(findsToSend(finds, 'someone', t0 + 21)).toEqual([]);
    expect(nextFindDue(finds, 'me')).toBeLessThanOrEqual(t0);
    expect(nextFindDue(finds)).toBe(t0 + 20 + retryDelay(1));
  });

  it('gives finds made signed out to the next account, without doubles', () => {
    const finds = [...queueFind([], card, undefined, t0), ...queueFind([], { ...card, code: 'mine2222' }, 'me', t0)];
    const adopted = adopt(finds, 'me');
    expect(adopted.every((f) => f.account === 'me')).toBe(true);
    expect(findsFor(finds, 'someone').map((f) => f.code)).toEqual(['ferris2027']);
  });

  it('says what happened', () => {
    const [f] = queueFind([], card, undefined, t0);
    expect(findLine(f)).toBe('Saved on your phone. It’s checked as soon as there’s signal.');
    expect(findLine({ ...f, state: 'found' })).toMatch(/^Found Oct 1\d, 2026$/);
    expect(findLine({ ...f, state: 'ended', until: t0 })).toMatch(/^This one could only be found until /);
  });
});

describe('hunts', () => {
  const hunt: Hunt = { id: 'nightmkt27', name: 'Night Market 2027', items: [0, 1, 2].map((i) => ({ creature: 'ferris', name: `Spot ${i}` })) };
  const found = (slot: number): Find => ({ code: `code${slot}abc`, name: 'x', creature: 'ferris', huntId: 'nightmkt27', slot, at: 1, state: 'found', sent: true, tries: 0 });
  it('fills in as you find them, and finishes', () => {
    const [p] = huntProgress([found(0), found(2), { ...found(1), state: 'ended' }], { nightmkt27: hunt });
    expect(p.found).toEqual([true, false, true]);
    expect(huntLine(p)).toBe('2 of 3 found');
    const [done] = huntProgress([found(0), found(1), found(2)], { nightmkt27: hunt });
    expect(done.done).toBe(true);
    expect(huntLine(done)).toBe('All 3 found');
    expect(huntProgress([], { nightmkt27: hunt })).toEqual([]);
    expect(huntShareText(p, 'https://afterglowmusic.app')).toBe('I’ve found 2 of 3 stickers in the Night Market 2027 hunt on Afterglow. https://afterglowmusic.app');
    expect(huntDateLine(p)).toMatch(/^Latest find /);
    expect(huntDateLine(done)).toMatch(/^Finished /);
  });

  it('end dates last until the day is over everywhere, and read back as that day', () => {
    expect(parseEndDate('2027-06-14')).toBe(Date.UTC(2027, 5, 15, 11, 59, 59, 999));
    expect(parseEndDate('2027-02-30')).toBe('bad');
    expect(parseEndDate('soon')).toBe('bad');
    expect(parseEndDate('  ')).toBeUndefined();
    expect(untilLine(parseEndDate('2027-06-14') as number)).toBe('Can be found until Jun 14, 2027');
    // One set the old way (the end of the day on HQ's phone: London, Los Angeles) reads the same.
    expect(untilLine(Date.UTC(2027, 5, 14, 23, 59) - 1 * 3_600_000)).toBe('Can be found until Jun 14, 2027');
    expect(untilLine(Date.UTC(2027, 5, 14, 23, 59) + 7 * 3_600_000)).toBe('Can be found until Jun 14, 2027');
  });

  it('a sticker taken down stops counting, unless you found it first', () => {
    const down: Hunt = { ...hunt, items: hunt.items.map((it, i) => (i === 1 ? { ...it, gone: true as const } : it)) };
    const [p] = huntProgress([found(0), found(2)], { nightmkt27: down });
    expect(p).toMatchObject({ count: 2, total: 2, done: true });
    expect(huntLine(p)).toBe('All 2 found');
    const [early] = huntProgress([found(0), found(1)], { nightmkt27: down });
    expect(early).toMatchObject({ count: 2, total: 3, done: false });
    expect(huntLine(early)).toBe('2 of 3 found');
    expect(cleanHunt('nightmkt27', { name: 'N', items: [{ creature: 'ferris', name: 'F', gone: true }, { creature: 'frog', name: 'G', gone: 'yes' }] })?.items).toEqual([
      { creature: 'ferris', name: 'F', gone: true },
      { creature: 'frog', name: 'G' },
    ]);
  });

  it('reads back only real hunts and finds', () => {
    expect(cleanHunt('nightmkt27', { name: 'NM', items: [{ creature: 'nope', name: '' }, 'junk'] })).toEqual({ id: 'nightmkt27', name: 'NM', items: [{ creature: 'wisp', name: 'A sticker' }] });
    expect(cleanHunt('BAD ID', { name: 'NM', items: [] })).toBeUndefined();
    expect(cleanFinds([found(0), { code: 'x' }, null, { ...found(1), creature: 'eye' }]).map((f) => f.creature)).toEqual(['ferris', 'wisp']);
  });
});
