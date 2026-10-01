import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { renderApp } from './appRoutes';

/** Before set times are out, Your festival says roughly when to expect them (Cyclops Cove 4 starts Dec 4 2026). */
const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(50);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 8; i++) await settle();
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 1, 12) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});
afterEach(() => {
  jest.useRealTimers();
});

describe('set times countdown', () => {
  it('names the window, and mentions the bell when you’re going', async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
    const app = await renderApp('/festival/cyclops-cove-4');
    await flush();
    expect(
      app.getByText('Set times usually come out a week or two before. Look out around Nov 20 to 27. You’ll get a note in the bell when they’re out.'),
    ).toBeTruthy();
  });
});
