import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetStandings } from '../../features/standing/useStanding';
import { renderApp } from './appRoutes';

/**
 * Profile backgrounds and favourite artists through the real routes, with
 * the in-memory backend: choosing a background, Plus ones locked without
 * Plus, and someone else's profile showing their background and their
 * favourite artists round their photo.
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
const s = () => mockSocial.service;
async function person(handle: string, name: string) {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: name, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetStandings();
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('profile backgrounds', () => {
  it('choose a free background; it shows on your profile', async () => {
    await person('sam', 'Sam');
    const app = await renderApp('/backdrop');
    await flush();
    expect(app.getByText('Profile background')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Aurora. Free'));
    await fireEvent.press(app.getByText('Use Aurora'));
    await flush();
    expect(mockSocial.profiles.get(mockSocial.currentUser()!.uid)?.backdrop).toBe('aurora');
  });

  it('Plus backgrounds can be previewed but need Plus to use', async () => {
    const uid = await person('sam', 'Sam');
    const app = await renderApp('/backdrop');
    await flush();
    await fireEvent.press(app.getByLabelText('Laser show. Plus'));
    expect(app.getByText('Comes with Plus')).toBeTruthy();
    expect(mockSocial.profiles.get(uid)?.backdrop).toBeUndefined();
  });

  it('with Plus, a Plus background is yours', async () => {
    const uid = await person('sam', 'Sam');
    mockSocial.plus.add(uid);
    const app = await renderApp('/backdrop');
    await flush();
    await fireEvent.press(app.getByLabelText('Laser show. Plus'));
    await fireEvent.press(app.getByText('Use Laser show'));
    await flush();
    expect(mockSocial.profiles.get(uid)?.backdrop).toBe('lasers');
  });

  it('someone’s profile shows their background and their favourite artists round their photo', async () => {
    await person('maya', 'Maya');
    await s().setBackdrop('nebula');
    await s().saveProfile({ handle: 'maya', displayName: 'Maya', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [], artists: ['subtronics', 'levity'] });
    await s().signOut();
    await person('sam', 'Sam');
    const app = await renderApp('/u/maya');
    await flush();
    expect(app.getByTestId('backdrop-nebula', { includeHiddenElements: true })).toBeTruthy();
    expect(app.getByLabelText('Maya’s sound universe: SUBTRONICS, LEVITY.')).toBeTruthy();
  });

  it('your profile swaps between your cover photo and background in one tap, and back', async () => {
    const uid = await person('sam', 'Sam');
    await s().setCover('file:///cover.jpg');
    await s().setBackdrop('aurora');
    const app = await renderApp('/profile');
    await flush();
    await fireEvent.press(app.getByLabelText('Show your cover photo instead'));
    await flush();
    expect(mockSocial.profiles.get(uid)?.backdrop).toBeUndefined();
    await fireEvent.press(app.getByLabelText('Show Aurora instead'));
    await flush();
    expect(mockSocial.profiles.get(uid)?.backdrop).toBe('aurora');
  });

  it('your own profile says which festivals you’re going to, and when only you can see it', async () => {
    const uid = await person('sam', 'Sam');
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
    const app = await renderApp('/profile');
    await flush();
    // person() saves showFestivals: false, so others don't see it.
    expect(app.getByText('Going to Cyclops Cove 4 · only you can see this')).toBeTruthy();
    await s().saveProfile({ handle: 'sam', displayName: 'Sam', bio: '', showFestivals: true, showSound: false }, { festivals: ['cyclops-cove-4'], sounds: [] });
    expect(uid).toBeTruthy();
  });

  it('no swap without a cover photo', async () => {
    await person('sam', 'Sam');
    await s().setBackdrop('aurora');
    const app = await renderApp('/profile');
    await flush();
    expect(app.queryByLabelText('Show your cover photo instead')).toBeNull();
  });

  it('favourite artists stay hidden when switched off', async () => {
    await person('maya', 'Maya');
    await s().saveProfile({ handle: 'maya', displayName: 'Maya', bio: '', showFestivals: false, showSound: false, showArtists: false }, { festivals: [], sounds: [], artists: ['subtronics'] });
    await s().signOut();
    await person('sam', 'Sam');
    const app = await renderApp('/u/maya');
    await flush();
    expect(app.queryByLabelText(/sound universe: SUBTRONICS/)).toBeNull();
  });

  it('your favourite artists are published by themselves', async () => {
    const uid = await person('sam', 'Sam');
    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ subtronics: 'love' }));
    await renderApp('/');
    await flush();
    await settle(3500);
    await flush();
    expect(mockSocial.profiles.get(uid)?.artists).toContain('subtronics');
  });
});
