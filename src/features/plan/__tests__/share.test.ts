import { describe, expect, it } from '@jest/globals';
import { MOCK_CATALOG, MOCK_TASTE } from '../../../data/mock';
import { computeTaste } from '../../taste/engine';
import { buildSchedule, rankLineup } from '../plan';
import { festivalRoute } from '../route';
import { CARD_LINES, planCard, planText, routeText } from '../share';

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

  it('shares the whole route set to set once set times are out', () => {
    const f = festival('solstice-26')!;
    const route = festivalRoute({ festival: f, artists, taste, informed, pinned: new Set(['illenium']) });
    const text = routeText(f, route, 'Afterglow')!;
    expect(text.startsWith('My Solstice 2026, set to set\n')).toBe(true);
    expect(text).toContain('Friday\n10:00 PM  TAPE B, Bass Tent (whole set)');
    expect(text).toContain('11:40 PM  ★ ILLENIUM, Main Stage (whole set)');
    expect(text).not.toMatch(/break/i);
    expect(text.endsWith('Made with Afterglow')).toBe(true);
    expect(routeText(f, [], 'Afterglow')).toBeUndefined();
  });

  it('lists your picks day by day before set times, when the poster gives days', () => {
    const f = { ...festival('horizon-27')!, days: ['Friday', 'Saturday'] };
    const picks = rankLineup({ festival: f, artists, taste, informed, pinned: new Set(['john-summit']) });
    const withDays = { ...f, artistDays: Object.fromEntries(f.lineup.map((id, i) => [id, [i % 2 ? 'Saturday' : 'Friday']])) };
    const text = planText(withDays, picks, null, 'Afterglow')!;
    expect(text).toMatch(/\n\nFriday\n/);
    expect(text).toContain('★ JOHN SUMMIT');
    expect(text).not.toContain('Must see');
  });

  it('makes a picture of the route, day by day, once set times are out', () => {
    const f = festival('solstice-26')!;
    const picks = rankLineup({ festival: f, artists, taste, informed, pinned: new Set(['illenium']) });
    const route = festivalRoute({ festival: f, artists, taste, informed, pinned: new Set(['illenium']) });
    const card = planCard(f, picks, route)!;
    expect(card.title).toBe('Solstice 2026');
    expect(card.sections[0].heading).toBe('Friday');
    expect(card.sections[0].lines[0]).toEqual({ time: '10:00 PM', name: 'TAPE B', where: 'Bass Tent', star: false });
    expect(card.sections[0].lines.some((l) => l.name === 'ILLENIUM' && l.star)).toBe(true);
  });

  it('makes a picture of your picks by tier before set times, capped per section', () => {
    const f = festival('horizon-27')!;
    const picks = rankLineup({ festival: f, artists, taste, informed });
    const card = planCard(f, picks, undefined)!;
    expect(card.sections.map((s) => s.heading)).toEqual(['Must see', 'Strong match']);
    for (const s of card.sections) expect(s.lines.length).toBeLessThanOrEqual(CARD_LINES);
    expect(planCard(f, [], undefined)).toBeUndefined();
  });
});
