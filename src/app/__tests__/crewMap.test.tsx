import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { renderApp } from './appRoutes';

/** Crew on the map at EDC Orlando: switch it on, the crew has your spot, and you see who's near. */
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
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetGoers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('crew on the map', () => {
  it('shares where you are with the crew while the festival is on, and shows where they are', async () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 7, 21, 0) });
    const L = Location as unknown as Record<string, jest.Mock>;
    L.requestForegroundPermissionsAsync.mockImplementation(async () => ({ granted: true }));
    L.getForegroundPermissionsAsync.mockImplementation(async () => ({ granted: true }));
    L.getCurrentPositionAsync.mockImplementation(async () => ({ coords: { latitude: 28.537, longitude: -81.404, accuracy: 10 } }));
    L.watchPositionAsync.mockImplementation((async (_o: unknown, cb: (p: unknown) => void) => {
      cb({ coords: { latitude: 28.537, longitude: -81.404, accuracy: 10 } });
      return { remove: jest.fn() };
    }) as never);
    await person('maya', 'Maya');
    const crew = await s().createCrew('edc-orlando-26', 'Bass crew');
    await s().shareLive(crew.id, { lat: 28.5379, lon: -81.404, until: Date.now() + 3 * 3600_000 });
    await s().signOut();
    const sam = await person('sam', 'Sam');
    await s().joinCrew(crew.id, mockSocial.codeOf(crew.id));
    const app = await renderApp(`/crew/${crew.id}`);
    await flush();
    expect(app.getByText('Crew on the map')).toBeTruthy();
    expect(app.getByLabelText(/^Maya: (100 m|328 ft|0\.1 mi) away, north\. Just now$/)).toBeTruthy();
    await fireEvent(app.getByLabelText('Share where I am with Bass crew'), 'valueChange', true);
    await flush();
    const mine = mockSocial.live.get(crew.id)?.get(sam);
    expect(mine).toEqual(expect.objectContaining({ lat: 28.537, lon: -81.404 }));
    // It stops by itself at 7 AM the morning after the last day (the crew's copy never runs more than a day ahead).
    const until = JSON.parse((await AsyncStorage.getItem('crewLive.v1')) ?? '{}')[crew.id];
    expect(new Date(until).toString()).toBe(new Date(2026, 10, 9, 7).toString());
    expect(mine!.until).toBeLessThanOrEqual(Date.now() + 24 * 3600_000);
    await fireEvent(app.getByLabelText('Share where I am with Bass crew'), 'valueChange', false);
    await flush();
    expect(mockSocial.live.get(crew.id)?.has(sam)).toBe(false);
    await app.unmount();
  });
});
