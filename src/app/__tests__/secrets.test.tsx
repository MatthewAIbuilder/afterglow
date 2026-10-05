import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { VERSION_LINE } from '../../lib/version';
import { renderApp } from './appRoutes';

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i++) await settle();
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 3, 20, 0) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('secrets', () => {
  it('searching “plur” rains hearts, and the first time it’s found', async () => {
    const app = await renderApp('/search');
    await flush();
    await fireEvent.changeText(app.getByLabelText(/^Search/), 'plur');
    await flush(20);
    expect(app.getByTestId('secret-hearts')).toBeTruthy();
    expect(app.getByTestId('secret-toast').props.accessibilityLabel).toBe('Secret found: PLUR. Plus 50 glow. Opens your secrets.');
    expect(JSON.parse((await AsyncStorage.getItem('secrets.v1'))!)).toHaveProperty('plur');
  });

  it('the small print hides one, and Secrets lists what you found', async () => {
    const app = await renderApp('/settings');
    await flush();
    expect(app.getByText('0 of 11 secrets found')).toBeTruthy();
    // The last "Afterglow" on the page (the App theme row says it too).
    const version = app.getAllByText(VERSION_LINE).at(-1)!;
    for (let i = 0; i < 7; i++) {
      await fireEvent.press(version);
      await settle(100);
    }
    await flush();
    expect(app.getByTestId('secret-fireworks')).toBeTruthy();
    await fireEvent.press(app.getByText('Secrets'));
    await flush();
    expect(app.getByText('1 of 11 secrets found')).toBeTruthy();
    expect(app.getByTestId('secret-card-smallprint').props.accessibilityLabel).toMatch(/^Small print\. Tap the version line/);
    expect(app.getByTestId('secret-card-plur').props.accessibilityLabel).toBe('A secret not found yet. Hint: Four letters every raver knows. Look for them.');
  });

  it('shaking the phone on Discover starts a light show', async () => {
    const app = await renderApp('/');
    await flush();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sensors = require('expo-sensors');
    await act(async () => {
      for (const [x, at] of [
        [3.2, 0],
        [0, 50],
        [3.4, 300],
        [0, 50],
        [3.3, 300],
      ]) {
        jest.advanceTimersByTime(at);
        sensors.__accel({ x, y: 0, z: 1 });
      }
    });
    await flush();
    expect(app.getByTestId('secret-lightshow')).toBeTruthy();
  });
});
