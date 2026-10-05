import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderApp } from './appRoutes';

/** My Sound's list: every artist ranked by match, with search, a sound filter, A to Z and the map's festival choice. */
const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i++) await settle();
};
const ROW = /^Number (\d+), (.+?), (\d+) percent match/;
const rows = (app: Awaited<ReturnType<typeof renderApp>>) =>
  app.queryAllByLabelText(ROW).map((r) => {
    const [, rank, name, pct] = (r.props.accessibilityLabel as string).match(ROW)!;
    return { rank: Number(rank), name, pct: Number(pct) };
  });

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 4, 20, 0) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('My Sound list', () => {
  it('sits between Overview and the map, ranks artists, searches, filters by sound and opens an artist', async () => {
    const app = await renderApp('/sound');
    await flush();
    const tabs = app.getAllByRole('tab').map((t) => t.props.accessibilityLabel);
    expect(tabs.slice(0, 3)).toEqual(['Overview', 'Ranked list of artists', 'Bubble map']);
    await fireEvent.press(app.getByLabelText('Ranked list of artists'));
    await flush();
    expect(app.getByLabelText('Ranked list of artists').props.accessibilityState).toEqual({ selected: true });

    // Best match first, numbered from 1.
    const ranked = rows(app);
    expect(ranked.length).toBeGreaterThan(5);
    expect(ranked.slice(0, 5).map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
    for (let i = 1; i < ranked.length; i++) expect(ranked[i].pct).toBeLessThanOrEqual(ranked[i - 1].pct);
    expect(app.getByText(/^\d+ artists$/)).toBeTruthy();

    // Searching by sound, as on the map.
    await fireEvent.changeText(app.getByLabelText('Search the list for an artist or a sound'), 'dubstep');
    await flush();
    expect(app.getByText(/^\d+ artists?$/)).toBeTruthy();
    expect(app.getAllByLabelText(/, Dubstep/).length).toBeGreaterThan(0);
    // By name, reaching artists the app knows nothing about yet.
    await fireEvent.changeText(app.getByLabelText('Search the list for an artist or a sound'), 'wooli');
    await flush();
    expect(app.getByText('1 artist')).toBeTruthy();
    expect(app.getAllByLabelText(/WOOLI, /)).toHaveLength(1);
    await fireEvent.changeText(app.getByLabelText('Search the list for an artist or a sound'), 'zzz');
    await flush();
    expect(app.getByText('No artist or sound matches “zzz”.')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Clear the search'));
    await flush();

    // Filtering to one sound: every row carries it.
    const chip = app.getAllByLabelText(/^Only [a-z -]+, \d+ artists?$/)[0];
    const [, sound, count] = (chip.props.accessibilityLabel as string).match(/^Only ([a-z -]+), (\d+) artists?$/)!;
    await fireEvent.press(chip);
    await flush();
    expect(app.getByLabelText(chip.props.accessibilityLabel as string).props.accessibilityState).toEqual({ selected: true });
    expect(app.getByText(`${count} ${sound} ${count === '1' ? 'artist' : 'artists'}`)).toBeTruthy();
    const label = sound[0].toUpperCase() + sound.slice(1);
    for (const r of app.getAllByLabelText(ROW)) expect(r.props.accessibilityLabel).toContain(label);

    // A to Z.
    await fireEvent.press(app.getByLabelText('Sorted by best match. Sort A to Z instead'));
    await flush();
    const names = rows(app).map((r) => r.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
    expect(app.getByLabelText('Sorted A to Z. Sort by best match instead')).toBeTruthy();

    // Opening an artist.
    const first = rows(app)[0];
    await fireEvent.press(app.getAllByLabelText(ROW)[0]);
    await flush();
    expect(app.getAllByText(first.name).length).toBeGreaterThan(0);
    expect(app.getByText('Similar sound')).toBeTruthy();
  });

  it('shows the rest on request, marked new', async () => {
    const app = await renderApp('/sound?view=list');
    await flush();
    expect(app.getByLabelText('Ranked list of artists').props.accessibilityState).toEqual({ selected: true });
    expect(app.queryAllByLabelText(/, new to your sound/)).toHaveLength(0);
    const more = app.getByLabelText(/^Show \d+ more artists? you haven’t reacted to yet$/);
    await fireEvent.press(more);
    await flush();
    expect(app.queryByLabelText(/^Show \d+ more/)).toBeNull();
    // Sorting A to Z mixes them in, so some show near the top.
    await fireEvent.press(app.getByLabelText('Sorted by best match. Sort A to Z instead'));
    await flush();
    expect(app.getAllByText('New').length).toBeGreaterThan(0);
  });

  it('keeps the festival chosen on the map, and opens artists in that festival', async () => {
    const app = await renderApp('/sound?festival=edc-orlando-26');
    await flush();
    expect(app.getByLabelText('Bubble map').props.accessibilityState).toEqual({ selected: true });
    await fireEvent.press(app.getByLabelText('Ranked list of artists'));
    await flush();
    expect(app.getByLabelText('Your sound at EDC Orlando 2026. Choose a festival')).toBeTruthy();
    // Nobody at EDC Orlando is known yet: everyone is a tap away.
    const more = app.getByLabelText(/^Show \d+ more artists you haven’t reacted to yet$/);
    await fireEvent.press(more);
    await flush();
    expect(app.getByText(/^\d+ artists at EDC Orlando 2026$/)).toBeTruthy();
    // Back on the map, still EDC Orlando.
    await fireEvent.press(app.getByLabelText('Bubble map'));
    await flush();
    expect(app.getByLabelText('Your sound at EDC Orlando 2026. Choose a festival')).toBeTruthy();
  });
});
