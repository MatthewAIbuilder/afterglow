import { describe, expect, it } from '@jest/globals';
import { stickerLook } from '../../sprouts/artistLook';
import { findLook, isHolo } from '../finds';

const codes = Array.from({ length: 400 }, (_, i) => `code${String(i).padStart(6, '0')}`);

describe('holo stickers', () => {
  it('about one in twelve finds come out holo, the same every time', () => {
    const holo = codes.filter((code) => isHolo({ code, account: 'acc1', state: 'found' }));
    expect(holo.length).toBeGreaterThan(400 / 24);
    expect(holo.length).toBeLessThan(400 / 6);
    expect(codes.filter((code) => isHolo({ code, account: 'acc1', state: 'found' }))).toEqual(holo);
  });

  it('only a find that’s found, and tied to an account', () => {
    const code = codes.find((c) => isHolo({ code: c, account: 'acc1', state: 'found' }))!;
    expect(isHolo({ code, account: 'acc1', state: 'checking' })).toBe(false);
    expect(isHolo({ code, account: undefined, state: 'found' })).toBe(false);
  });

  it('a holo find wears its other colours', () => {
    const code = codes.find((c) => isHolo({ code: c, account: 'acc1', state: 'found' }))!;
    const plain = codes.find((c) => !isHolo({ code: c, account: 'acc1', state: 'found' }))!;
    expect(findLook({ code: plain, account: 'acc1', state: 'found', creature: 'tent' })).toEqual(stickerLook('tent'));
    expect(findLook({ code, account: 'acc1', state: 'found', creature: 'tent' }).palette).not.toEqual(stickerLook('tent')!.palette);
  });
});
