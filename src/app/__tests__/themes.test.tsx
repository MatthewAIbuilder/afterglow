import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetStandings } from '../../features/standing/useStanding';
import { readStoredTheme } from '../../theme/storedTheme';
import { renderApp } from './appRoutes';

/**
 * App themes through the real routes: previewing, putting on a free one
 * (it's saved for the next start and Afterglow starts again), Plus ones
 * locked without Plus, matching the profile background, and the Settings row.
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
const flush = async () => {
  for (let i = 0; i < 10; i++) await settle();
};
const s = () => mockSocial.service;
async function person(handle: string) {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: 'Sam', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetStandings();
  mockReload.mockClear();
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('app themes', () => {
  it('put on a free theme: it is saved and Afterglow starts again in it', async () => {
    const app = await renderApp('/themes');
    await flush();
    expect(app.getByText('App theme')).toBeTruthy();
    expect(app.getByText('This is your theme')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Aurora. Free'));
    expect(app.getByLabelText('Preview of Aurora: Northern-lights green on a deep blue night')).toBeTruthy();
    await fireEvent.press(app.getByText('Put on Aurora'));
    expect(readStoredTheme()).toBe('aurora');
    expect(app.getByText('Putting on Aurora…')).toBeTruthy();
    await settle(800);
    expect(mockReload).toHaveBeenCalled();
  });

  it('Plus themes can be previewed but need Plus', async () => {
    await person('sam');
    const app = await renderApp('/themes');
    await flush();
    await fireEvent.press(app.getByLabelText('Lava. Plus'));
    expect(app.getByText('Comes with Plus')).toBeTruthy();
    expect(app.getByText('Part of Afterglow Plus. Preview it as much as you like.')).toBeTruthy();
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('with Plus, a theme can match the profile background too', async () => {
    const uid = await person('sam');
    mockSocial.plus.add(uid);
    const app = await renderApp('/themes');
    await flush();
    await fireEvent.press(app.getByLabelText('Lava. Plus'));
    expect(app.getByLabelText('Match my profile background')).toBeTruthy();
    await fireEvent.press(app.getByText('Put on Lava'));
    await flush();
    expect(readStoredTheme()).toBe('lava');
    expect(mockSocial.profiles.get(uid)?.backdrop).toBe('lava');
  });

  it('Settings has the app theme and profile background', async () => {
    await person('sam');
    const app = await renderApp('/settings');
    await flush();
    expect(app.getByText('App theme')).toBeTruthy();
    expect(app.getByText('Profile background')).toBeTruthy();
    await fireEvent.press(app.getByText('App theme'));
    await flush();
    expect(app.getByText('Change the colours of the whole app: the sky, the glow, buttons and the tab bar. Afterglow starts again in the new look.')).toBeTruthy();
  });
});
