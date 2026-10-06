import { describe, expect, it } from '@jest/globals';
import { artistLook } from '../artistLook';
import { DRAW } from '../creatures';

describe('signature collectibles', () => {
  it('Ganja White Night get the wobbler, however their name is written', () => {
    for (const name of ['GANJA WHITE NIGHT', 'Ganja White Night']) {
      const look = artistLook({ id: 'ganja-white-night', name, sound: {} } as never);
      expect(look).toMatchObject({ creature: 'wobble', signature: true, name: 'The Wobbler' });
    }
    expect(typeof DRAW.wobble).toBe('function');
  });

  it('LEVEL UP gets the patched bear', () => {
    expect(artistLook({ id: 'level-up', name: 'LEVEL UP', sound: {} } as never)).toMatchObject({ creature: 'patchbear', signature: true, name: 'The Patched bear' });
    expect(typeof DRAW.patchbear).toBe('function');
  });
});
