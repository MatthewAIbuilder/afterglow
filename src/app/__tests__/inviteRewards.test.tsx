import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/**
 * Invite rewards, through the real routes: Sam opens Maya's invite link
 * before they have a profile; once they make one, the invite is recorded and
 * they're friends; Maya sees her friend count and progress, and Sam gets the
 * "Came with @maya" badge.
 */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 16) => {
  for (let i = 0; i < rounds; i++) await settle();
};
const s = () => mockSocial.service;
const profile = (handle: string, displayName: string) => ({ handle, displayName, bio: '', showFestivals: false, showSound: false });
const CODE = 'abcdefgh2345';

let maya = '';
beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  maya = (await s().signUp('maya@example.com', 'maya-pass')).uid;
  await s().saveProfile(profile('maya', 'Maya'), { festivals: [], sounds: [] });
  await s().setFriendCode(CODE);
  await s().signOut();
});

describe('invite rewards', () => {
  it('counts a friend who joins from your link, makes you friends, and shows your progress', async () => {
    const app = await renderApp(`/add/maya?u=${maya}&c=${CODE}&n=Maya`);
    await flush();
    expect(app.getByText('Maya invited you to Afterglow. Make your profile and you’ll be friends straight away.')).toBeTruthy();
    expect(await AsyncStorage.getItem('pendingInvite.v1')).toContain(maya);

    // Sam joins and makes his profile.
    let sam = '';
    await act(async () => {
      sam = (await s().signUp('sam@example.com', 'sam-pass')).uid;
      await s().saveProfile(profile('sam', 'Sam'), { festivals: [], sounds: [] });
      // The app reads the new profile when he next signs in.
      await s().signOut();
      await s().signIn('sam@example.com', 'sam-pass');
    });
    await flush(200);
    await act(async () => router.navigate('/together'));
    await flush(30);
    expect(mockSocial.invites.get(sam)?.by).toBe(maya);
    expect(await AsyncStorage.getItem('pendingInvite.v1')).toBeNull();
    // Friends both ways, from the same link.
    expect(mockSocial.follows.has(`${sam}>${maya}`) && mockSocial.follows.has(`${maya}>${sam}`)).toBe(true);
    // Once ever: a second claim changes nothing.
    await s().claimInvite(maya);
    expect([...mockSocial.invites.values()].filter((v) => v.by === maya)).toHaveLength(1);
    await app.unmount();

    // Maya sees it.
    await s().signOut();
    await s().signIn('maya@example.com', 'maya-pass');
    const mine = await renderApp('/together');
    await flush(30);
    expect(mine.getByText('1 friend joined')).toBeTruthy();
    expect(mine.getByText('9 more for a month of Afterglow Plus')).toBeTruthy();
    await mine.unmount();
  });

  it('never counts someone who already had a profile, or your own link', async () => {
    const sam = (await s().signUp('sam@example.com', 'sam-pass')).uid;
    await s().saveProfile(profile('sam', 'Sam'), { festivals: [], sounds: [] });
    // Sam's profile is from before the link was opened: an old account, so the link only makes friends.
    jest.advanceTimersByTime(3 * 3600_000);
    await AsyncStorage.setItem('pendingInvite.v1', JSON.stringify({ card: { uid: maya, handle: 'maya', code: CODE, name: 'Maya' }, at: Date.now() }));
    const app = await renderApp('/together');
    await flush(30);
    expect(mockSocial.invites.has(sam)).toBe(false);
    await app.unmount();
    // Your own link never counts (the service refuses it too).
    await expect(s().claimInvite(sam)).rejects.toBeTruthy();
  });
});
