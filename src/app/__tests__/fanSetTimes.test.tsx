import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert, type AlertButton } from 'react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetLivePatches } from '../../state/livePatches';
import { renderApp, showTab } from './appRoutes';

/** Set times from fans: sent from a festival page, checked and published in HQ, and the sender thanked. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const picker = jest.requireMock<{ launchImageLibraryAsync: jest.Mock }>('expo-image-picker');
const scheduled = jest.requireMock<{ __scheduled: Map<string, { content: { title: string; body: string } }> }>('expo-notifications').__scheduled;
const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 12) => {
  for (let i = 0; i < rounds; i++) await settle();
};
const s = () => mockSocial.service;
const SUPPORT = 'afterglowmusic.support@gmail.com';
const answerAlerts = (label?: string) => jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons?: AlertButton[]) => void buttons?.find((b) => b.text === label)?.onPress?.());

beforeEach(async () => {
  jest.restoreAllMocks();
  jest.useFakeTimers({ now: new Date(2026, 9, 4, 12) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetLivePatches();
  scheduled.clear();
});

describe('set times from fans', () => {
  it('a fan sends them, HQ checks and publishes them, and the fan is thanked with Set scout', async () => {
    // A fan, on a festival with no set times yet.
    const fan = await s().signUp('maya@example.com', 'password123');
    const app = await renderApp('/festival/edc-orlando-26');
    await flush();
    await fireEvent.press(app.getByText('Seen the set times? Send them to us'));
    await flush();
    expect(app.getByText('EDC Orlando 2026')).toBeTruthy();
    await fireEvent.changeText(app.getByLabelText('Set times as text'), 'Friday\nMain Stage\n10:00 PM SUBTRONICS');
    picker.launchImageLibraryAsync.mockImplementationOnce(async () => ({ canceled: false, assets: [{ uri: 'file:///timetable.png', width: 2400, height: 3200 }] }));
    await fireEvent.press(app.getByText('Add a screenshot of the timetable'));
    await flush();
    expect(app.getByText('Your screenshot')).toBeTruthy();
    await fireEvent.press(app.getByText('Send to Afterglow'));
    await flush();
    expect(app.getByText('Thank you')).toBeTruthy();
    const [tip] = [...mockSocial.setTimes.values()];
    expect(tip).toMatchObject({ uid: fan.uid, festivalId: 'edc-orlando-26', status: 'new', text: 'Friday\nMain Stage\n10:00 PM SUBTRONICS' });
    expect(tip.photo).toMatch(/^data:image\/jpeg;base64,/);

    // Once each until it's dealt with.
    await act(async () => router.push('/send-set-times/edc-orlando-26'));
    await flush();
    await fireEvent.changeText(app.getByLabelText('Set times as text'), 'again');
    await fireEvent.press(app.getByText('Send to Afterglow'));
    await flush();
    expect(app.getByText('You’ve already sent set times for this festival. We’ll look at them soon.')).toBeTruthy();
    await app.unmount();

    // HQ reads it into the box, checks and publishes it.
    await s().signOut();
    mockSocial.verified.add(SUPPORT);
    await s().signUp(SUPPORT, 'password123');
    const hq = await renderApp('/');
    await flush();
    await showTab(hq, 'Data');
    expect(hq.getByText('Set times from fans · 1')).toBeTruthy();
    await fireEvent.press(hq.getByLabelText('Read the set times sent for EDC Orlando 2026'));
    await flush();
    expect(hq.getByLabelText('Lineup or set times as text').props.value).toBe('Friday\nMain Stage\n10:00 PM SUBTRONICS');
    await fireEvent.press(hq.getByText('Read the text'));
    expect(hq.getByText('EDC Orlando 2026, set times')).toBeTruthy();
    answerAlerts('Publish');
    await fireEvent.press(hq.getByText('Publish to everyone'));
    await flush();
    expect(mockSocial.patches.size).toBe(1);
    expect(mockSocial.setTimes.get(tip.id)).toMatchObject({ status: 'live' });
    expect(mockSocial.setTimes.get(tip.id)?.photo).toBeUndefined();
    expect(hq.queryByText(/^Set times from fans/)).toBeNull();
    await hq.unmount();

    // The fan opens the app: thanked once, and Set scout is theirs.
    await s().signOut();
    await s().signIn('maya@example.com', 'password123');
    const back = await renderApp('/profile');
    await flush();
    expect(scheduled.get('scout:edc-orlando-26')?.content).toMatchObject({ title: 'Your set times are live' });
    await showTab(back, 'Badges');
    expect(back.getByLabelText(/^Set scout\./)).toBeTruthy();
  });

  it('declining deletes them, so they can be sent again', async () => {
    await s().signUp('maya@example.com', 'password123');
    await s().sendSetTimes('edc-orlando-26', { text: 'Friday 10 PM SUBTRONICS' });
    await s().signOut();
    mockSocial.verified.add(SUPPORT);
    await s().signUp(SUPPORT, 'password123');
    const hq = await renderApp('/');
    await flush();
    await showTab(hq, 'Data');
    answerAlerts('Decline');
    await fireEvent.press(hq.getByLabelText('Decline the set times sent for EDC Orlando 2026'));
    await flush();
    expect(mockSocial.setTimes.size).toBe(0);
  });

  it('signed out, it asks for a free account first', async () => {
    const app = await renderApp('/send-set-times/edc-orlando-26');
    await flush();
    expect(app.getByText('Create a free account')).toBeTruthy();
    expect(app.queryByLabelText('Set times as text')).toBeNull();
  });
});
