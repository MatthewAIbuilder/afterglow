import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import type { SharedMemory } from '../../social/models';
import { badgeShareText, cityOf, earnedBadges, earnedLine, filmedThere, hashOf, pinLook, ribbonText, themeOf, toCollect } from '../badges';
import { fitSize, glyphWidth, letterOffsets, lineLength } from '../EnamelPin';

const fest = (id: string, extra: Partial<Festival> = {}): Festival =>
  ({ id, name: id === 'cc4' ? 'Cyclops Cove 4' : 'Eternal NYE 2026', dates: '', location: '', lineup: [], days: [], stages: [], startDate: '2026-12-04', endDate: '2026-12-06', ...extra }) as Festival;
const at = (d: number, h = 22, month = 11) => new Date(2026, month, d, h).toISOString();
const mem = (id: string, festivalId: string | undefined, capturedAt: string): SharedMemory => ({ id, uid: 'u', handle: 'maya', videoUrl: 'https://x/v.mp4', festivalId, capturedAt, createdAt: capturedAt });

describe('festival badges', () => {
  const cc4 = fest('cc4');
  const nye = fest('nye', { startDate: '2026-12-30', endDate: '2026-12-31' });
  const of = (id: string) => ({ cc4, nye })[id as 'cc4' | 'nye'];

  it('count only videos filmed there, on its dates (and the morning after)', () => {
    expect(filmedThere(cc4, at(4))).toBe(true);
    expect(filmedThere(cc4, at(7, 2))).toBe(true);
    expect(filmedThere(cc4, at(3))).toBe(false);
    expect(filmedThere(cc4, at(8))).toBe(false);
    expect(filmedThere(fest('x', { startDate: undefined, endDate: undefined }), at(4))).toBe(false);
    const acl = fest('acl', { startDate: '2026-10-02', endDate: '2026-10-11', weekends: [{ start: '2026-10-02', end: '2026-10-04' }, { start: '2026-10-09', end: '2026-10-11' }] });
    expect(filmedThere(acl, at(10, 20, 9))).toBe(true);
    expect(filmedThere(acl, at(7, 20, 9))).toBe(false);
  });

  it('are earned per festival, most recent first, with the first video', () => {
    const badges = earnedBadges(
      [mem('a', 'cc4', at(5)), mem('b', 'cc4', at(4)), mem('c', 'nye', at(31)), mem('d', 'nye', at(1)), mem('e', undefined, at(5)), mem('f', 'gone', at(5))],
      of,
    );
    expect(badges.map((b) => [b.festivalId, b.videos, b.firstId])).toEqual([
      ['nye', 1, 'c'],
      ['cc4', 2, 'b'],
    ]);
    expect(earnedLine(badges[1])).toBe('Earned Dec 4, 2026 · 2 videos');
  });

  it('lists the ones still to collect', () => {
    const earned = earnedBadges([mem('a', 'cc4', at(5))], of);
    expect(toCollect([cc4, nye], earned, new Date(2026, 9, 3)).map((f) => f.id)).toEqual(['nye']);
    expect(toCollect([nye], [], new Date(2027, 0, 5))).toEqual([]);
  });

  it('give every festival its own pin, the same every time', () => {
    expect(pinLook(cc4)).toEqual(pinLook(cc4));
    expect(hashOf('cc4')).not.toBe(hashOf('nye'));
    expect(pinLook({ ...cc4, location: 'Sunset Cove Amphitheater, Boca Raton' })).toMatchObject({ theme: 'eye', rimText: 'CYCLOPS COVE 4 · BOCA RATON', ribbon: 'DEC 4–6 · 2026', mark: 'CC4' });
  });

  it('pick a scene that says which festival it is', () => {
    const t = (name: string, location = '') => themeOf({ id: name, name, location });
    expect([t('Cyclops Cove 4'), t('EDC Orlando 2026'), t('Eternal NYE 2026'), t('Countdown NYE 2026'), t('Austin City Limits 2026'), t('Lost Lands 2027')]).toEqual(['eye', 'daisy', 'infinity', 'clock', 'skyline', 'dino']);
    expect(t('Sun Fest', 'Miami Beach')).toBe('beach');
    expect(t('Horizon 2027', 'Desert Valley')).toBe('desert');
  });

  it('put the town in the rim and the dates on the ribbon', () => {
    expect([cityOf('Sunset Cove Amphitheater, Boca Raton'), cityOf('Austin, Texas'), cityOf('Lakeside Grounds'), cityOf(undefined)]).toEqual(['BOCA RATON', 'AUSTIN', 'LAKESIDE GROUNDS', undefined]);
    // Venue, town and state, as EDMTrain writes places: the town, never the venue.
    expect([cityOf('NOS Events Center, San Bernardino, CA'), cityOf('Legend Valley, Thornville, Ohio, USA'), cityOf('Florida')]).toEqual(['SAN BERNARDINO', 'THORNVILLE', 'FLORIDA']);
    expect(ribbonText({ startDate: '2026-12-31', endDate: '2027-01-01' })).toBe('DEC 31–JAN 1 · 2027');
    expect(ribbonText({ startDate: '2026-11-07' })).toBe('NOV 7 · 2026');
    expect(ribbonText({})).toBeUndefined();
    // The city isn't repeated when it's already in the name.
    expect(pinLook({ id: 'acl', name: 'Austin City Limits 2026', location: 'Austin, Texas' }).rimText).toBe('AUSTIN CITY LIMITS');
  });
});

describe('sharing a badge', () => {
  it('says whose it is, with a link', () => {
    expect(badgeShareText('Cyclops Cove 4', 'https://afterglowmusic.app/u/maya', true)).toBe('I collected the Cyclops Cove 4 badge on Afterglow. Only people who filmed there get one.\nhttps://afterglowmusic.app/u/maya');
    expect(badgeShareText('Cyclops Cove 4', 'https://x', false, 'sam')).toMatch(/^@sam collected the Cyclops Cove 4 badge/);
  });
});

describe('pin lettering', () => {
  it('fits long names into the rim and keeps short ones at full size', () => {
    const room = 150;
    expect(fitSize('EDC ORLANDO', room, 0.55, 6.2, 3.6)).toBe(6.2);
    const long = 'SOME REALLY LONG FESTIVAL NAME WEEKENDER · SOMEWHERE';
    const size = fitSize(long, room, 0.55, 6.2, 3.6);
    expect(size).toBeLessThan(6.2);
    expect(lineLength(long, size, 0.55)).toBeLessThanOrEqual(room + 0.001);
  });
  it('centres the letters on the middle of the line', () => {
    const letters = letterOffsets('DEC 4–6 · 2026', 6, 0.6);
    const half = lineLength('DEC 4–6 · 2026', 6, 0.6) / 2;
    // The first letter starts as far left of the middle as the last one ends to the right.
    expect(letters[0].mid - (glyphWidth('D') * 6) / 2).toBeCloseTo(-half, 5);
    expect(letters[letters.length - 1].mid + (glyphWidth('6') * 6) / 2).toBeCloseTo(half, 5);
  });
});

