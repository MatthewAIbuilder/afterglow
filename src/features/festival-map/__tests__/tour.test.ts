import { describe, expect, it } from '@jest/globals';
import type { Festival, Show } from '../../../data/models';
import { type Marker, project } from '../map';
import { showPinLabel, showPins, stopDate, tourLine, tourStops } from '../tour';

const show = (id: string, date: string, extra: Partial<Show> = {}): Show => ({
  id,
  date,
  venue: `Venue ${id}`,
  location: 'Denver, CO',
  place: { lat: 39.74, lon: -104.99 },
  link: `https://edmtrain.com/${id}`,
  artistIds: ['a'],
  ...extra,
});

const marker = (id: string, startDate?: string): Marker => {
  const point = { lat: 30, lon: -97 };
  return {
    festival: { id, name: id, dates: '', location: '', lineup: ['a'], days: [], stages: [], startDate } as unknown as Festival,
    point,
    at: project(point),
    tone: 'more',
    loved: 0,
    going: false,
  };
};

describe('showPins', () => {
  it('keeps upcoming shows with a place, soonest first', () => {
    const pins = showPins(
      [show('late', '2026-12-01'), show('past', '2026-10-01'), show('today', '2026-10-06'), show('nowhere', '2026-11-01', { place: undefined })],
      '2026-10-06',
    );
    expect(pins.map((p) => p.show.id)).toEqual(['today', 'late']);
    expect(pins[0].point).toEqual({ lat: 39.74, lon: -104.99 });
    expect(pins[0].at).toEqual(project({ lat: 39.74, lon: -104.99 }));
  });
});

describe('tourStops', () => {
  it('puts festivals and shows in one date order, festivals first on the same day, undated festivals last', () => {
    const stops = tourStops(
      [marker('undated'), marker('fest-nov', '2026-11-07'), marker('fest-oct', '2026-10-20')],
      showPins([show('s-nov', '2026-11-07'), show('s-oct', '2026-10-10'), show('s-dec', '2026-12-31')], '2026-10-06'),
    );
    expect(stops.map((s) => s.id)).toEqual(['s-oct', 'fest-oct', 'fest-nov', 's-nov', 's-dec', 'undated']);
    expect(stops.map((s) => s.kind)).toEqual(['show', 'festival', 'festival', 'show', 'show', 'festival']);
    expect(stopDate(stops[0])).toBe('2026-10-10');
    expect(stopDate(stops[5])).toBe('9999');
  });

  it('is just the festivals when there are no shows', () => {
    expect(tourStops([marker('b', '2026-11-01'), marker('a', '2026-10-01')], []).map((s) => s.id)).toEqual(['a', 'b']);
  });
});

describe('words', () => {
  it('counts festivals and shows', () => {
    expect(tourLine(0, 0)).toBe('No festivals or shows with a place yet');
    expect(tourLine(1, 0)).toBe('1 festival');
    expect(tourLine(0, 1)).toBe('1 show');
    expect(tourLine(2, 0)).toBe('2 festivals, in date order');
    expect(tourLine(1, 3)).toBe('1 festival and 3 shows, in date order');
  });

  it('says what a show light is', () => {
    expect(showPinLabel(show('x', '2026-10-17'))).toBe('Show: Venue x, Saturday 17 October, Denver, CO.');
    expect(showPinLabel(show('y', '2026-10-17', { name: 'Halloween Night' }))).toBe('Show: Halloween Night, Saturday 17 October, Venue y, Denver, CO.');
  });
});
