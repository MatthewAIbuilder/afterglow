import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/**
 * Likes on shared videos through the real routes, with the in-memory
 * backend: a like in Discover or on the video reaches the person who filmed
 * it (once you have a profile), they see the count and who, and new likes
 * and followers show in the bell.
 */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 10; i++) await settle();
};
async function go(href: string) {
  await act(async () => router.push(href as never));
  await flush();
}
const s = () => mockSocial.service;
async function person(handle: string, withProfile = true) {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  if (withProfile) await s().saveProfile({ handle, displayName: handle === 'maya' ? 'Maya' : 'Sam', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
}
/** Maya shares a video of HEDEX at Cyclops Cove 4; then Sam signs in. */
async function mayaShares(samHasProfile = true) {
  const maya = await person('maya');
  const shared = await s().shareMemory({ memoryId: 'm1', videoUri: 'file:///m1.mov', festivalId: 'cyclops-cove-4', night: 'Friday', artistId: 'hedex', capturedAt: '2026-12-04T22:30:00.000Z', durationSec: 42, width: 1080, height: 1920 });
  await s().signOut();
  const sam = await person('sam', samHasProfile);
  return { maya, sam, id: shared.id };
}
/** Discover on Cyclops Cove 4 with the shared video in view (see community.test.tsx). */
async function openFeed() {
  const app = await renderApp('/?festival=cyclops-cove-4');
  await flush();
  await act(async () => router.setParams({ festival: 'solstice-26' }));
  await flush();
  await act(async () => router.setParams({ festival: 'cyclops-cove-4' }));
  await flush();
  return app;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('likes on shared videos', () => {
  it('a like in Discover reaches the person who filmed it, and unliking takes it back', async () => {
    const { id, sam } = await mayaShares();
    const app = await openFeed();
    expect(app.getByLabelText('Filmed by @maya. Opens their profile.')).toBeTruthy();
    const likes = () => app.getAllByLabelText('Like');
    for (const like of likes()) await fireEvent.press(like);
    await flush();
    expect(await s().likedBy(id, 10)).toEqual([sam]);
    for (const liked of app.getAllByLabelText('Liked')) await fireEvent.press(liked);
    await flush();
    expect(await s().likeCount(id)).toBe(0);
  });

  it('a shared video that couldn’t be loaded (no signal) says so with Try again, not that it’s gone', async () => {
    const { id } = await mayaShares();
    const app = await renderApp('/');
    await flush();
    mockSocial.network.noReads = true;
    await go(`/shared/${id}`);
    expect(app.getByText('Couldn’t load this video. Check your signal and try again.')).toBeTruthy();
    expect(app.queryByText('This video isn’t available any more.')).toBeNull();
    mockSocial.network.noReads = false;
    await fireEvent.press(app.getByText('Try again'));
    await flush();
    expect(app.queryByText('Couldn’t load this video. Check your signal and try again.')).toBeNull();
    expect(app.getByText('HEDEX')).toBeTruthy();
    // Really removed: that's what it says.
    await go('/shared/nope');
    expect(app.getByText('This video isn’t available any more.')).toBeTruthy();
  });

  it('without a profile a like stays private', async () => {
    const { id } = await mayaShares(false);
    const app = await openFeed();
    for (const like of app.getAllByLabelText('Like')) await fireEvent.press(like);
    await flush();
    expect(await s().likeCount(id)).toBe(0);
  });

  it('on the video itself: like it, and the count shows it', async () => {
    const { id, sam } = await mayaShares();
    const app = await renderApp(`/shared/${id}`);
    await flush();
    await fireEvent.press(app.getByLabelText('Like, 0 likes'));
    await flush();
    expect(app.getByLabelText('Liked, 1 like')).toBeTruthy();
    expect(await s().likedBy(id, 10)).toEqual([sam]);
    // It counts as a like on the clip too: it's in Your clips.
    await go('/saved');
    expect(app.getByText('From the crowd · @maya')).toBeTruthy();
  });

  it('the person who filmed it sees how many and who', async () => {
    const { id, maya } = await mayaShares();
    await s().like(id, maya);
    await s().signIn('maya@example.com', 'password123');
    const app = await renderApp(`/shared/${id}`);
    await flush();
    await fireEvent.press(app.getByLabelText('1 like. See who liked it.'));
    await flush();
    expect(app.getByText('Liked by')).toBeTruthy();
    expect(app.getByLabelText('Sam, @sam')).toBeTruthy();
  });
});

describe('the bell', () => {
  it('shows new followers and likes on your videos, and opens them', async () => {
    const { id, maya } = await mayaShares();
    await s().follow(maya);
    await s().like(id, maya);
    await s().signIn('maya@example.com', 'password123');
    const app = await renderApp('/notifications');
    await flush();
    expect(app.getByText('@sam liked your video of HEDEX')).toBeTruthy();
    expect(app.getByText('@sam started following you')).toBeTruthy();
    await fireEvent.press(app.getByLabelText(/@sam started following you/));
    await flush();
    expect(app.getByLabelText('Follow @sam')).toBeTruthy();
  });

  it('leaves out people you blocked', async () => {
    const { maya, sam } = await mayaShares();
    await s().follow(maya);
    await s().signIn('maya@example.com', 'password123');
    await s().setBlocked(sam, true);
    const app = await renderApp('/notifications');
    await flush();
    expect(app.queryByText('@sam started following you')).toBeNull();
  });
});
