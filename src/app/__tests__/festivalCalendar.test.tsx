import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderApp } from './appRoutes';

const flush = async (rounds = 8) => {
  for (let i = 0; i < rounds; i++)
    await act(async () => {
      jest.advanceTimersByTime(50);
      await Promise.resolve();
    });
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 3, 12) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('the festival calendar', () => {
  it('opens from Festivals, flips months and shows what’s on a day', async () => {
    const app = await renderApp('/festivals');
    await flush();
    await fireEvent.press(app.getByLabelText('See festivals on a calendar'));
    await flush();
    expect(app.getAllByText('October').length).toBeGreaterThan(0);
    await fireEvent.press(app.getByTestId('cal-2026-10-10'));
    await flush();
    expect(app.getByText('On 10 October')).toBeTruthy();
    expect(app.getByLabelText(/^Austin City Limits 2026/)).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Next month'));
    await flush();
    expect(app.getByText('In November')).toBeTruthy();
    expect(app.getByLabelText(/^6 November, EDC Orlando 2026/)).toBeTruthy();
  });
});
