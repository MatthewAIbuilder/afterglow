import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderApp } from './appRoutes';

/** This or that on the built-in catalogue's live sets. */
const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i++) await settle();
};

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('this or that', () => {
  it('plays round by round: a pick is a like, neither likes nothing, and the end shows your sound', async () => {
    const app = await renderApp('/this-or-that');
    await flush();
    expect(app.getByText(/^Round 1 of \d+ · Tap the set you’d rather hear$/)).toBeTruthy();
    const total = Number(/of (\d+)/.exec(app.getByText(/^Round 1 of/).props.children)![1]);
    expect(total).toBeGreaterThanOrEqual(3);

    // One set plays at a time; the other offers to be heard.
    expect(app.getAllByLabelText(/^Hear /)).toHaveLength(1);
    await fireEvent.press(app.getByTestId('pick-a'));
    await flush();
    expect(app.getByText(/^Round 2 of/)).toBeTruthy();
    const stored = JSON.parse((await AsyncStorage.getItem('reactions.v1')) ?? '{}');
    expect(Object.values(stored).filter((r) => (r as { liked?: boolean }).liked)).toHaveLength(1);

    for (let i = 1; i < total; i++) {
      await fireEvent.press(app.getByLabelText('Neither, next pair'));
      await flush();
    }
    expect(app.getByText('Your sound is taking shape')).toBeTruthy();
    expect(app.getByText(/^You picked 1 set\./)).toBeTruthy();
    expect(app.getByText('See My Sound')).toBeTruthy();
  });

  it('the welcome offers it as the quickest start', async () => {
    await AsyncStorage.removeItem('welcomed.v1');
    const app = await renderApp('/');
    await flush(20);
    await fireEvent.press(app.getByText('Get started'));
    await flush();
    await fireEvent.press(app.getByText(/Continue|Not sure yet/));
    await flush();
    await fireEvent.press(app.getByText('Continue'));
    await flush();
    await fireEvent.press(app.getByText('Play this or that'));
    await flush();
    expect(app.getByText(/^Round 1 of/)).toBeTruthy();
  });
});
