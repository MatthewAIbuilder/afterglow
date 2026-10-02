import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Alert, type AlertButton } from 'react-native';
import { renderApp } from './appRoutes';

const settle = () =>
  act(async () => {
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 8; i++) await settle();
};

beforeEach(async () => {
  // Saturday night at Cyclops Cove 4 (Dec 4 to 6 2026).
  jest.useFakeTimers({ now: new Date(2026, 11, 5, 23, 30) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const saved = async () => JSON.parse((await AsyncStorage.getItem('care.v1')) ?? '{}');

describe('look after yourself', () => {
  it('shows on the festival page while it is on, and keeps timers, water and check-ins on the phone', async () => {
    const app = await renderApp('/festival/cyclops-cove-4');
    await flush();
    await fireEvent.press(app.getByLabelText(/^Look after yourself\. Stopwatches, water and check-ins, private to you\./));
    await flush();
    expect(app.getByText('Private to you: kept only on this phone, never shared.')).toBeTruthy();

    await fireEvent.press(app.getByLabelText('Start a stopwatch'));
    await fireEvent.changeText(app.getByLabelText('Name it your own way'), 'since doors');
    await fireEvent.press(app.getByLabelText('Start a stopwatch with your own name'));
    await flush();
    expect(app.getByText('since doors')).toBeTruthy();
    expect(app.getByText('0:00')).toBeTruthy();

    await fireEvent.press(app.getByLabelText(/^Water: add one\. 0 tonight/));
    await flush();
    expect(app.getByLabelText(/^Water: add one\. 1 tonight\. Just now\./)).toBeTruthy();
    // An accidental tap comes back off with a long press.
    await fireEvent(app.getByLabelText(/^Water: add one\. 1 tonight/), 'longPress');
    await flush();
    expect(app.getByLabelText(/^Water: add one\. 0 tonight/)).toBeTruthy();

    const stored = await saved();
    expect(stored.timers[0].label).toBe('since doors');
    expect(stored.log).toEqual([]);
  });

  it('puts help first when you are not great', async () => {
    const app = await renderApp('/care');
    await flush();
    expect(app.getAllByText('Get help').length).toBeGreaterThan(0);
    await fireEvent.press(app.getByLabelText("I'm feeling not great"));
    await flush();
    expect(app.getByText('You said you’re not great. Help is close.')).toBeTruthy();
    expect(app.getByRole('button', { name: /^Call (911|112|999|000|111)$/ })).toBeTruthy();
    expect(app.getByRole('button', { name: 'Ask a friend to find me' })).toBeTruthy();
  });

  it('can be locked with Face ID, and cleared', async () => {
    const app = await renderApp('/settings');
    await flush();
    await fireEvent.press(app.getByLabelText(/^Look after yourself: stopwatches/));
    await flush();
    await fireEvent(app.getByLabelText('Lock with Face ID'), 'valueChange', true);
    await flush();
    expect((await saved()).lock).toBe(true);

    // Opening it again asks first; a refusal keeps it locked.
    (LocalAuthentication as unknown as { __state: { result: { success: boolean } } }).__state.result = { success: false };
    const again = await renderApp('/care');
    await flush();
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled();
    expect(again.getByText('Locked')).toBeTruthy();
    (LocalAuthentication as unknown as { __state: { result: { success: boolean } } }).__state.result = { success: true };
    await fireEvent.press(again.getByRole('button', { name: 'Unlock' }));
    await flush();
    expect(again.getByText('Look after yourself')).toBeTruthy();

    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons?: AlertButton[]) => buttons?.find((b) => b.text === 'Clear')?.onPress?.());
    await fireEvent.press(again.getByRole('button', { name: 'Clear everything' }));
    await flush();
    expect(await AsyncStorage.getItem('care.v1')).toBeNull();
  });

  it('stays off the festival page when the festival is not on', async () => {
    jest.setSystemTime(new Date(2026, 9, 1, 12));
    const app = await renderApp('/festival/cyclops-cove-4');
    await flush();
    expect(app.queryByLabelText(/^Look after yourself\./)).toBeNull();
  });
});

describe('water reminders', () => {
  it('schedules gentle reminders on the phone while a festival you are going to is on', async () => {
    const notifications = jest.requireMock<{ __scheduled: Map<string, unknown> }>('expo-notifications');
    notifications.__scheduled.clear();
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
    await AsyncStorage.setItem('tonightShown.v1', 'cyclops-cove-4:2026-12-05');
    const app = await renderApp('/care');
    await flush();
    await fireEvent.press(app.getByLabelText('Water reminders every hour'));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await flush();
    expect((await saved()).waterEvery).toBe(60);
    const ids = [...notifications.__scheduled.keys()].filter((id) => id.includes('care:water:cyclops-cove-4'));
    expect(ids.length).toBeGreaterThan(3);
    await fireEvent.press(app.getByLabelText('No water reminders'));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await flush();
    expect([...notifications.__scheduled.keys()].filter((id) => id.includes('care:water'))).toEqual([]);
  });
});
