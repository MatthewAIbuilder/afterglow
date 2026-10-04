import { describe, expect, it } from '@jest/globals';
import { SOUND_TAGS } from '../../../data/models';
import { artistsIn, closeTo, nextSounds, otherSounds, SOUND_GUIDE, soundTips } from '../guide';

describe('the sound guide', () => {
  it('covers every sound, with neighbours that are sounds too', () => {
    for (const t of SOUND_TAGS) {
      expect(SOUND_GUIDE[t].feel.length).toBeGreaterThan(20);
      expect(SOUND_GUIDE[t].listenFor).toHaveLength(3);
      for (const n of SOUND_GUIDE[t].near) expect(SOUND_TAGS).toContain(n);
    }
  });

  it('suggests neighbours you don’t lean towards yet, and says why', () => {
    expect(nextSounds(['dubstep', 'riddim'])).toEqual(['melodic-bass', 'trap']);
    expect(nextSounds([])).toEqual(['melodic-bass', 'house']);
    expect(closeTo('trap', ['dubstep', 'riddim'])).toBe('Close to dubstep');
    expect(otherSounds(['dubstep', 'riddim', 'melodic-bass', 'trap'])).not.toContain('dubstep');
  });

  it('finds the artists most in a sound, your best matches first', () => {
    const artists = [
      { id: 'a', sound: { dubstep: 1 } },
      { id: 'b', sound: { dubstep: 0.4, house: 0.6 } },
      { id: 'c', sound: { dubstep: 0.6, house: 0.4 } },
      { id: 'd', sound: { house: 1 } },
    ];
    expect(artistsIn('dubstep', artists, { c: 0.9, a: 0.5 }).map((a) => a.id)).toEqual(['c', 'a']);
  });

  it('tips fit where you are', () => {
    expect(soundTips({ shaped: false, canConnect: true, hasFestivals: true }).map((t) => t.id)).toEqual(['this-or-that', 'connect', 'react']);
    expect(soundTips({ shaped: true, canConnect: true, hasFestivals: true }).map((t) => t.id)).toEqual(['explore', 'festival', 'react']);
    expect(soundTips({ shaped: true, canConnect: false, hasFestivals: false }).map((t) => t.id)).toEqual(['explore', 'react', 'pick']);
  });
});
