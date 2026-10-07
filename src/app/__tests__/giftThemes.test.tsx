import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetStandings } from '../../features/standing/useStanding';
import { readStoredTheme, writeStoredTheme } from '../../theme/storedTheme';
import { renderApp } from './appRoutes';

/**
 * Gift themes through the real routes: only @matt.raves can add one to a
 * sprout; a brand-new account that picks it up wears it as soon as its
 * profile is made, and one that already had a profile is told and offered it.
 */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));
const mockReload = jest.fn(async () => {});
jest.mock('../../lib/reload', () => ({ reloadApp: () => mockReload() }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i++) await settle();
};
const s = () => mockSocial.service;
const person = async (handle: string, name: string) => {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: name, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
};
const ID = 'abcdefghijkmnpqrstuv';
/** @matt.raves gives a sprout with Neon Daisy (straight to the backend) and signs out. */
const mattGives = async () => {
  const matt = await person('matt.raves', 'Matt');
  await s().giveSprout({ id: ID, kind: 'seedling', theme: 'daisy' });
  await s().signOut();
  return matt;
};
const routeOf = (uid: string) => `/sprout/${ID}?u=${uid}&h=matt.raves&k=seedling&n=Matt`;

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 3, 20, 0) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetStandings();
  mockReload.mockClear();
  writeStoredTheme('afterglow');
});

describe('gift themes', () => {
  it('only @matt.raves can add a theme to a sprout', async () => {
    await person('maya', 'Maya');
    const app = await renderApp('/give-sprout');
    await flush();
    expect(app.queryByText('Add a theme (only you can give these)')).toBeNull();
    // Nor can anyone else send one straight to Afterglow.
    await expect(s().giveSprout({ id: 'mayasproutaaaaaaaaaa', kind: 'seedling', theme: 'daisy' })).rejects.toThrow();
    app.unmount();

    await s().signOut();
    await person('matt.raves', 'Matt');
    const mine = await renderApp('/give-sprout');
    await flush();
    expect(mine.getByText('Add a theme (only you can give these)')).toBeTruthy();
    await fireEvent.press(mine.getByLabelText('Neon Daisy theme'));
    expect(mine.getByText(/Whoever picks it up gets Neon Daisy/)).toBeTruthy();
    await fireEvent.press(mine.getByText('Show the code'));
    await flush();
    expect(mine.getByText('With the Neon Daisy theme')).toBeTruthy();
    const [given] = [...mockSocial.sprouts.values()];
    expect(given).toMatchObject({ kind: 'seedling', theme: 'daisy' });
  });

  it('a new account that picks it up wears the theme, with its background, once its profile is made', async () => {
    const matt = await mattGives();
    const app = await renderApp(routeOf(matt));
    await flush();
    await fireEvent.press(app.getByText('Create a free account'));
    await flush();
    const sam = await person('sam', 'Sam');
    await flush(20);
    expect(mockSocial.sprouts.get(ID)?.to).toBe(sam);
    expect(mockSocial.themeGrants.has(`${sam}_daisy`)).toBe(true);
    // Nothing yet while the app hasn't seen the profile (made here straight on the backend): read it again.
    await act(async () => router.push('/profile'));
    await flush(30);
    expect(app.queryByText('A gift from @matt.raves')).toBeNull();
    await s().signOut();
    await flush();
    await s().signIn('sam@example.com', 'password123');
    await flush(40);
    // First the sprout itself, with the offer to follow whoever gave it; back on a tab, the theme.
    expect(app.getByText('Follow Matt?')).toBeTruthy();
    await act(async () => router.push('/profile'));
    await flush(40);
    expect(app.getByText('A gift from @matt.raves')).toBeTruthy();
    expect(app.getByText(/Neon Daisy came with your sprout.*Putting it on now/)).toBeTruthy();
    await settle(1900);
    await flush();
    expect(readStoredTheme()).toBe('daisy');
    expect(mockSocial.profiles.get(sam)?.backdrop).toBe('daisy');
    await settle(800);
    expect(mockReload).toHaveBeenCalled();
  }, 20000);

  it('an account that already had a profile is told and offered it, once', async () => {
    const matt = await mattGives();
    const sam = await person('sam', 'Sam');
    // Made a while ago.
    jest.setSystemTime(new Date(2026, 9, 3, 22, 0));
    const app = await renderApp(routeOf(matt));
    await flush();
    await fireEvent.press(app.getByText('Add to my garden'));
    await flush(20);
    expect(mockSocial.themeGrants.has(`${sam}_daisy`)).toBe(true);
    await act(async () => router.push('/profile'));
    await flush(30);
    expect(app.getByText('A gift from @matt.raves')).toBeTruthy();
    expect(app.getByText('Put on Neon Daisy')).toBeTruthy();
    await settle(3000);
    // Nothing goes on by itself.
    expect(readStoredTheme()).not.toBe('daisy');
    expect(mockReload).not.toHaveBeenCalled();
    await act(async () => router.push('/notifications'));
    await flush();
    expect(app.getByText('@matt.raves gave you a theme: Neon Daisy')).toBeTruthy();
    // Someone without it can't show its background.
    await expect(s().setBackdrop('daisy')).resolves.toMatchObject({ backdrop: 'daisy' });
    await s().signOut();
    await person('other', 'Other');
    await expect(s().setBackdrop('daisy')).rejects.toThrow();
  });
});
