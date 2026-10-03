import { describe, expect, it } from '@jest/globals';
import { MOCK_CATALOG } from '../../../data/mock';
import { crewRoute, crewRouteCard, crewTaste, namesLine, STAR_PULL } from '../crewRoute';
import { crewRouteText } from '../CrewRouteSection';

const solstice = MOCK_CATALOG.festival('solstice-26')!;
const artists = MOCK_CATALOG.artists;
const names: Record<string, string> = { me: 'You', maya: 'Maya', sam: 'Sam' };
const nameOf = (uid: string) => names[uid];
const base = {
  festival: solstice,
  artists,
  taste: { illenium: 0.95, subtronics: 0.6, 'tape-b': 0.7, 'sara-landry': 0.2 },
  informed: { illenium: true, subtronics: true, 'tape-b': true, 'sara-landry': true },
  me: 'me',
  members: ['me', 'maya', 'sam'],
};

describe('the crew route', () => {
  it("pulls your taste towards the crew's stars, and half the crew makes a must-see", () => {
    const t = crewTaste({ ...base, stars: { me: ['illenium'], maya: ['subtronics', 'excision'], sam: ['subtronics'], gone: ['tape-b'] } });
    expect(t.taste.subtronics).toBeCloseTo(0.6 + 2 * STAR_PULL);
    expect(t.taste.illenium).toBe(0.95); // your own star adds nothing to your own taste
    expect(t.informed.excision).toBe(true);
    expect([...t.pinned]).toEqual(['subtronics']);
    expect(t.taste['tape-b']).toBe(0.7); // someone who left doesn't count
  });

  it('follows the must-see and offers a split for the star it skips', () => {
    const days = crewRoute({ ...base, stars: { me: ['illenium'], maya: ['subtronics'], sam: ['subtronics'] } });
    const friday = days.find((d) => d.day === 'Friday')!;
    const sets = friday.stops.filter((s) => s.kind === 'set').map((s) => (s.kind === 'set' ? s.artist.id : ''));
    expect(sets).toContain('subtronics');
    expect(friday.starredBy.subtronics).toEqual(['maya', 'sam']);
    const split = friday.splits.find((s) => s.artist.id === 'illenium')!;
    expect(split.who).toEqual(['me']);
    expect(split.backAt).toBe('01:10');
    expect(namesLine(split.who, 'me', nameOf)).toBe('You');
    const text = crewRouteText(solstice, 'Bass crew', days.filter((d) => d.stops.length), 'me', nameOf);
    expect(text.split('\n')[0]).toBe('Bass crew at Solstice 2026, set to set');
    expect(text).toContain('★ SUBTRONICS, Bass Tent');
    expect(text).toContain('Split: You to ILLENIUM at 11:40 PM');
    // The same route as a picture: the crew, the festival, then each day set to set.
    const card = crewRouteCard(solstice, 'Bass crew', days.filter((d) => d.stops.length), 'me', nameOf)!;
    expect(card.title).toBe('Bass crew');
    expect(card.subtitle).toMatch(/^Our route at Solstice 2026/);
    const fri = card.sections.find((x) => x.heading === 'Friday')!;
    expect(fri.lines).toContainEqual(expect.objectContaining({ name: 'SUBTRONICS', where: 'Bass Tent', star: true }));
    expect(fri.lines).toContainEqual({ time: '11:40 PM', name: 'ILLENIUM', where: 'You split off', star: false });
    expect(crewRouteCard(solstice, 'Bass crew', [], 'me', nameOf)).toBeUndefined();
  });

  it('names people plainly', () => {
    expect(namesLine(['maya', 'sam'], 'me', nameOf)).toBe('Maya and Sam');
    expect(namesLine(['me', 'maya'], 'me', nameOf)).toBe('You and Maya');
    expect(namesLine(['me', 'maya', 'sam'], 'me', nameOf)).toBe('You, Maya and Sam');
    expect(namesLine(['me', 'maya', 'sam', 'x'], 'me', (u) => names[u] ?? 'Jo')).toBe('You, Maya and 2 more');
  });
});
