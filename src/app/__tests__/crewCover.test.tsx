import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { renderApp } from './appRoutes';

/** The crew photo through the crew page, with the in-memory backend. */
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

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 10, 7, 20) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetGoers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('crew photo', () => {
  it('a crew without one offers to add it; with one it shows the photo and lets any member change it', async () => {
    await person('maya', 'Maya');
    const crew = await s().createCrew('solstice-26', 'Bass crew');
    const app = await renderApp(`/crew/${crew.id}`);
    await flush();
    expect(app.getByLabelText('Add a crew photo')).toBeTruthy();
    await app.unmount();

    await s().setCrewCover(crew.id, 'file:///crew.jpg');
    await s().signOut();
    await person('sam', 'Sam');
    await s().joinCrew(crew.id, mockSocial.codeOf(crew.id));
    const again = await renderApp(`/crew/${crew.id}`);
    await flush();
    expect(again.getByLabelText('Change the crew photo')).toBeTruthy();
    const alert = jest.spyOn(Alert, 'alert');
    await fireEvent.press(again.getByLabelText('Change the crew photo'));
    await flush();
    const buttons = (alert.mock.calls[0][2] ?? []).map((b) => b.text);
    // Sam didn't put it there and doesn't run the crew: he can change it, not take it down.
    expect(buttons).toContain('Choose a new photo');
    expect(buttons).not.toContain('Remove photo');
  });

  it('a member can set the photo and take it down again', async () => {
    await person('maya', 'Maya');
    const crew = await s().createCrew('solstice-26', 'Bass crew');
    await s().signOut();
    await person('sam', 'Sam');
    await s().joinCrew(crew.id, mockSocial.codeOf(crew.id));
    await s().setCrewCover(crew.id, 'file:///sam.jpg');
    expect((await s().crewCover(crew.id))?.by).toBeTruthy();
    expect(await s().setCrewCover(crew.id, null)).toBeNull();
    expect(await s().crewCover(crew.id)).toBeNull();
  });
});
