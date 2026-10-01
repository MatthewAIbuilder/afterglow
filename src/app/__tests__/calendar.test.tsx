import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import * as Calendar from 'expo-calendar/legacy';
import { renderApp, showTab } from './appRoutes';

const flush = async () => {
  for (let i = 0; i < 6; i++)
    await act(async () => {
      await Promise.resolve();
    });
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  (Calendar.createEventInCalendarAsync as jest.Mock).mockClear();
});

describe('add to calendar', () => {
  it('appears once you’re going, and fills in the phone’s New Event screen', async () => {
    const app = await renderApp('/festival/edc-orlando-26');
    await flush();
    expect(app.queryByLabelText('Add EDC Orlando 2026 to your calendar')).toBeNull();
    await fireEvent.press(app.getByLabelText("I'm going to EDC Orlando 2026"));
    await flush();
    await showTab(app, 'Info');
    await fireEvent.press(app.getByLabelText('Add EDC Orlando 2026 to your calendar'));
    await flush();
    const given = (Calendar.createEventInCalendarAsync as jest.Mock).mock.calls[0][0] as { title: string; allDay: boolean; startDate: Date; endDate: Date; location: string };
    expect(given.title).toBe('EDC Orlando 2026');
    expect(given.allDay).toBe(true);
    expect(given.startDate.getDate()).toBe(6);
    expect(given.endDate.getDate()).toBe(8);
    expect(app.getByText('In your calendar')).toBeTruthy();
  });

  it('a festival without dates offers nothing', async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['solstice-26']));
    const app = await renderApp('/festival/solstice-26');
    await flush();
    await showTab(app, 'Info');
    expect(app.queryByText('Add to calendar')).toBeNull();
  });
});
