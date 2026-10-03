import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { Alert, Share } from 'react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { forgetStandings } from '../../features/standing/useStanding';
import { forgetBadges } from '../../features/badges/useBadges';
import { forgetCrowd } from '../../features/festivals/CrowdVideos';
import { renderApp, showTab } from './appRoutes';

/** Founders and festival badges through the real routes, with the in-memory backend. */
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
const at = (h: number, m = 0) => new Date(2026, 10, 7, h, m);

beforeEach(async () => {
  jest.useFakeTimers({ now: at(12) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetGoers();
  forgetStandings();
  forgetBadges();
  forgetCrowd();
  network.__setState({ isConnected: true, isInternetReachable: true });
});
afterEach(() => {
  network.__setState({ isConnected: true, isInternetReachable: true });
});

const share = (id: string, festivalId: string, capturedAt: Date) =>
  s().shareMemory({ memoryId: id, videoUri: `file:///${id}.mp4`, festivalId, capturedAt: capturedAt.toISOString(), durationSec: 30 });

describe('founders', () => {
  it('the first people with a profile get a number and a gold ring caption that others see too', async () => {
    await person('maya', 'Maya');
    const app = await renderApp('/profile');
    await flush();
    expect(app.getByText('One of the first 100 on Afterglow · #1')).toBeTruthy();
    await app.unmount();
    await s().signOut();
    await person('sam', 'Sam');
    const sams = await renderApp('/u/maya');
    await flush();
    expect(sams.getByText('One of the first 100 on Afterglow · #1')).toBeTruthy();
    expect([...mockSocial.founders.values()].sort()).toEqual([1, 2]);
  });

  it('once 100 are taken, nobody else gets one', async () => {
    mockSocial.counter.founders = 100;
    await person('late', 'Late');
    const app = await renderApp('/profile');
    await flush();
    expect(app.queryByText(/One of the first 100/)).toBeNull();
    expect(mockSocial.founders.size).toBe(0);
  });

  it('a flair given by Afterglow shows as a caption', async () => {
    const uid = await person('artist', 'Big Artist');
    mockSocial.flairs.set(uid, { kind: 'artist', caption: 'Artist' });
    const app = await renderApp('/profile');
    await flush();
    expect(app.getByText('Artist')).toBeTruthy();
  });
});

describe('festival badges', () => {
  it('a video shared from a festival, filmed on its dates, earns its badge; others can see it', async () => {
    await person('maya', 'Maya');
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4', 'eternal-nye-26']));
    await share('m1', 'cyclops-cove-4', new Date(2026, 11, 5, 22, 30));
    // Tagged there but filmed weeks before: no badge.
    await share('m2', 'eternal-nye-26', new Date(2026, 10, 1, 20));
    const app = await renderApp('/profile');
    await flush();
    await fireEvent.press(app.getByRole('tab', { name: /^Badges/ }));
    await flush();
    expect(app.getByText('1 badge collected')).toBeTruthy();
    expect(app.getByLabelText(/^Eternal NYE 2026 badge, not collected yet/)).toBeTruthy();
    await fireEvent.press(app.getByLabelText(/^Cyclops Cove 4 badge, collected\. 1 video filmed there/));
    await flush();
    expect(app.getByText('In your collection')).toBeTruthy();
    expect(app.getByText('Earned Dec 5, 2026 · 1 video')).toBeTruthy();
    expect(app.getByText('Watch the video')).toBeTruthy();
    await app.unmount();

    await s().signOut();
    await person('sam', 'Sam');
    const sams = await renderApp('/u/maya');
    await flush();
    expect(sams.getByLabelText(/^Cyclops Cove 4 badge, collected/)).toBeTruthy();
    expect(sams.queryByLabelText(/^Eternal NYE 2026 badge/)).toBeNull();
  });
});

describe('videos from the crowd on festival pages', () => {
  it('shows what people filmed there, night by night, and opens one', async () => {
    await person('maya', 'Maya');
    await s().shareMemory({ memoryId: 'x1', videoUri: 'file:///x1.mp4', festivalId: 'cyclops-cove-4', night: 'Saturday', artistId: 'subtronics', capturedAt: new Date(2026, 11, 5, 22).toISOString() });
    await s().shareMemory({ memoryId: 'x2', videoUri: 'file:///x2.mp4', festivalId: 'cyclops-cove-4', night: 'Friday', capturedAt: new Date(2026, 11, 4, 23).toISOString() });
    await s().signOut();
    await person('sam', 'Sam');
    const app = await renderApp('/festival/cyclops-cove-4');
    await flush();
    await showTab(app, 'Videos');
    await flush();
    expect(app.getByText('2 videos from 1 person')).toBeTruthy();
    const nights = app.getAllByText(/^(Friday|Saturday) \d+$/).map((t) => t.props.children[0]);
    expect(nights).toEqual(['Friday', 'Saturday']);
    expect(app.getByLabelText('SUBTRONICS, filmed by @maya, Saturday')).toBeTruthy();
  });

  it('asks you to sign in first', async () => {
    const app = await renderApp('/festival/cyclops-cove-4');
    await flush();
    await showTab(app, 'Videos');
    expect(app.getByText('Sign in to see what people on Afterglow filmed here.')).toBeTruthy();
  });
});

describe('cover photo', () => {
  it('can be added from Edit profile and shows across the top of your profile', async () => {
    const picker = jest.requireMock<{ launchImageLibraryAsync: jest.Mock }>('expo-image-picker');
    picker.launchImageLibraryAsync.mockImplementationOnce(async () => ({ canceled: false, assets: [{ uri: 'file:///cover.jpg' }] }));
    const uid = await person('maya', 'Maya');
    const app = await renderApp('/profile-edit');
    await flush();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === 'Choose a photo')?.onPress?.());
    await fireEvent.press(app.getByLabelText('Add a cover photo'));
    await flush();
    alert.mockRestore();
    expect(mockSocial.profiles.get(uid)?.coverUrl).toBe(`https://example.test/covers/${uid}.jpg`);
    expect(app.getByLabelText('Change cover photo')).toBeTruthy();
  });
});

describe('sharing a badge', () => {
  it('shows the badge as a story card and shares it as text with a link', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockImplementation(async () => ({ action: 'sharedAction' }));
    await person('maya', 'Maya');
    await share('m1', 'cyclops-cove-4', new Date(2026, 11, 5, 22, 30));
    const app = await renderApp('/badge/cyclops-cove-4');
    await flush();
    await fireEvent.press(app.getByLabelText('Share your badge'));
    await flush();
    expect(app.getByLabelText('Cyclops Cove 4 badge, collected by Maya')).toBeTruthy();
    expect(app.getByText('COLLECTED')).toBeTruthy();
    await fireEvent.press(app.getByText('Share as text'));
    await flush();
    const message = (shareSpy.mock.calls[0]?.[0] as { message?: string })?.message ?? '';
    expect(message).toContain('I collected the Cyclops Cove 4 badge on Afterglow.');
    expect(message).toContain('https://afterglowmusic.app/u/maya');
    shareSpy.mockRestore();
  });
});

describe('live from the crowd', () => {
  it('shows what people filmed in the last few hours while the festival is on', async () => {
    jest.setSystemTime(new Date(2026, 11, 5, 23, 0));
    await person('maya', 'Maya');
    await s().shareMemory({ memoryId: 'l1', videoUri: 'file:///l1.mp4', festivalId: 'cyclops-cove-4', artistId: 'subtronics', capturedAt: new Date(2026, 11, 5, 22, 40).toISOString() });
    await s().shareMemory({ memoryId: 'l2', videoUri: 'file:///l2.mp4', festivalId: 'cyclops-cove-4', capturedAt: new Date(2026, 11, 4, 22, 0).toISOString() });
    await s().signOut();
    await person('sam', 'Sam');
    await AsyncStorage.setItem('tonightShown.v1', 'cyclops-cove-4:2026-12-05');
    const app = await renderApp('/festival/cyclops-cove-4');
    await flush();
    expect(app.getByText('Live from the crowd')).toBeTruthy();
    expect(app.getByLabelText('SUBTRONICS, filmed by @maya, 20 min ago')).toBeTruthy();
    expect(app.queryAllByLabelText(/filmed by @maya, 1 day/)).toHaveLength(0);
  });
});

describe('the edge glow', () => {
  it('frames videos filmed with Afterglow, unless the person who filmed it has Afterglow Plus', async () => {
    const uid = await person('maya', 'Maya');
    const shared = await s().shareMemory({ memoryId: 'g1', videoUri: 'file:///g1.mp4', festivalId: 'cyclops-cove-4', capturedAt: new Date(2026, 11, 5, 22).toISOString() });
    await s().signOut();
    await person('sam', 'Sam');
    const app = await renderApp(`/shared/${shared.id}`);
    await flush();
    expect(app.getByTestId('edge-glow-label', { includeHiddenElements: true })).toBeTruthy();
    await app.unmount();

    mockSocial.plus.add(uid);
    forgetStandings();
    const again = await renderApp(`/shared/${shared.id}`);
    await flush();
    expect(again.queryByTestId('edge-glow-label', { includeHiddenElements: true })).toBeNull();
  });
});
