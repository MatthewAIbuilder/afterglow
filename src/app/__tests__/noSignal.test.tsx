import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { forgetLastKnown, LAST_KNOWN_KEY } from '../../state/lastKnown';
import { renderApp } from './appRoutes';

/**
 * A festival with no signal: the app was used with signal, then killed and
 * opened again in airplane mode. Your crew, its chat, check-ins and meeting
 * spot still show (with when they were read), and what you send waits.
 */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const network = jest.requireMock<{ __setState: (s: { isConnected?: boolean; isInternetReachable?: boolean }) => void }>('expo-network');
const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 12) => {
  for (let i = 0; i < rounds; i++) await settle();
};
const s = () => mockSocial.service;
async function person(handle: string, name: string) {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: name, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
}
const at = (h: number, m = 0) => new Date(2026, 10, 7, h, m);

beforeEach(async () => {
  jest.useFakeTimers({ now: at(12) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetGoers();
  network.__setState({ isConnected: true, isInternetReachable: true });
});
afterEach(() => {
  network.__setState({ isConnected: true, isInternetReachable: true });
});

/** Maya starts a crew, checks in at Main Stage, sets a meeting spot and writes in the chat; Sam joins. */
async function crewDay() {
  await person('maya', 'Maya');
  const crew = await s().createCrew('solstice-26', 'Bass crew');
  jest.setSystemTime(at(16, 5));
  await s().postCrewUpdate(crew.id, { id: 'u-checkin1', kind: 'checkin', at: at(16, 5).toISOString(), festivalId: 'solstice-26', stage: 'Main Stage', note: 'Front left' });
  await s().setMeetSpot(crew.id, 'The big tree');
  await s().sendCrewMessages(crew.id, [{ id: 'm-hello01', text: 'Water break at the big tree', at: at(16, 10).toISOString() }]);
  await s().signOut();
  await person('sam', 'Sam');
  await s().joinCrew(crew.id, mockSocial.codeOf(crew.id));
  jest.setSystemTime(at(17, 30));
  return crew;
}

/** Use the app with signal (what it reads is kept), then "kill" it: only the phone's storage is left. */
async function usedWithSignal(crewId: string) {
  const page = await renderApp(`/crew/${crewId}`);
  await flush();
  expect(page.getByText('Bass crew')).toBeTruthy();
  expect(page.getByText(/Front left/)).toBeTruthy();
  await page.unmount();
  const chat = await renderApp(`/crew-chat/${crewId}`);
  await flush();
  expect(chat.getByText('Water break at the big tree')).toBeTruthy();
  await chat.unmount();
  await flush();
  expect(await AsyncStorage.getItem(LAST_KNOWN_KEY)).toContain('Water break at the big tree');
  forgetLastKnown();
}

const airplaneMode = () => {
  mockSocial.network.down = true;
  mockSocial.network.noReads = true;
  network.__setState({ isConnected: false, isInternetReachable: false });
};

describe('no signal at the festival', () => {
  it('opening the app in airplane mode shows your crew, its check-ins, meeting spot and chat as you last had them', async () => {
    const crew = await crewDay();
    await usedWithSignal(crew.id);
    jest.setSystemTime(at(21, 15));
    airplaneMode();

    const page = await renderApp(`/crew/${crew.id}`);
    await flush();
    expect(page.getByText('Bass crew')).toBeTruthy();
    expect(page.getAllByText('No signal, showing what you had · Last updated 5:30 PM').length).toBeGreaterThan(0);
    expect(page.getByText(/Front left/)).toBeTruthy();
    expect(page.getByText('The big tree')).toBeTruthy();
    expect(page.queryByText('Couldn’t open this crew')).toBeNull();
    await page.unmount();

    const chat = await renderApp(`/crew-chat/${crew.id}`);
    await flush();
    expect(chat.getByText('Water break at the big tree')).toBeTruthy();
    expect(chat.getByText('No signal, showing what you had · Last updated 5:30 PM')).toBeTruthy();
    expect(chat.queryByText('No messages yet. Say hi to your crew.')).toBeNull();
    await chat.unmount();
  });

  it('“I’m OK” still works with no signal on opening, and reaches the crew once there’s a bar', async () => {
    const crew = await crewDay();
    await usedWithSignal(crew.id);
    jest.setSystemTime(at(21, 15));
    airplaneMode();

    const app = await renderApp('/check-in');
    await flush();
    await fireEvent.press(app.getByLabelText('I’m OK. Tell my crew'));
    await flush();
    expect([...mockSocial.updates.values()].some((u) => u.care === 'ok')).toBe(false);
    expect(JSON.parse((await AsyncStorage.getItem('crewOutbox.v1')) ?? '[]')).toHaveLength(1);

    // Signal comes back at 9:40 PM: it goes by itself, still marked 9:15 PM.
    jest.setSystemTime(at(21, 40));
    mockSocial.network.down = false;
    mockSocial.network.noReads = false;
    await act(async () => network.__setState({ isConnected: true, isInternetReachable: true }));
    await flush(30);
    const ok = [...mockSocial.updates.values()].find((u) => u.care === 'ok');
    expect(ok?.crewId).toBe(crew.id);
    expect(Date.parse(ok!.at) - at(21, 15).getTime()).toBeLessThan(60_000);
    await app.unmount();
  });

  it('a read that doesn’t get through never empties what you had: it says when it was last updated', async () => {
    const crew = await crewDay();
    await usedWithSignal(crew.id);
    jest.setSystemTime(at(18));
    // The phone thinks it has signal, but nothing gets through (festival Wi-Fi with no way out).
    mockSocial.network.noReads = true;
    const page = await renderApp(`/crew/${crew.id}`);
    await flush();
    expect(page.getByText('Bass crew')).toBeTruthy();
    expect(page.getAllByText('Last updated 5:30 PM').length).toBeGreaterThan(0);
    await page.unmount();
  });

  it('with nothing kept yet, it says so plainly instead of loading forever', async () => {
    const crew = await crewDay();
    airplaneMode();
    const chat = await renderApp(`/crew-chat/${crew.id}`);
    await flush();
    expect(chat.queryByText('No messages yet. Say hi to your crew.')).toBeNull();
    await chat.unmount();
  });

  it('the festival map says the streets may not load, and the festivals still show', async () => {
    airplaneMode();
    const map = await renderApp('/festival-map');
    await flush();
    expect(map.getByText('No signal · the streets may not load, the festivals still show')).toBeTruthy();
    await map.unmount();
  });
});
