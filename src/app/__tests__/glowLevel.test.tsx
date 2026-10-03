import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { levelName } from '../../features/quests/daily';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetStandings } from '../../features/standing/useStanding';
import { renderApp } from './appRoutes';

/**
 * Glow levels on profiles: yours is sent once it's level 2 or more, others
 * see it on your profile, and Edit profile's switch takes it off.
 */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 8) => {
  for (let i = 0; i < rounds; i++) await settle();
};
const s = () => mockSocial.service;
async function person(handle: string) {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: handle === 'maya' ? 'Maya' : 'Sam', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetStandings();
});

describe('glow levels on profiles', () => {
  it('names levels from their number', () => {
    expect(levelName(1)).toBe('Spark');
    expect(levelName(4)).toBe('Neon');
    expect(levelName(11)).toBe('Afterglow');
    expect(levelName(13)).toBe('Afterglow 3');
  });

  it('shows someone else’s level on their profile, but not level 1', async () => {
    const maya = await person('maya');
    await s().setLevel(4);
    await s().signOut();
    const sam = await person('sam');
    mockSocial.levels.set(sam, 1);
    const app = await renderApp('/u/maya');
    await flush();
    expect(maya).toBeTruthy();
    expect(app.getByLabelText('Glow level 4, Neon')).toBeTruthy();
    expect(app.getByText('Level 4 · Neon')).toBeTruthy();
  });

  it('sends your level once it’s 2 or more, and the switch takes it off', async () => {
    const sam = await person('sam');
    // Two secrets found: 100 glow, level 2 (Flicker).
    await AsyncStorage.setItem('secrets.v1', JSON.stringify({ lightshow: 1, plur: 2 }));
    const app = await renderApp('/profile-edit');
    await flush();
    await settle(3500);
    await flush();
    expect(mockSocial.levels.get(sam)).toBe(2);
    expect(app.getByText('Level 2 · Flicker')).toBeTruthy();
    await fireEvent(app.getByLabelText('Show my glow level'), 'valueChange', false);
    await flush();
    await settle(3500);
    await flush();
    expect(mockSocial.levels.has(sam)).toBe(false);
    expect(await AsyncStorage.getItem('showLevel.v1')).toBe('0');
  });
});
