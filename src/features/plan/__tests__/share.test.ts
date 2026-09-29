import { describe, expect, it } from '@jest/globals';
import { MOCK_CATALOG, MOCK_TASTE } from '../../../data/mock';
import { computeTaste } from '../../taste/engine';
import { buildSchedule, rankLineup } from '../plan';
import { planText } from '../share';

const { artists, clips, festival } = MOCK_CATALOG;
const { taste, informed } = computeTaste(MOCK_TASTE, artists, clips, {});
const planFor = (id: string, pinned: string[] = []) => {
  const f = festival(id)!;
  const picks = rankLineup({ festival: f, artists, taste, informed, pinned: new Set(pinned) });
  const schedule = f.sets?.length ? buildSchedule(f, picks) : null;
  return planText(f, picks, schedule, 'Afterglow');
};

describe('sharing your plan', () => {
  it('lists must-sees and strong matches before set times, starring your picks', () => {
    const text = planFor('horizon-27', ['john-summit'])!;
    expect(text.startsWith('My Horizon 2027\nMar 12 to 14, Desert Valley')).toBe(true);
    expect(text).toMatch(/Must see\n(.+\n)*★ JOHN SUMMIT/);
    expect(text).toMatch(/Must see\n(.+\n)*SUBTRONICS/);
    expect(text).toContain('Strong match');
    expect(text.endsWith('Made with Afterglow')).toBe(true);
    // Explore picks are suggestions, not plans.
    expect(text).not.toContain('Explore');
  });

  it('lays out your night once set times are out, with clashes called out', () => {
    const text = planFor('solstice-26')!;
    expect(text).toContain('Friday\n');
    expect(text).toContain('11:40 PM  ILLENIUM, Main Stage');
    // Friday's ILLENIUM / SUBTRONICS clash is a close call: both, with an "or".
    expect(text).toMatch(/ILLENIUM, Main Stage\n {3}or 12:15 AM {2}SUBTRONICS, Bass Tent/);
    expect(text).toContain('Saturday\n');
    expect(text).toMatch(/\(clashes with (LEVITY|EXCISION)\)/);
  });

  it('has nothing to send when nothing on the lineup is for you yet', () => {
    const f = festival('horizon-27')!;
    expect(planText(f, [], null, 'Afterglow')).toBeUndefined();
  });
});
