import { describe, expect, it } from '@jest/globals';
import { artistById } from '../../../data/artists';
import { reasonNote } from '../copy';

describe('why a clip is in your feed', () => {
  it('says nothing for a strong match', () => {
    expect(reasonNote({ kind: 'match' }, artistById)).toBeUndefined();
  });

  it('names the artist a related clip is close to', () => {
    expect(reasonNote({ kind: 'near', artistId: 'illenium' }, artistById)).toBe('Close to ILLENIUM');
    expect(reasonNote({ kind: 'near', artistId: 'nobody' }, artistById)).toBe('Close to your sound');
  });

  it('marks new directions plainly', () => {
    expect(reasonNote({ kind: 'new-sound' }, artistById)).toBe('A different sound');
    expect(reasonNote({ kind: 'unknown' }, artistById)).toBe('New to you');
  });
});
