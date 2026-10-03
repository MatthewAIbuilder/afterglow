import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderApp } from './appRoutes';

/** Festival week through the real routes: three days before Cyclops Cove 4. */
const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 10; i++) await settle();
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 11, 1, 12) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});
afterEach(() => {
  jest.useRealTimers();
});

describe('festival week', () => {
  it('opens a door a day: today’s are ready, tomorrow’s waits, and an opened door stays open', async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
    const app = await renderApp('/festival-week/cyclops-cove-4');
    await flush();
    expect(app.getByText('3 days to go · one door a day')).toBeTruthy();
    expect(app.getByLabelText('Door 7, ready. Tap to open it')).toBeTruthy();
    expect(app.getByLabelText('Door 2, opens tomorrow')).toBeTruthy();
    expect(app.getByLabelText('Door 1, opens in 2 days')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Door 4, ready. Tap to open it'));
    await flush();
    expect(app.getByText('☺  Bring the crew')).toBeTruthy();
    expect(app.getByLabelText('Start a crew')).toBeTruthy();
    expect(app.getByLabelText('Door 4, open: Bring the crew')).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem('festivalWeek.v1')) ?? '{}')).toEqual({ 'cyclops-cove-4': [4] });
    // A locked door stays shut.
    await fireEvent.press(app.getByLabelText('Door 2, opens tomorrow'));
    await flush();
    expect(app.queryByText(/Time to pack/)).toBeNull();
  });

  it('the Festivals tab and the festival page point at it during the week, only when you’re going', async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
    await AsyncStorage.setItem('festivalWeek.v1', JSON.stringify({ 'cyclops-cove-4': [7, 6, 5, 4] }));
    const app = await renderApp('/festivals');
    await flush();
    expect(app.getByLabelText('Festival week for Cyclops Cove 4. Door 3 is ready to open. Opens the calendar.')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Festival week for Cyclops Cove 4. Door 3 is ready to open. Opens the calendar.'));
    await flush();
    expect(app.getByLabelText('Door 3, ready. Tap to open it')).toBeTruthy();
  });

  it('nothing shows for a festival you’re not going to', async () => {
    const app = await renderApp('/festival/cyclops-cove-4');
    await flush();
    expect(app.queryByLabelText(/^Festival week/)).toBeNull();
  });
});
