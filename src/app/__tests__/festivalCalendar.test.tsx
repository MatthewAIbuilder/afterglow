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
    await fireEvent.press(app.getByLabelText('See festivals and shows on a calendar'));
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

  it('opens on what’s near you, with a state or everywhere a tap away', async () => {
    await AsyncStorage.setItem('nearYou.v1', JSON.stringify({ lat: 28.54, lon: -81.38, label: 'Orlando', at: Date.now() }));
    const app = await renderApp('/festival-calendar');
    await flush();
    // Austin is too far from Orlando.
    expect(app.getByText(/^No festivals within 100 mi in October yet$/)).toBeTruthy();
    expect(app.queryByLabelText(/^Austin City Limits 2026/)).toBeNull();
    await fireEvent.press(app.getByLabelText('Within 500 mi of Orlando'));
    await flush();
    expect(app.queryByLabelText(/^Austin City Limits 2026/)).toBeNull();
    await fireEvent.press(app.getByText('Everywhere'));
    await flush();
    expect(app.getByText('1 festival in October')).toBeTruthy();
    expect(app.getByLabelText(/^Austin City Limits 2026/)).toBeTruthy();
    await fireEvent.press(app.getByText('By state'));
    await flush();
    expect(app.getByLabelText('Texas, 1 festival')).toBeTruthy();
    expect(app.getByText('1 festival in Texas in October')).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem('calendarReach.v1'))!)).toEqual({ kind: 'state', code: 'TX' });
  });

  it('jumps to a month from the title', async () => {
    const { ActionSheetIOS } = jest.requireActual<typeof import('react-native')>('react-native');
    const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((o, pick) => pick(o.options.indexOf('December')));
    const app = await renderApp('/festival-calendar');
    await flush();
    await fireEvent.press(app.getByLabelText(/^October, /));
    await flush();
    expect(sheet).toHaveBeenCalled();
    expect(app.getByText('In December')).toBeTruthy();
    sheet.mockRestore();
  });
});
