import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { levelName } from '../../features/quests/daily';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetStandings } from '../../features/standing/useStanding';
import { forgetAccountGlow } from '../../state/accountGlow';
import { forgetBadgeClaims } from '../../state/badgeClaims';
import { forgetDailyQuests } from '../../state/dailyQuests';
import { forgetSecrets } from '../../state/secrets';
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

  it('a new phone at level 1 never removes the level an account already shows', async () => {
    const sam = await person('sam');
    mockSocial.levels.set(sam, 5);
    const set = jest.spyOn(mockSocial.service, 'setLevel');
    await renderApp('/profile-edit');
    await flush();
    await settle(3500);
    await flush();
    expect(mockSocial.levels.get(sam)).toBe(5);
    expect(set).not.toHaveBeenCalled();
  });

  it('never lowers the level an account shows; only the switch takes it off', async () => {
    const sam = await person('sam');
    mockSocial.levels.set(sam, 5);
    // Level 2 on this phone, lower than the 5 shown: left alone.
    await AsyncStorage.setItem('secrets.v1', JSON.stringify({ lightshow: 1, plur: 2 }));
    const app = await renderApp('/profile-edit');
    await flush();
    await settle(3500);
    await flush();
    expect(mockSocial.levels.get(sam)).toBe(5);
    await fireEvent(app.getByLabelText('Show my glow level'), 'valueChange', false);
    await flush();
    await settle(3500);
    await flush();
    expect(mockSocial.levels.has(sam)).toBe(false);
  });

  it('never puts your level on the support account', async () => {
    mockSocial.verified.add('afterglowmusic.support@gmail.com');
    const hq = await s().signUp('afterglowmusic.support@gmail.com', 'password123');
    await s().saveProfile({ handle: 'hqteam', displayName: 'HQ', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
    await AsyncStorage.setItem('secrets.v1', JSON.stringify({ lightshow: 1, plur: 2 }));
    const set = jest.spyOn(mockSocial.service, 'setLevel');
    await renderApp('/profile-edit');
    await flush();
    await settle(3500);
    await flush();
    expect(mockSocial.levels.has(hq.uid)).toBe(false);
    expect(set).not.toHaveBeenCalled();
  });

  it('Instagram, Snapchat and TikTok: added in Edit profile, shown as icons that open the account', async () => {
    await person('maya');
    // Opened once your profile has loaded, as in the app.
    const app = await renderApp('/settings');
    await flush();
    await act(async () => router.push('/profile-edit'));
    await flush();
    await fireEvent.changeText(app.getByLabelText('Instagram username'), 'https://www.instagram.com/Maya.Chen/');
    await fireEvent.changeText(app.getByLabelText('TikTok username'), '@m');
    await flush();
    expect(app.getByText('instagram.com/maya.chen')).toBeTruthy();
    expect(app.getByText(/^That doesn’t look like a TikTok username/)).toBeTruthy();
    await fireEvent.changeText(app.getByLabelText('TikTok username'), '@maya.dances');
    await fireEvent.press(app.getByText('Save'));
    await flush();
    expect(mockSocial.profiles.get(mockSocial.currentUser()!.uid)?.socials).toEqual({ instagram: 'maya.chen', tiktok: 'maya.dances' });
  });

  it('someone’s socials show as little icons on their profile', async () => {
    await person('maya');
    await s().saveProfile({ handle: 'maya', displayName: 'Maya', bio: '', showFestivals: false, showSound: false, socials: { instagram: 'maya.chen', snapchat: 'mayac' } }, { festivals: [], sounds: [] });
    await s().signOut();
    await person('sam');
    const { Linking } = jest.requireActual<typeof import('react-native')>('react-native');
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const app = await renderApp('/u/maya');
    await flush();
    expect(app.queryByLabelText(/TikTok/)).toBeNull();
    await fireEvent.press(app.getByLabelText('Maya on Instagram, @maya.chen. Opens Instagram.'));
    expect(open).toHaveBeenCalledWith('https://instagram.com/maya.chen');
    expect(app.getByLabelText('Maya on Snapchat, @mayac. Opens Snapchat.')).toBeTruthy();
  });

  it('Edit profile never shows a blank form when your profile couldn’t be read (saving it would replace yours)', async () => {
    await person('sam');
    const read = jest.spyOn(mockSocial.service, 'profileOf').mockRejectedValueOnce(new Error('No signal'));
    const app = await renderApp('/profile-edit');
    await flush();
    expect(app.getByText('Your profile couldn’t be loaded. Check the signal and try again.')).toBeTruthy();
    expect(app.queryByText('Create profile')).toBeNull();
    await fireEvent.press(app.getByLabelText('Try loading your profile again'));
    await flush();
    expect(app.getByText('Save')).toBeTruthy();
    expect(app.getByDisplayValue('sam')).toBeTruthy();
    read.mockRestore();
  });
});

describe('your level on Profile', () => {
  /** What the pill says after each step while Profile loads (undefined: no pill). */
  async function pillsWhileLoading(app: Awaited<ReturnType<typeof renderApp>>, rounds = 12) {
    const seen: (string | undefined)[] = [];
    for (let i = 0; i < rounds; i++) {
      await settle();
      seen.push(app.queryByTestId('profile-level') ? app.getByTestId('profile-level').props.accessibilityLabel : undefined);
    }
    return seen;
  }
  const shown = (seen: (string | undefined)[]) => [...new Set(seen.filter(Boolean))];

  it('never shows a stand-in while loading: the level your account shows is a floor', async () => {
    const sam = await person('sam');
    mockSocial.levels.set(sam, 5);
    // Level 2 on this phone, lower than the 5 the account shows elsewhere.
    await AsyncStorage.setItem('secrets.v1', JSON.stringify({ lightshow: 1, plur: 2 }));
    const app = await renderApp('/profile');
    const seen = await pillsWhileLoading(app);
    expect(shown(seen)).toEqual(['Glow level 5, Strobe. Opens your quests.']);
    await settle(3500);
    await flush();
    expect(mockSocial.levels.get(sam)).toBe(5);
  });

  it('stays the same across signing out and in, switching accounts and restarts, and never leaks to another account', async () => {
    const maya = await person('maya');
    await s().signOut();
    const sam = await person('sam');
    // Two secrets found while Sam is signed in: 100 glow, level 2.
    await AsyncStorage.setItem('secrets.v1', JSON.stringify({ lightshow: 1, plur: 2 }));
    let app = await renderApp('/profile');
    expect(shown(await pillsWhileLoading(app))).toEqual(['Glow level 2, Flicker. Opens your quests.']);
    await settle(3500);
    await flush();
    expect(mockSocial.levels.get(sam)).toBe(2);

    // Maya signs in on the same phone: Sam's glow isn't hers.
    await act(async () => {
      await s().signOut();
      await s().signIn('maya@example.com', 'password123');
    });
    expect(shown(await pillsWhileLoading(app))).toEqual(['Glow level 1, Spark. Opens your quests.']);
    await settle(3500);
    await flush();
    expect(mockSocial.levels.has(maya)).toBe(false);

    // Back to Sam: level 2 again, straight away.
    await act(async () => {
      await s().signOut();
      await s().signIn('sam@example.com', 'password123');
    });
    expect(shown(await pillsWhileLoading(app))).toEqual(['Glow level 2, Flicker. Opens your quests.']);

    // The app starts again (stores read again from the phone): still level 2.
    await app.unmount();
    forgetDailyQuests();
    forgetSecrets();
    forgetBadgeClaims();
    forgetAccountGlow();
    forgetStandings();
    app = await renderApp('/profile');
    expect(shown(await pillsWhileLoading(app))).toEqual(['Glow level 2, Flicker. Opens your quests.']);
    expect(mockSocial.levels.get(sam)).toBe(2);
    expect(mockSocial.levels.has(maya)).toBe(false);
  });
});
