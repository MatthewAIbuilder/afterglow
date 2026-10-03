import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import type { SharedMemory } from '../../social/models';
import { cityOf, earnedBadges, earnedLine, filmedThere, hashOf, pinLook, ribbonText, themeOf, toCollect } from '../badges';

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
    expect([t('Cyclops Cove 4'), t('EDC Orlando 2026'), t('Eternal NYE 2026'), t('Countdown NYE 2026'), t('Austin City Limits 2026'), t('Lost Lands 2027')]).toEqual(['eye', 'daisy', 'infinity', 'clock', 'skyline', 'lake']);
    expect(t('Sun Fest', 'Miami Beach')).toBe('beach');
    expect(t('Horizon 2027', 'Desert Valley')).toBe('desert');
  });

  it('put the town in the rim and the dates on the ribbon', () => {
    expect([cityOf('Sunset Cove Amphitheater, Boca Raton'), cityOf('Austin, Texas'), cityOf('Lakeside Grounds'), cityOf(undefined)]).toEqual(['BOCA RATON', 'AUSTIN', 'LAKESIDE GROUNDS', undefined]);
    expect(ribbonText({ startDate: '2026-12-31', endDate: '2027-01-01' })).toBe('DEC 31–JAN 1 · 2027');
    expect(ribbonText({ startDate: '2026-11-07' })).toBe('NOV 7 · 2026');
    expect(ribbonText({})).toBeUndefined();
    // The city isn't repeated when it's already in the name.
    expect(pinLook({ id: 'acl', name: 'Austin City Limits 2026', location: 'Austin, Texas' }).rimText).toBe('AUSTIN CITY LIMITS');
  });
});
