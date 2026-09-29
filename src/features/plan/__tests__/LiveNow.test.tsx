import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import type { Festival } from '../../../data/models';
import { LiveNow } from '../LiveNow';
import { buildSchedule, type Pick } from '../plan';
import { festivalRoute } from '../route';

const festival: Festival = {
  id: 'f',
  name: 'Fest',
  dates: 'Nov 6 to 7',
  location: 'Somewhere',
  lineup: ['a', 'b'],
  days: ['Friday', 'Saturday'],
  stages: [{ id: 'main', name: 'Main Stage' }],
  sets: [
    { artistId: 'a', day: 'Friday', stageId: 'main', start: '22:00', end: '23:30' },
    { artistId: 'b', day: 'Friday', stageId: 'main', start: '00:15', end: '01:30' },
  ],
  startDate: '2026-11-06',
  endDate: '2026-11-07',
};
const pick = (id: string): Pick => ({
  artist: { id, name: id.toUpperCase(), sound: {} },
  match: 0.8,
  tier: 'strong',
  pinned: false,
  known: true,
  set: festival.sets!.find((s) => s.artistId === id),
});
const schedule = buildSchedule(festival, [pick('a'), pick('b')]);

afterEach(() => {
  jest.useRealTimers();
});

describe('live now card', () => {
  it('shows who is on and who is next', async () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 6, 22, 30) });
    const app = await render(<LiveNow festival={festival} schedule={schedule} />);
    expect(app.getByText('Now · Friday')).toBeTruthy();
    expect(app.getByText('A')).toBeTruthy();
    expect(app.getByText('Main Stage, until 11:30 PM')).toBeTruthy();
    expect(app.getByText('12:15 AM  B, Main Stage')).toBeTruthy();
  });

  it('says when the night is done', async () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 7, 2, 0) });
    const app = await render(<LiveNow festival={festival} schedule={schedule} />);
    expect(app.getByText('Nothing on your plan right now.')).toBeTruthy();
    expect(app.getByText('That’s everything on your plan tonight.')).toBeTruthy();
  });

  it('shows nothing outside the festival', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 1, 22, 0) });
    const app = await render(<LiveNow festival={festival} schedule={schedule} />);
    expect(app.toJSON()).toBeNull();
  });

  it('follows the full-day route when there is one, saying when to leave', async () => {
    // 'b' starts at 00:15, while 'a' is still on: the route leaves 'a' for 'b' only if 'b' is better.
    const taste = { a: 0.6, b: 0.95 };
    const route = festivalRoute({ festival, artists: [pick('a').artist, pick('b').artist], taste, informed: { a: true, b: true } });
    jest.useFakeTimers({ now: new Date(2026, 10, 6, 22, 30) });
    const app = await render(<LiveNow festival={festival} schedule={schedule} route={route} />);
    expect(app.getByText('A')).toBeTruthy();
    expect(app.getByText(/^Main Stage, (until|leave at) /)).toBeTruthy();
    expect(app.getByText(/B, Main Stage/)).toBeTruthy();
  });
});
