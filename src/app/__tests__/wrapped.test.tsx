import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { renderApp } from './appRoutes';

/** Afterglow Wrapped: your year as a story, from what's on the phone. */
const flush = async (n = 10) => {
  for (let i = 0; i < n; i++)
    await act(async () => {
      jest.advanceTimersByTime(50);
      await Promise.resolve();
    });
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});
afterEach(() => {
  jest.useRealTimers();
});

describe('Afterglow Wrapped', () => {
  it('tells your year card by card: the sets you saw, who you saw most, your set of the year', async () => {
    jest.useFakeTimers({ now: new Date(2026, 11, 10, 12) });
    const at = (d: number) => new Date(2026, 10, d, 23).getTime();
    await AsyncStorage.setItem('going.v1', JSON.stringify(['edc-orlando-26']));
    await AsyncStorage.setItem(
      'setsSeen.v1',
      JSON.stringify({
        sets: {
          'edc-orlando-26:subtronics:Friday': { festivalId: 'edc-orlando-26', artistId: 'subtronics', day: 'Friday', at: at(6), verdict: 'unreal' },
          'edc-orlando-26:subtronics:Sunday': { festivalId: 'edc-orlando-26', artistId: 'subtronics', day: 'Sunday', at: at(8), verdict: 'great' },
        },
        waved: [],
      }),
    );
    const app = await renderApp('/wrapped/2026');
    await flush();
    expect(app.getByLabelText(/^Afterglow Wrapped\. Your 2026\. 1 festival · 2 sets seen live/)).toBeTruthy();
    expect(app.getByLabelText(/^Live\. 2 sets\. You saw SUBTRONICS 2 times$/)).toBeTruthy();
    expect(app.getByLabelText(/^Your set of the year\. SUBTRONICS\. EDC Orlando 2026 · Unreal$/)).toBeTruthy();
    expect(app.getByText('Share my year')).toBeTruthy();
    await app.unmount();
  });
});
