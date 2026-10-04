import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderApp } from './appRoutes';

const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(50);
    await Promise.resolve();
  });

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 3, 20, 0) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

/** Opened straight from a link (nothing to go back to), Back and Close land on Discover instead of doing nothing. */
describe('back and close buttons', () => {
  it.each([
    ['/settings', 'Back'],
    ['/people', 'Back'],
    ['/notifications', 'Back'],
    ['/memories', 'Back'],
    ['/give-sprout', 'Close'],
    ['/discover-focus', 'Close'],
    ['/request', 'Close'],
    ['/your-sound', 'Close'],
    ['/sound-scope', 'Close'],
  ])('%s', async (url, label) => {
    const app = await renderApp(url);
    for (let i = 0; i < 10; i++) await settle();
    await fireEvent.press(app.getAllByLabelText(label)[0]);
    for (let i = 0; i < 10; i++) await settle();
    expect(app.getByLabelText(/Choose what to discover\.$/)).toBeTruthy();
  });
});
