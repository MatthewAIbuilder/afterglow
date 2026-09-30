import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { Festival } from '../../../data/models';
import { MOCK_CATALOG } from '../../../data/mock';
import { SetRemindersProvider } from '../../../state/setReminders';
import { SetReminderToggle } from '../SetReminderToggle';

const dated: Festival = { ...MOCK_CATALOG.festival('solstice-26')!, startDate: '2026-12-04', endDate: '2026-12-06' };
const wrap = (f: Festival) => (
  <SetRemindersProvider>
    <SetReminderToggle festival={f} />
  </SetRemindersProvider>
);
const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(50);
    await Promise.resolve();
  });

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('Remind me before each set', () => {
  it('only for a festival with set times and dates that match its days', async () => {
    const none = await render(wrap(MOCK_CATALOG.festival('solstice-26')!));
    expect(none.queryByText('Remind me before each set')).toBeNull();
    await none.unmount();
    const app = await render(wrap(dated));
    expect(app.getByText('Remind me before each set')).toBeTruthy();
  });

  it('switching it on is remembered, and says how it works', async () => {
    const app = await render(wrap(dated));
    await settle();
    await fireEvent(app.getByTestId('set-reminders'), 'valueChange', true);
    await settle();
    expect(app.getByText(/10 min before you need to head over/)).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem('setReminders.v1')) ?? '[]')).toEqual(['solstice-26']);
    await fireEvent(app.getByTestId('set-reminders'), 'valueChange', false);
    await settle();
    expect(JSON.parse((await AsyncStorage.getItem('setReminders.v1')) ?? '[]')).toEqual([]);
  });
});
