import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { forgetStandings } from '../../features/standing/useStanding';
import { forgetBadges } from '../../features/badges/useBadges';
import { renderApp } from './appRoutes';

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
