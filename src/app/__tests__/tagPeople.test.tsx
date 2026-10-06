import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/**
 * Tagging people in a shared video, through the real routes, with the
 * in-memory backend: the person who filmed it tags a friend, it shows on the
 * friend's profile under Tagged straight away (and in the bell), and the
 * friend can hide it from the video's page.
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

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
});
afterEach(() => {
  jest.restoreAllMocks();
});


describe('tagging people in a video', () => {
  it('a tag shows on the friend’s profile straight away, and in the bell under Tagged', async () => {
    const { sam, id } = await mayaShares();
    await s().signOut();
    await s().signIn('maya@example.com', 'password123');
    await s().setVideoTags(id, [sam]);
    await s().follow(sam);
    await s().signOut();
    await s().signIn('sam@example.com', 'password123');
    expect(await s().activity(10)).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'tag', from: expect.any(String), memoryId: id })]));
    expect(await s().taggedMemoriesOf(sam)).toHaveLength(1);

    const app = await renderApp(`/shared/${id}`);
    await flush();
    // Nothing to say yes to: it's already on Sam's profile.
    expect(app.queryByTestId('tag-ask')).toBeNull();
    expect(app.getByText('On your profile under Tagged · Hide it')).toBeTruthy();
    expect(app.getByText('@sam')).toBeTruthy();

    // On Sam's profile: Moments' Tagged filter.
    await act(async () => router.navigate('/profile'));
    await flush();
    await fireEvent.press(app.getByRole('button', { name: 'Tagged · 1' }));
    expect(app.getAllByLabelText(/^Video: /)).toHaveLength(1);

    // The bell has its own Tagged filter.
    await go('/notifications');
    await fireEvent.press(app.getByRole('button', { name: 'Tagged' }));
    expect(app.getByText('@maya tagged you in a video')).toBeTruthy();
    expect(app.queryByText(/started following you/)).toBeNull();

    // And on Sam's page for anyone else.
    await go('/u/sam');
    expect(app.getByText('Tagged · 1')).toBeTruthy();
  });

  it('the friend can hide it later; the owner tags people from the tagging sheet', async () => {
    const { sam, id } = await mayaShares();
    await s().signOut();
    await s().signIn('maya@example.com', 'password123');
    const app = await renderApp(`/memory-tag?shared=${id}`);
    await flush();
    await fireEvent.changeText(app.getByLabelText('Search for people to tag'), 'sam');
    await flush();
    await fireEvent.press(app.getByLabelText('Tag Sam, @sam'));
    await fireEvent.press(app.getByLabelText('Save to Memories'));
    await flush();
    expect(await s().videoTags(id)).toEqual([expect.objectContaining({ uid: sam, status: 'approved' })]);

    await act(async () => void (await s().signIn('sam@example.com', 'password123')));
    await flush();
    await go(`/shared/${id}`);
    await fireEvent.press(app.getByText('On your profile under Tagged · Hide it'));
    await flush();
    expect(app.queryByText('On your profile under Tagged · Hide it')).toBeNull();
    expect(await s().taggedMemoriesOf(sam)).toEqual([]);
  });

  it('a tag from before (never answered) shows once the bell is read', async () => {
    const { sam, id } = await mayaShares();
    mockSocial.videoTags.set(`${id}_${sam}`, { id: `${id}_${sam}`, memoryId: id, owner: 'someone', uid: sam, status: 'pending', createdAt: '2026-10-01T10:00:00.000Z' });
    expect(await s().taggedMemoriesOf(sam)).toEqual([]);
    await s().activity(10);
    expect(await s().taggedMemoriesOf(sam)).toHaveLength(1);
  });

  it('a profile’s videos open to swipe through, like Discover', async () => {
    const { id } = await mayaShares();
    await s().signOut();
    await s().signIn('maya@example.com', 'password123');
    const second = await s().shareMemory({ memoryId: 'm2', videoUri: 'file:///m2.mov', festivalId: 'cyclops-cove-4', night: 'Saturday', artistId: 'subtronics', capturedAt: '2026-12-05T22:30:00.000Z' });
    await s().signOut();
    await s().signIn('sam@example.com', 'password123');
    const app = await renderApp('/u/maya');
    await flush();
    await fireEvent.press(app.getByLabelText('Video of HEDEX'));
    await flush();
    // Both videos are pages of one swipe-through, newest first as on the profile.
    expect(app.getByTestId('pager').props.data).toEqual([second.id, id]);
    expect(app.getByText('HEDEX')).toBeTruthy();
  });
});
