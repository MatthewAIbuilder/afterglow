import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { Alert, type AlertButton, Share } from 'react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { forgetStandings } from '../../features/standing/useStanding';
import { forgetGuestView } from '../../state/adminView';
import { forgetLivePatches } from '../../state/livePatches';
import { renderApp, showTab } from './appRoutes';

/** HQ's Data and Accounts tabs, through the real routes with the in-memory backend. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const picker = jest.requireMock<{ __state: { next: { uri: string; name: string; mimeType?: string; size?: number }[] } }>('expo-document-picker').__state;
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
/** Every alert taps the button with this label (or does nothing). */
const answerAlerts = (label?: string) => jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons?: AlertButton[]) => void buttons?.find((b) => b.text === label)?.onPress?.());

beforeEach(async () => {
  jest.restoreAllMocks();
  jest.useFakeTimers({ now: new Date(2026, 10, 7, 12) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetGoers();
  forgetGuestView();
  forgetLivePatches();
  forgetStandings();
  picker.next = [];
});

async function hq() {
  mockSocial.verified.add(SUPPORT);
  await s().signUp(SUPPORT, 'password123');
  const app = await renderApp('/');
  await flush();
  return app;
}

describe('HQ data', () => {
  it('reads pasted set times for a festival, and publishing reaches the app', async () => {
    const app = await hq();
    await showTab(app, 'Data');
    await fireEvent.changeText(app.getByLabelText('Find a festival'), 'Cyclops');
    await fireEvent.press(app.getByText('Cyclops Cove 4'));
    await fireEvent.changeText(app.getByLabelText('Lineup or set times as text'), 'Friday\nMain Stage\n10:00 PM SUBTRONICS\n11:30 PM Brand New Act');
    await fireEvent.press(app.getByText('Read the text'));
    expect(app.getByText('Check before publishing')).toBeTruthy();
    expect(app.getByText('Cyclops Cove 4, set times')).toBeTruthy();
    expect(app.getByText(/2 acts \(1 already on Afterglow, 1 new\) · 2 set times/)).toBeTruthy();
    expect(app.getByText('New to Afterglow: Brand New Act.')).toBeTruthy();

    answerAlerts('Publish');
    await fireEvent.press(app.getByText('Publish to everyone'));
    await flush();
    const [patch] = [...mockSocial.patches.values()];
    expect(patch).toMatchObject({ title: 'Cyclops Cove 4, set times', festivalId: 'cyclops-cove-4' });
    expect(app.getByText('Live on Afterglow')).toBeTruthy();
    expect(app.getByLabelText('Take down Cyclops Cove 4, set times')).toBeTruthy();
    await app.unmount();

    // Everyone's app now has the new act and its set (a fresh start reads what's published).
    forgetLivePatches();
    await s().signOut();
    const fan = await renderApp('/festival/cyclops-cove-4');
    await flush();
    await showTab(fan, 'Lineup');
    expect(fan.getAllByText('Brand New Act').length).toBeGreaterThan(0);
    await fan.unmount();

    // Taking it down.
    await s().signIn(SUPPORT, 'password123');
    const again = await renderApp('/');
    await flush();
    await showTab(again, 'Data');
    answerAlerts('Take down');
    await fireEvent.press(again.getByLabelText('Take down Cyclops Cove 4, set times'));
    await flush();
    expect(mockSocial.patches.size).toBe(0);
  });

  it('sets a festival’s official page to watch every night', async () => {
    const app = await hq();
    await showTab(app, 'Data');
    await fireEvent.changeText(app.getByLabelText('Find a festival'), 'Cyclops');
    await fireEvent.press(app.getByText('Cyclops Cove 4'));
    await fireEvent.changeText(app.getByLabelText('Official page'), 'not a page');
    answerAlerts();
    await fireEvent.press(app.getByText('Watch this page'));
    expect(Alert.alert).toHaveBeenCalledWith('Check the address', expect.any(String));
    await fireEvent.changeText(app.getByLabelText('Official page'), 'https://cyclopscove.com/lineup');
    await fireEvent.press(app.getByText('Watch this page'));
    expect(app.getByText('Cyclops Cove 4, official page')).toBeTruthy();
    answerAlerts('Publish');
    await fireEvent.press(app.getByText('Publish to everyone'));
    await flush();
    const [patch] = [...mockSocial.patches.values()];
    const festival = JSON.parse(patch.file).festivals[0];
    expect(festival).toMatchObject({ id: 'cyclops-cove-4', website: 'https://cyclopscove.com/lineup' });
    // Everything else it had is kept.
    expect(festival.lineup.length).toBeGreaterThan(1);
  });

  it('keeps pictures and PDFs in the inbox and hands them to a Claude Code session', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    const app = await hq();
    await showTab(app, 'Data');
    await fireEvent.press(app.getByText('+ New festival'));
    await fireEvent.changeText(app.getByLabelText('Festival name'), 'Lost Lands 2027');
    picker.next = [
      { uri: 'file:///poster.png', name: 'poster.png', mimeType: 'image/png', size: 2_000_000 },
      { uri: 'file:///times.pdf', name: 'times.pdf', mimeType: 'application/pdf', size: 300_000 },
    ];
    await fireEvent.press(app.getByText('+ Add pictures or PDFs'));
    await flush();
    expect(app.getByText('poster.png')).toBeTruthy();
    await fireEvent.changeText(app.getByLabelText('Note'), 'Full lineup poster');
    await fireEvent.press(app.getByText('Save to the inbox'));
    await flush();
    const [drop] = [...mockSocial.drops.values()];
    expect(drop).toMatchObject({ festivalName: 'Lost Lands 2027', note: 'Full lineup poster', status: 'waiting' });
    expect(drop.files.map((f) => f.name)).toEqual(['poster.png', 'times.pdf']);
    expect(app.getByText('New festival: Lost Lands 2027')).toBeTruthy();

    await fireEvent.press(app.getAllByText('Copy for Claude')[0]);
    await flush();
    const message = (share.mock.calls[0][0] as { message: string }).message;
    expect(message).toContain('New festival: Lost Lands 2027');
    expect(message).toContain(drop.files[0].url);
    expect(mockSocial.drops.get(drop.id)?.status).toBe('sent');
  });

  it('publishes an update a Claude Code session gave back', async () => {
    const app = await hq();
    await showTab(app, 'Data');
    const file = { version: 1, artists: [{ id: 'new-act', name: 'New Act', sound: {} }], festivals: [{ id: 'new-fest', name: 'New Fest', dates: 'Jan 5', location: 'Somewhere', lineup: ['subtronics', 'new-act'], days: [], stages: [] }], clips: [] };
    await fireEvent.changeText(app.getByLabelText('Lineup or set times as text'), JSON.stringify(file));
    await fireEvent.press(app.getByText('Read the text'));
    expect(app.getByText('New Fest: 2 acts, 1 new to Afterglow')).toBeTruthy();
    answerAlerts('Publish');
    await fireEvent.press(app.getByText('Publish to everyone'));
    await flush();
    expect([...mockSocial.patches.values()][0]).toMatchObject({ festivalId: 'new-fest' });
  });
});

describe('HQ accounts', () => {
  it('gives someone Plus and an artist flair, and takes them back', async () => {
    await s().signUp('maya@example.com', 'password123');
    await s().saveProfile({ handle: 'maya', displayName: 'Maya', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
    const maya = mockSocial.currentUser()!.uid;
    await s().signOut();
    const app = await hq();
    await showTab(app, 'Accounts');
    await fireEvent.changeText(app.getByLabelText('Find someone by name or @handle'), 'maya');
    await settle(400);
    await flush();
    await fireEvent.press(app.getByLabelText(/^Maya, @maya\. No special privileges/));
    await fireEvent(app.getByLabelText('Afterglow Plus'), 'valueChange', true);
    await fireEvent.press(app.getByLabelText('Plus for 1 year'));
    await fireEvent.press(app.getByLabelText('Artist flair'));
    expect(app.getByDisplayValue('Artist on Afterglow')).toBeTruthy();
    answerAlerts();
    await fireEvent.press(app.getByText('Save privileges'));
    await flush();
    expect(await s().standingOf(maya)).toMatchObject({ plus: true, flair: { kind: 'artist', caption: 'Artist on Afterglow' } });
    expect(app.getAllByText(/Plus until Nov 7, 2027 · Artist flair/).length).toBeGreaterThan(0);

    await fireEvent(app.getByLabelText('Afterglow Plus'), 'valueChange', false);
    await fireEvent.press(app.getByLabelText('No flair'));
    await fireEvent.press(app.getByText('Save privileges'));
    await flush();
    expect(await s().standingOf(maya)).toEqual({});
  });

  it('nobody else can upload, publish or give privileges', async () => {
    await s().signUp('maya@example.com', 'password123');
    await expect(s().addDrop({ note: '', files: [] })).rejects.toThrow();
    await expect(s().publishPatch({ title: 'x', festivalId: 'y', file: '{}' })).rejects.toThrow();
    await expect(s().setPlus('someone', {})).rejects.toThrow();
  });
});
