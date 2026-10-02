import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderApp } from './appRoutes';

/** Festival-day mode on Saturday night of Cyclops Cove 4 (Dec 4 to 6 2026). */
const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i++) await settle();
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 11, 5, 22, 0) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('Tonight', () => {
  it('opens by itself once on a festival night, with your picks, and stays a tap away on Discover', async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ subtronics: 'love' }));
    const app = await renderApp('/');
    await flush();
    expect(app.getByText('Saturday at Cyclops Cove 4')).toBeTruthy();
    expect(app.getByText('Your picks for Saturday')).toBeTruthy();
    expect(app.getByLabelText(/^SUBTRONICS, \d+ percent match/)).toBeTruthy();
    expect(app.getByText('Your plan, lineup and route work without signal.')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Close'));
    await flush();
    await fireEvent.press(app.getByLabelText(/^Tonight: Saturday at Cyclops Cove 4\./));
    await flush();
    expect(app.getByText('Saturday at Cyclops Cove 4')).toBeTruthy();
    expect(await AsyncStorage.getItem('tonightShown.v1')).toBe('cyclops-cove-4:2026-12-05');
  });

  it('does not open again the same night', async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
    await AsyncStorage.setItem('tonightShown.v1', 'cyclops-cove-4:2026-12-05');
    const app = await renderApp('/');
    await flush();
    expect(app.queryByText('Your plan, lineup and route work without signal.')).toBeNull();
    expect(app.getByLabelText(/^Tonight: Saturday at Cyclops Cove 4\./)).toBeTruthy();
  });

  it('stays out of the way when you are not going', async () => {
    const app = await renderApp('/');
    await flush();
    expect(app.queryByLabelText(/^Tonight:/)).toBeNull();
  });
});
