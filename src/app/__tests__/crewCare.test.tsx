import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { renderApp } from './appRoutes';

/** Telling your crew how you are, through the real routes, with the in-memory backend and a festival afternoon's clock. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const network = jest.requireMock<{ __setState: (s: { isConnected?: boolean; isInternetReachable?: boolean }) => void }>('expo-network');
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
const as = (handle: string) => s().signIn(`${handle}@example.com`, 'password123');
const at = (h: number, m = 0) => new Date(2026, 10, 7, h, m);

beforeEach(async () => {
  jest.useFakeTimers({ now: at(12) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  // At the festival: the crew row on Discover shows only in festival mode (here, trying it out).
  await AsyncStorage.setItem('festivalMode.v1', JSON.stringify({ choices: {}, preview: { festivalId: 'solstice-26', until: at(12).getTime() + 365 * 86_400_000 } }));
  mockSocial = fakeSocial();
  forgetGoers();
  network.__setState({ isConnected: true, isInternetReachable: true });
});
afterEach(() => {
  network.__setState({ isConnected: true, isInternetReachable: true });
});

/** Maya and Sam in a crew; Maya's 4:05 PM check-in got through at once, her 3:00 PM video only at 5:00 PM. */
async function crewWithNews() {
  await person('maya', 'Maya');
  const crew = await s().createCrew('solstice-26', 'Bass crew');
  jest.setSystemTime(at(16, 5));
  await s().postCrewUpdate(crew.id, { id: 'u-checkin1', kind: 'checkin', at: at(16, 5).toISOString(), festivalId: 'solstice-26', stage: 'Main Stage', artistId: 'illenium', note: 'Meet at our spot' });
  jest.setSystemTime(at(17));
  await s().postCrewUpdate(crew.id, { id: 'u-video01', kind: 'video', at: at(15).toISOString(), festivalId: 'solstice-26', videoUrl: 'https://files.example/maya.mp4' });
  await s().signOut();
  await person('sam', 'Sam');
  await s().joinCrew(crew.id, mockSocial.codeOf(crew.id));
  jest.setSystemTime(at(17, 30));
  return crew;
}

const notifications = jest.requireMock<{ scheduleNotificationAsync: jest.Mock }>('expo-notifications');

describe('telling your crew how you are', () => {
  it('asks the crew for help; they see it, are nudged once, can say they’re coming; “I’m OK now” clears it', async () => {
    const crew = await crewWithNews();
    await as('sam');
    const app = await renderApp('/check-in');
    await flush();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === 'Ask my crew')?.onPress?.());
    await fireEvent.press(app.getByLabelText('Not feeling great. Ask my crew to come find me'));
    await flush();
    alert.mockRestore();
    const help = [...mockSocial.updates.values()].find((u) => u.care === 'help');
    expect(help).toMatchObject({ kind: 'checkin', crewId: crew.id, note: 'Not feeling great. Can someone come find me?' });
    expect(app.getByText('Sent to your crew')).toBeTruthy();
    await app.unmount();
    // Next time, the way to clear it.
    const back = await renderApp('/check-in');
    await flush();
    expect(back.getByText('You asked your crew for help at 5:30 PM. Feeling better? Let them know.')).toBeTruthy();
    expect(back.getByLabelText('I’m OK now. Tell my crew')).toBeTruthy();
    await back.unmount();

    // Maya: an alert wherever the crew shows, a red ring, and one nudge on her phone.
    await s().signOut();
    await as('maya');
    notifications.scheduleNotificationAsync.mockClear();
    const hers = await renderApp('/care');
    await flush();
    expect(hers.getByText('Sam isn’t feeling great')).toBeTruthy();
    const nudges = notifications.scheduleNotificationAsync.mock.calls.filter((c) => String((c[0] as { identifier: string }).identifier).startsWith('crew-help:'));
    expect(nudges).toHaveLength(1);
    expect((nudges[0][0] as { content: { title: string } }).content.title).toBe('Sam isn’t feeling great');
    await fireEvent.press(hers.getByLabelText('Tell Sam you’re on your way'));
    await flush();
    expect([...mockSocial.updates.values()].find((u) => u.kind === 'reply')).toMatchObject({ uid: expect.any(String), note: 'On my way', replyTo: help!.id });
    expect(hers.getByLabelText('You told Sam you’re on your way')).toBeTruthy();
    // Her own check-in: Tell my crew offers the one that fits, sent only if she taps it.
    await fireEvent.press(hers.getByLabelText("I'm feeling good"));
    await flush();
    expect(hers.queryByLabelText('I’m OK. Tell my crew')).toBeNull();
    await fireEvent.press(hers.getByLabelText('Tell my crew how I am'));
    expect(hers.getByLabelText('I’m OK. Tell my crew')).toBeTruthy();
    expect(hers.queryByLabelText('Not feeling great. Ask my crew to come find me')).toBeNull();
    await hers.unmount();

    // Opening again never nudges twice.
    notifications.scheduleNotificationAsync.mockClear();
    const again = await renderApp('/');
    await flush();
    expect(again.getByLabelText(/^Sam, isn’t feeling great, asked for help 5:30 PM/)).toBeTruthy();
    expect(notifications.scheduleNotificationAsync.mock.calls.filter((c) => String((c[0] as { identifier: string }).identifier).startsWith('crew-help:'))).toHaveLength(0);
    await again.unmount();

    // Sam is OK now: the alert goes.
    await s().signOut();
    await as('sam');
    jest.setSystemTime(at(17, 50));
    const his = await renderApp('/check-in');
    await flush();
    await fireEvent.press(his.getByLabelText('I’m OK now. Tell my crew'));
    await flush();
    expect(his.getByText('Sent to your crew')).toBeTruthy();
    await his.unmount();
    await s().signOut();
    await as('maya');
    const later = await renderApp('/care');
    await flush();
    expect(later.queryByText('Sam isn’t feeling great')).toBeNull();
  });
});
