import { describe, expect, it } from '@jest/globals';
import type { Artist, Festival } from '../../../data/models';
import { momentCaption, shortYear } from '../momentCaption';

const artists: Record<string, Partial<Artist>> = { boogie: { name: 'BOOGIE T' }, subtronics: { name: 'SUBTRONICS' }, level: { name: 'LEVEL UP' } };
const lookup = {
  artist: (id: string) => artists[id] as Artist | undefined,
  festival: (id: string) => (id === 'edc' ? ({ name: 'EDC Orlando 2026' } as Festival) : undefined),
};

describe('momentCaption', () => {
  it('names everyone in a b2b, main artist first, skipping ones Afterglow does not know', () => {
    expect(momentCaption({ artistId: 'boogie', withArtistIds: ['subtronics', 'nobody', 'level'] }, lookup).artists).toEqual(['BOOGIE T', 'SUBTRONICS', 'LEVEL UP']);
  });

  it('uses a typed-in name when the artist is not on Afterglow yet', () => {
    expect(momentCaption({ artistId: 'new-1', artistName: 'Someone New' }, lookup).artists).toEqual(['Someone New']);
  });

  it('writes the festival in full with a short year, a throwback with its rewind, a show by its name', () => {
    expect(momentCaption({ festivalId: 'edc' }, lookup)).toEqual({ artists: [], where: 'EDC Orlando ’26', throwback: false });
    expect(momentCaption({ past: { name: 'Lost Lands', year: 2025 } }, lookup)).toEqual({ artists: [], where: 'Lost Lands ’25', throwback: true });
    expect(momentCaption({ show: { name: 'Echostage', date: '2026-05-01' } }, lookup).where).toBe('Echostage');
  });

  it('shortYear leaves names without a year alone', () => {
    expect(shortYear('Cyclops Cove 4')).toBe('Cyclops Cove 4');
    expect(shortYear('Countdown NYE 2026')).toBe('Countdown NYE ’26');
  });
});
