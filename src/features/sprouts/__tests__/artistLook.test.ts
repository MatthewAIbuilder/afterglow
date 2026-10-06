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
    expect(artistLook({ id: 'sullivan-king', name: 'Sullivan King', sound: {} } as never)).toMatchObject({ creature: 'thornskull', signature: true, name: 'The Thorn King' });
    expect(typeof DRAW.thornskull).toBe('function');
    expect(artistLook({ id: 'wooli', name: 'Wooli', sound: {} } as never)).toMatchObject({ creature: 'mammoth', signature: true, name: 'The Mammoth' });
    expect(typeof DRAW.mammoth).toBe('function');
    expect(artistLook({ id: 'excision', name: 'Excision', sound: {} } as never)).toMatchObject({ creature: 'dino', signature: true, name: 'The Dinosaur' });
    expect(typeof DRAW.dino).toBe('function');
    // More signatures: each artist gets its own drawing.
    const more: [string, string, string][] = [
      ['SVDDEN DEATH', 'stagskull', 'The Stag skull'],
      ['VOYD', 'stagskull', 'The Stag skull'],
      ['Liquid Stranger', 'captain', 'The Captain'],
      ['Kai Wachi', 'gladiator', 'The Gladiator'],
      ['Porter Robinson', 'dreamcube', 'The Dream cube'],
      ['Said The Sky', 'paperplane', 'The Paper plane'],
      ['ODESZA', 'icosa', 'The Icosahedron'],
      ['REZZ', 'goggles', 'The Hypnotist'],
      ['Eric Prydz', 'hologram', 'The Hologram'],
      ['deadmau5', 'mousehead', 'The Mouse head'],
      ['Marshmello', 'mallow', 'The Marshmallow'],
      ['Alan Walker', 'hooded', 'The Hooded figure'],
      ['Zedd', 'prism', 'The Prism'],
      ['San Holo', 'dove', 'The White bird'],
      ['Steve Aoki', 'cake', 'The Flying cake'],
      ['Tchami', 'stainedglass', 'The Window'],
      ['ATLiens', 'chromemask', 'The Masked visitor'],
    ];
    for (const [name, creature, title] of more) {
      expect(artistLook({ id: name, name, sound: {} } as never)).toMatchObject({ creature, signature: true, name: title });
      expect(typeof DRAW[creature as keyof typeof DRAW]).toBe('function');
    }
    expect(artistLook({ id: 'slander', name: 'SLANDER', sound: {} } as never)).toMatchObject({ creature: 'trooper', signature: true, name: 'The Trooper' });
    expect(typeof DRAW.trooper).toBe('function');
  });
});
