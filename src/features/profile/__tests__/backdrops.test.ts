import { describe, expect, it } from '@jest/globals';
import { BACKDROPS, backdropChoices, canUse, cleanBackdrop, FROG_FRIENDS, GNOME_FRIENDS, madeFor, NO_BACKDROP, PANDA_FRIENDS, shownBackdrop, TOE_BEACH_FRIENDS } from '../backdrops';
import { TOE_FRIENDS } from '../../toes/toes';
import { publicOrbit } from '../identity';
import type { Artist } from '../../../data/models';

const panda = PANDA_FRIENDS[0];
const frog = FROG_FRIENDS[0];

describe('profile backgrounds', () => {
  it('offers at least ten for everyone, a few of them free', () => {
    const everyone = backdropChoices('someone');
    expect(everyone.length).toBeGreaterThanOrEqual(10);
    expect(everyone.some((b) => b.only)).toBe(false);
    expect(everyone.filter((b) => !b.plus).map((b) => b.id)).toEqual(['aurora', 'pride', 'starfield', 'nebula']);
    expect(new Set(BACKDROPS.map((b) => b.id)).size).toBe(BACKDROPS.length);
  });

  it('Plus ones need Plus, and stop showing when it ends', () => {
    const lasers = BACKDROPS.find((b) => b.id === 'lasers')!;
    expect(canUse(lasers, 'u', false)).toBe(false);
    expect(canUse(lasers, 'u', true)).toBe(true);
    expect(shownBackdrop('lasers', 'u', true)).toBe('lasers');
    expect(shownBackdrop('lasers', 'u', false)).toBeUndefined();
    expect(shownBackdrop('aurora', 'u', false)).toBe('aurora');
    expect(shownBackdrop(undefined, 'u', false)).toBeUndefined();
  });

  it('the panda garden and the frog pond belong to one person each, on by default', () => {
    // The panda garden's owner also has the gnome garden: the newest shows by default, both can be picked.
    expect(GNOME_FRIENDS).toEqual(PANDA_FRIENDS);
    expect(madeFor(panda)?.id).toBe('gnome');
    expect(madeFor(frog)?.id).toBe('frog');
    expect(backdropChoices(panda).slice(0, 2).map((b) => b.id)).toEqual(['panda', 'gnome']);
    expect(backdropChoices(panda).some((b) => b.id === 'frog')).toBe(false);
    expect(backdropChoices('someone').some((b) => b.id === 'gnome')).toBe(false);
    expect(shownBackdrop(undefined, panda, false)).toBe('gnome');
    expect(shownBackdrop('panda', panda, false)).toBe('panda');
    expect(shownBackdrop('gnome', 'someone', true)).toBeUndefined();
    expect(shownBackdrop(undefined, frog, false)).toBe('frog');
    // The toe beach goes to the same person as the hidden toes.
    expect(TOE_BEACH_FRIENDS).toEqual(TOE_FRIENDS);
    expect(shownBackdrop(undefined, TOE_FRIENDS[0], false)).toBe('toes');
    expect(shownBackdrop('toes', panda, true)).toBe('gnome');
    // Someone else can't show them, even by writing the name.
    expect(shownBackdrop('panda', 'someone', true)).toBeUndefined();
    expect(shownBackdrop('frog', panda, true)).toBe('gnome');
    // They can pick another or turn theirs off.
    expect(shownBackdrop('aurora', panda, false)).toBe('aurora');
    expect(shownBackdrop(NO_BACKDROP, panda, false)).toBeUndefined();
  });

  it('reads saved choices without trusting them', () => {
    expect(cleanBackdrop('vortex')).toBe('vortex');
    expect(cleanBackdrop('none')).toBe('none');
    expect(cleanBackdrop('glitter')).toBeUndefined();
    expect(cleanBackdrop(3)).toBeUndefined();
  });
});

describe('who drifts round someone else’s photo', () => {
  const a = (id: string): Artist => ({ id, name: id.toUpperCase(), sound: {} });
  const known = new Map(['subtronics', 'levity', 'hedex', 'kompany'].map((id) => [id, a(id)]));
  const of = (id: string) => known.get(id);

  it('their favourite artists first, then what they filmed, each once', () => {
    const orbit = publicOrbit(['levity', 'gone', 'subtronics'], ['hedex', 'levity', 'hedex', 'kompany'], of);
    expect(orbit.map((o) => o.artist.id)).toEqual(['levity', 'subtronics', 'hedex', 'kompany']);
  });

  it('stops at six', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const all = (id: string) => a(id);
    expect(publicOrbit(many, ['h'], all)).toHaveLength(6);
  });
});
