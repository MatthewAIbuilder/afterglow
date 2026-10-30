import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { renderApp } from './appRoutes';

/** Crew meetups through the real crew page: set one, everyone sees it, and the reminders are scheduled. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i++) await settle();
};
const s = () => mockSocial.service;
async function person(handle: string, name: string) {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: name, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
}
const scheduled = (Notifications as unknown as { __scheduled: Map<string, unknown> }).__scheduled;

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetGoers();
  scheduled.clear();
});

describe('crew meetups', () => {
  it('sets a meetup for the crew, with a reminder before it', async () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 6, 20, 5) });
    await person('maya', 'Maya');
    const crew = await s().createCrew('solstice-26', 'Bass crew');
    await s().setMeetSpot(crew.id, 'The big tree');
    await s().signOut();
    await person('sam', 'Sam');
    await s().joinCrew(crew.id, mockSocial.codeOf(crew.id));
    const app = await renderApp(`/crew/${crew.id}`);
    await flush();
    expect(app.getByText('Meetups')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Set a meetup for the crew'));
    await flush(2);
    // Starts at the meeting spot, half an hour on, on the quarter hour; an hour later.
    expect(app.getByDisplayValue('The big tree')).toBeTruthy();
    expect(app.getByLabelText('Meet at Today 8:45 PM')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('An hour later'));
    await fireEvent.press(app.getByLabelText('Set the meetup'));
    await flush();
    expect(mockSocial.meetups.get(crew.id)).toEqual([expect.objectContaining({ place: 'The big tree', by: mockSocial.currentUser()?.uid })]);
    expect(new Date(mockSocial.meetups.get(crew.id)![0].at).getHours()).toBe(21);
    expect(app.getByLabelText('Meetup: The big tree at 9:45 PM. You set it')).toBeTruthy();
    expect([...scheduled.keys()].filter((k) => k.startsWith('afterglow-meetup:'))).toHaveLength(2);
    await app.unmount();
  });
});
