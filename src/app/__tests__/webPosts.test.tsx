import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ActionSheetIOS, Alert, type AlertButton } from 'react-native';
import type { PickResult } from '../../features/memories/device';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/**
 * Posting from the website: the memories module is the website's (videos
 * kept only while the page is open, a chooser that hands over a link to the
 * file), so choosing a video, tagging it and tapping Share uploads it as a
 * shared video, the way the phone does, and Memories and Profile show what
 * you shared from the server. Nothing is saved on the device.
 */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));
jest.mock('../../features/memories/device', () => {
  const web = jest.requireActual<typeof import('../../features/memories/device.web')>('../../features/memories/device.web');
  return { ...web, pickVideo: jest.fn() };
});
const device = jest.requireMock<{ pickVideo: jest.Mock<(s: 'camera' | 'library') => Promise<PickResult>> }>('../../features/memories/device');

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

/** An upright iPhone video chosen in Safari: Saturday night at Cyclops Cove 4. */
function chooseInBrowser() {
  jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementationOnce((_o, cb) => cb(1));
  device.pickVideo.mockResolvedValueOnce({
    ok: true,
    video: {
      uri: 'blob:https://afterglowmusic.app/5f1c',
      source: 'library',
      durationSec: 24,
      width: 1080,
      height: 1920,
      moment: { when: new Date(2026, 11, 5, 22, 30), place: { city: 'Boca Raton', region: 'Florida' } },
      keptBySharing: true,
    },
  });
}

async function openTagging() {
  chooseInBrowser();
  const app = await renderApp('/');
  await flush();
  await go('/memories');
  expect(app.getByText('Videos you share from the website show here once shared.')).toBeTruthy();
  // On the website this opens the "Post a video" page, whose button opens the browser's chooser; here (the
  // test runs as a phone) the action sheet stands in for that page and the chooser is the mocked `pickVideo`.
  await fireEvent.press(app.getByText('Post a video'));
  await flush();
  return app;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  await mockSocial.service.signUp('sam@example.com', 'password123');
  await mockSocial.service.saveProfile({ handle: 'sam', displayName: 'Sam', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('posting a video from the website', () => {
  it('tag it, tap Share: it uploads like the phone’s, and Memories and Profile show it from the server', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const app = await openTagging();
    expect(app.getByTestId('web-keeps-by-sharing')).toBeTruthy();
    expect(app.getByText('Share')).toBeTruthy();
    // Not tagged yet: Share says what's missing and keeps nothing.
    await fireEvent.press(app.getByLabelText('Share this video'));
    expect(alert).toHaveBeenCalledWith('Share it to keep it', 'Pick the festival and who was playing to share it to Discover. On the website, videos are kept by sharing them.', expect.anything());
    expect(await mockSocial.service.recentMemories(10)).toEqual([]);

    await fireEvent.press(app.getByLabelText(/^SUBTRONICS, Playing Saturday/));
    const toggle = app.getByTestId('share-to-discover');
    expect(toggle.props.value).toBe(true);
    // Always on here: there's nowhere else to keep it.
    expect(toggle.props.disabled).toBe(true);
    await fireEvent.press(app.getByLabelText('Share this video'));
    await flush();

    const shared = await mockSocial.service.festivalMemories('cyclops-cove-4', 10);
    expect(shared).toHaveLength(1);
    expect(shared[0]).toMatchObject({ handle: 'sam', artistId: 'subtronics', night: 'Saturday', durationSec: 24, width: 1080, height: 1920 });
    expect(alert).not.toHaveBeenCalledWith('Couldn’t share it to Discover', expect.anything());
    // Nothing kept on the device: the website's memories last only while the page is open.
    expect(await AsyncStorage.getItem('memories.v1')).toBeNull();

    // It lands on Memories, which now shows the shared video (opening it plays the shared copy).
    expect(app.getByText(/shared to Discover\.$/)).toBeTruthy();
    const tiles = app.getAllByLabelText(/^Memory: /);
    expect(tiles).toHaveLength(1);
    await fireEvent.press(tiles[0]);
    await flush();
    expect(app.getByText('Remove from profile')).toBeTruthy();

    // Profile → Moments: the same video.
    await act(async () => router.navigate('/profile'));
    await flush();
    expect(app.getAllByLabelText(/^Video: .*, shared$/)).toHaveLength(1);
  }, 30_000);

  it('signed out, Share offers to sign in and uploads nothing', async () => {
    await mockSocial.service.signOut();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons?: AlertButton[]) => {
      buttons?.find((b) => b.text === 'Sign in')?.onPress?.();
    });
    const app = await openTagging();
    await fireEvent.press(app.getByLabelText(/^SUBTRONICS, Playing Saturday/));
    await fireEvent.press(app.getByLabelText('Share this video'));
    await flush();
    expect(alert).toHaveBeenCalledWith('Share it to keep it', 'Sign in to share your videos to Discover. On the website, videos are kept by sharing them.', expect.anything());
    expect(await mockSocial.service.recentMemories(10)).toEqual([]);
    expect(app.getAllByText(/Sign in/).length).toBeGreaterThan(0);
  });
});
