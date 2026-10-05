import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { type Marker, project } from '../map';
import { SPREAD_DELTA, filterWhen, inView, inViewLine, sameSpot, searchMarkers, spreadMarkers } from '../explore';

const today = new Date(2026, 9, 5);
function marker(id: string, lat: number, lon: number, extra: Partial<Festival> = {}): Marker {
  const festival = { id, name: id.toUpperCase(), dates: '', location: 'Orlando', lineup: [], days: [], stages: [], ...extra } as unknown as Festival;
  return { festival, point: { lat, lon }, at: project({ lat, lon }), tone: 'more', loved: 0, going: false };
}
const a = marker('a', 28.537, -81.404, { startDate: '2026-11-07' });
const b = marker('b', 28.537, -81.403, { startDate: '2026-12-31' });
const c = marker('c', 30.267, -97.771, { location: 'Austin, Texas', startDate: '2026-10-09' });

describe('getting around the festival map', () => {
  it('festivals on the same spot fan out in a ring once zoomed in, the same way each time', () => {
    expect(sameSpot([a, b])).toBe(true);
    expect(sameSpot([a, c])).toBe(false);
    expect(spreadMarkers([a, b, c], { longitudeDelta: SPREAD_DELTA * 2 }, 300)).toEqual([a, b, c]);
    const [sa, sb, sc] = spreadMarkers([a, b, c], { longitudeDelta: 0.5 }, 300);
    expect(sc).toBe(c);
    // Earliest at the top, the next opposite; 42 px apart from the middle at this scale.
    expect(sa.at.y).toBeLessThan(sb.at.y);
    expect(Math.hypot(sa.at.x - sb.at.x, sa.at.y - sb.at.y) * 300).toBeCloseTo(84, 0);
    expect(sa.point).toEqual(a.point);
    expect(spreadMarkers([b, a], { longitudeDelta: 0.5 }, 300).map((m) => m.at)).toEqual([sb.at, sa.at]);
  });

  it('when: on soon, or any time', () => {
    expect(filterWhen([a, b, c], 'month', today).map((m) => m.festival.id)).toEqual(['c']);
    expect(filterWhen([a, b, c], 'season', today).map((m) => m.festival.id)).toEqual(['a', 'b', 'c']);
    expect(filterWhen([a, marker('undated', 0, 0)], 'season', today).map((m) => m.festival.id)).toEqual(['a']);
    expect(filterWhen([a, marker('undated', 0, 0)], 'any', today)).toHaveLength(2);
  });

  it('search by name or place', () => {
    expect(searchMarkers([a, b, c], 'austin').map((m) => m.festival.id)).toEqual(['c']);
    expect(searchMarkers([a, b, c], '  ')).toHaveLength(3);
  });

  it('what is in view, soonest first', () => {
    const orlando = { latitude: 28.5, longitude: -81.4, latitudeDelta: 1, longitudeDelta: 1 };
    expect(inView([b, c, a], orlando, today).map((m) => m.festival.id)).toEqual(['a', 'b']);
    expect(inView([a], { latitude: 0, longitude: 179.5, latitudeDelta: 10, longitudeDelta: 4 }, today)).toEqual([]);
    expect(inView([marker('fiji', 0, -179.5)], { latitude: 0, longitude: 179.5, latitudeDelta: 10, longitudeDelta: 4 }, today)).toHaveLength(1);
    expect([0, 1, 5].map(inViewLine)).toEqual(['No festivals here', '1 festival here', '5 festivals here']);
  });
});
