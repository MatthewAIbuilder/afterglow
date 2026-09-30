import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ActionSheetIOS, Alert, type AlertButton } from 'react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/**
 * Following people through the real routes, with the in-memory backend:
 * Follow on a profile, the counts and lists, Following in Discover, and
 * blocking ending follows.
 */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 8; i++) await settle();
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
/** Maya (with a shared video of HEDEX at Cyclops Cove 4), then Sam, who stays signed in. */
async function mayaAndSam(samHasProfile = true) {
  const maya = await person('maya');
  await s().shareMemory({ memoryId: 'm1', videoUri: 'file:///m1.mov', festivalId: 'cyclops-cove-4', night: 'Friday', artistId: 'hedex', capturedAt: '2026-12-04T22:30:00.000Z', durationSec: 42, width: 1080, height: 1920 });
  await s().signOut();
  const sam = await person('sam', samHasProfile);
  return { maya, sam };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('following people', () => {
  it('a profile says what you have in common', async () => {
    const maya = await s().signUp('maya@example.com', 'password123');
    await s().saveProfile({ handle: 'maya', displayName: 'Maya', bio: '', showFestivals: true, showSound: false }, { festivals: ['cyclops-cove-4'], sounds: [] });
    await s().shareMemory({ memoryId: 'm1', videoUri: 'file:///m1.mov', festivalId: 'cyclops-cove-4', night: 'Friday', artistId: 'hedex', capturedAt: '2026-12-04T22:30:00.000Z', durationSec: 42, width: 1080, height: 1920 });
    await s().signOut();
    await person('sam');
    expect(maya.uid).toBeTruthy();
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ hedex: 'love' }));
    const app = await renderApp('/u/maya');
    await flush();
    expect(app.getByText('In common')).toBeTruthy();
    expect(app.getByText('You’re both going to Cyclops Cove 4')).toBeTruthy();
    expect(app.getByText('They filmed HEDEX, who you love')).toBeTruthy();
  });

  it('Follow on a profile: counts change, and the lists show who follows whom', async () => {
    const { maya, sam } = await mayaAndSam();
    const app = await renderApp('/u/maya');
    await flush();
    expect(app.getByText('0 followers')).toBeTruthy();
    expect(app.getByText('0 following')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Follow @maya'));
    await flush();
    expect(app.getByLabelText('Following @maya. Tap to unfollow.')).toBeTruthy();
    expect(app.getByText('1 follower')).toBeTruthy();
    expect(await s().followers(maya, 10)).toEqual([sam]);

    await fireEvent.press(app.getByLabelText('1 follower. Opens the list.'));
    await flush();
    expect(app.getByText('@maya')).toBeTruthy();
    expect(app.getByLabelText('Sam, @sam')).toBeTruthy();
    await fireEvent.press(app.getByRole('button', { name: 'Following' }));
    await flush();
    expect(app.getByText('@maya isn’t following anyone yet.')).toBeTruthy();

    // Unfollow from the profile.
    await act(async () => router.back());
    await flush();
    await fireEvent.press(app.getByLabelText('Following @maya. Tap to unfollow.'));
    await flush();
    expect(app.getByText('0 followers')).toBeTruthy();
    expect(await s().followers(maya, 10)).toEqual([]);
  });

  it('needs your own profile first', async () => {
    await mayaAndSam(false);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const app = await renderApp('/u/maya');
    await flush();
    await fireEvent.press(app.getByLabelText('Follow @maya'));
    expect(alert).toHaveBeenCalledWith('Create your profile first', expect.any(String), expect.any(Array));
    expect(mockSocial.follows.size).toBe(0);
  });

  it('Find people offers Follow beside each person', async () => {
    const { maya } = await mayaAndSam();
    const app = await renderApp('/people');
    await flush();
    await fireEvent.changeText(app.getByLabelText('Search people'), 'may');
    await settle(400);
    await flush();
    await fireEvent.press(app.getByLabelText('Follow @maya'));
    await flush();
    expect(await s().following((mockSocial.currentUser()!).uid, 10)).toEqual([maya]);
  });

  it('your Profile tab shows your counts', async () => {
    const { maya } = await mayaAndSam();
    await s().follow(maya);
    const app = await renderApp('/profile');
    await flush();
    expect(app.getByText('0 followers')).toBeTruthy();
    expect(app.getByText('1 following')).toBeTruthy();
  });

  it('blocking someone ends follows both ways', async () => {
    const { maya, sam } = await mayaAndSam();
    await s().follow(maya);
    await s().signIn('maya@example.com', 'password123');
    await s().follow(sam);
    await s().signIn('sam@example.com', 'password123');
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementationOnce((_o, cb) => cb(1));
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons?: AlertButton[]) => buttons?.find((b) => b.text === 'Block')?.onPress?.());
    const app = await renderApp('/u/maya');
    await flush();
    await fireEvent.press(app.getByLabelText('More: report or block'));
    await flush();
    expect(mockSocial.follows.size).toBe(0);
  });
});

describe('Following in Discover', () => {
  it('shows videos from the people you follow', async () => {
    const { maya } = await mayaAndSam();
    await s().follow(maya);
    const app = await renderApp('/?festival=following');
    await flush();
    expect(app.getByText('Following')).toBeTruthy();
    expect(app.getByText('Videos from people you follow')).toBeTruthy();
    expect(app.getByLabelText('Filmed by @maya. Opens their profile.')).toBeTruthy();
  });

  it('follows no one yet: says so, and offers Find people', async () => {
    await mayaAndSam();
    const app = await renderApp('/?festival=following');
    await flush();
    expect(app.getByText('No one yet')).toBeTruthy();
    await fireEvent.press(app.getByRole('button', { name: 'Find people' }));
    await flush();
    expect(app.getByLabelText('Search people')).toBeTruthy();
  });

  it('offered in What to discover, with how many you follow', async () => {
    const { maya } = await mayaAndSam();
    await s().follow(maya);
    const app = await renderApp('/');
    await flush();
    await go('/discover-focus');
    expect(app.getByLabelText('Following, Videos from the person you follow')).toBeTruthy();
  });

  it('unfollowing takes their videos out straight away', async () => {
    const { maya } = await mayaAndSam();
    await s().follow(maya);
    const app = await renderApp('/?festival=following');
    await flush();
    expect(app.getByLabelText('Filmed by @maya. Opens their profile.')).toBeTruthy();
    await go('/u/maya');
    await fireEvent.press(app.getByLabelText('Following @maya. Tap to unfollow.'));
    await flush();
    await act(async () => router.back());
    await flush();
    expect(app.queryByLabelText('Filmed by @maya. Opens their profile.')).toBeNull();
  });
});
