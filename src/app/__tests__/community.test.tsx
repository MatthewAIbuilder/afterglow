import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ActionSheetIOS, Alert, type AlertButton } from 'react-native';
import { NEAR_LOAD_DELAY_MS } from '../../features/discover/ClipPlayer';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetStandings } from '../../features/standing/useStanding';
import { renderApp } from './appRoutes';

/**
 * Community clips in Discover through the real routes: a video someone
 * shared from Cyclops Cove 4 shows in its feed (a festival with no official
 * clips yet), credited to them, and goes away when reported, hidden, blocked
 * or switched off. The social backend is the in-memory one.
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

/** Maya shares a video of HEDEX at Cyclops Cove 4 (no official clips of them, so it comes early); then you sign in (or stay out). */
async function mayaShares(viewer: 'signed-in' | 'signed-out' = 'signed-in', level?: number) {
  const s = mockSocial.service;
  await s.signUp('maya@example.com', 'password123');
  await s.saveProfile({ handle: 'maya', displayName: 'Maya', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  await s.shareMemory({ memoryId: 'm1', videoUri: 'file:///m1.mov', thumbUri: 'file:///m1.jpg', festivalId: 'cyclops-cove-4', night: 'Friday', artistId: 'hedex', capturedAt: '2026-12-04T22:30:00.000Z', durationSec: 42, width: 1080, height: 1920 });
  if (level) await s.setLevel(level);
  await s.signOut();
  if (viewer === 'signed-in') await s.signUp('sam@example.com', 'password123');
}

const CREDIT = 'Filmed by @maya. Opens their profile.';
/**
 * Open Discover on Cyclops Cove 4. Shared videos arrive after the feed has
 * started, and the clip on screen and the next one stay put (tests only
 * render the top of the feed), so switch away and back: the feed starts
 * over with them in it.
 */
async function openFeed() {
  const app = await renderApp('/?festival=cyclops-cove-4');
  await flush();
  await act(async () => router.setParams({ festival: 'solstice-26' }));
  await flush();
  await act(async () => router.setParams({ festival: 'cyclops-cove-4' }));
  await flush();
  return app;
}
const openMenu = async (app: Awaited<ReturnType<typeof renderApp>>, choose: number) => {
  jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementationOnce((_o, cb) => cb(choose));
  await fireEvent.press(app.getByLabelText('More: report, hide or block @maya'));
  await flush();
};

beforeEach(async () => {
  // Standings are kept a while: each test reads Maya's afresh.
  forgetStandings();
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('community clips in Discover', () => {
  it('shows a shared video from the lineup, credited to who filmed it, with no Save', async () => {
    await mayaShares();
    const app = await openFeed();
    expect(app.getByLabelText(CREDIT)).toBeTruthy();
    expect(app.getByText('From the crowd')).toBeTruthy();
    // The clip next to the one on screen loads its player once a swipe would have settled.
    await settle(NEAR_LOAD_DELAY_MS);
    expect(app.getByTestId('video-view')).toBeTruthy();
    // Every clip can be liked; community clips can't be saved (they aren't Afterglow's to keep).
    expect(app.queryAllByLabelText('Save')).toHaveLength(app.getAllByLabelText('Like').length - 1);
  });

  it('the credit opens their profile', async () => {
    await mayaShares();
    const app = await openFeed();
    await fireEvent.press(app.getByLabelText(CREDIT));
    await flush();
    expect(app.getByText('@maya')).toBeTruthy();
  });

  it('who filmed it is their photo on the rail, with their glow level, not an @ line', async () => {
    await mayaShares('signed-in', 7);
    const app = await openFeed();
    expect(app.getByTestId('filmer-face')).toBeTruthy();
    expect(app.queryByText('Filmed by @maya')).toBeNull();
    expect(app.getByText('7')).toBeTruthy();
    expect(app.getByLabelText(`${CREDIT} Glow level 7`)).toBeTruthy();
  });

  it('every clip shows where the artist plays next as a ticket to the festival', async () => {
    const app = await renderApp('/?festival=solstice-26');
    await flush();
    // The clip on screen (a YouTube set) and the next one both carry it.
    expect(app.getAllByLabelText(/^Playing Solstice 2026, .+\. Opens the festival\.$/).length).toBe(app.getAllByTestId('clip-ticket').length);
    expect(app.getAllByTestId('clip-ticket').length).toBeGreaterThan(1);
  });

  it('the first Not for me says it counts, once', async () => {
    await mayaShares();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const app = await openFeed();
    await fireEvent.press(app.getAllByLabelText('Not for me')[0]);
    await flush();
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toBe('Noted, less like this');
    await fireEvent.press(app.getAllByLabelText('Not for me')[0]);
    await flush();
    expect(alert).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem('notForMeTip.v1')).toBe('1');
  });

  it('none when you’re signed out', async () => {
    await mayaShares('signed-out');
    const app = await openFeed();
    expect(app.queryByLabelText(CREDIT)).toBeNull();
  });

  it('report: sent, and hidden for you straight away', async () => {
    await mayaShares();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const app = await openFeed();
    // Report this video, then the first reason.
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementationOnce((_o, cb) => cb(0)).mockImplementationOnce((_o, cb) => cb(0));
    await fireEvent.press(app.getByLabelText('More: report, hide or block @maya'));
    await flush();
    expect(mockSocial.reports).toHaveLength(1);
    expect(mockSocial.reports[0].target).toMatchObject({ kind: 'memory', ownerUid: 'uid-1' });
    expect(app.queryByLabelText(CREDIT)).toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem('community.v1')) ?? '{}').hidden).toHaveLength(1);
  });

  it('hide: gone, and stays gone', async () => {
    await mayaShares();
    const app = await openFeed();
    await openMenu(app, 1);
    expect(app.queryByLabelText(CREDIT)).toBeNull();
    expect(mockSocial.reports).toHaveLength(0);
  });

  it('block: asks first, then nothing from them', async () => {
    await mayaShares();
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons?: AlertButton[]) => buttons?.find((b) => b.text === 'Block')?.onPress?.());
    const app = await openFeed();
    await openMenu(app, 2);
    expect(mockSocial.blocks.get(mockSocial.currentUser()!.uid)).toEqual(['uid-1']);
    expect(app.queryByLabelText(CREDIT)).toBeNull();
  });

  it('switched off in What to discover: only official clips', async () => {
    await mayaShares();
    const app = await openFeed();
    expect(app.getByLabelText(CREDIT)).toBeTruthy();
    await act(async () => router.push('/discover-focus?current=cyclops-cove-4' as never));
    await flush();
    expect(app.getByText('Videos from the crowd')).toBeTruthy();
    await fireEvent(app.getByTestId('community-switch'), 'valueChange', false);
    await flush();
    expect(app.getByText('Only official clips.')).toBeTruthy();
    await act(async () => router.back());
    await flush();
    expect(app.queryByLabelText(CREDIT)).toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem('community.v1')) ?? '{}').enabled).toBe(false);
  });

  it('a like counts for the artist and is remembered after the clip has gone', async () => {
    await mayaShares();
    const app = await openFeed();
    for (const like of app.getAllByLabelText('Like')) await fireEvent.press(like);
    await flush();
    const reactions = JSON.parse((await AsyncStorage.getItem('reactions.v1')) ?? '{}');
    const id = Object.keys(reactions).find((k) => k.startsWith('community:'));
    expect(id).toBeDefined();
    expect(JSON.parse((await AsyncStorage.getItem('community.v1')) ?? '{}').artistOf[id!]).toBe('hedex');
    // Their page says what the match rests on, counting the like on the shared video.
    await act(async () => router.push('/artist/hedex' as never));
    await flush();
    expect(app.getByText('From your 1 like')).toBeTruthy();
  });

  it('a liked video waits in Your clips and plays from there', async () => {
    await mayaShares();
    const app = await openFeed();
    for (const like of app.getAllByLabelText('Like')) await fireEvent.press(like);
    await flush();
    const id = Object.keys(JSON.parse((await AsyncStorage.getItem('community.v1')) ?? '{}').kept ?? {})[0];
    expect(id).toMatch(/^community:/);
    // Somewhere else, so the feed starts over without it; then Your clips.
    await act(async () => router.setParams({ festival: 'solstice-26' }));
    await flush();
    expect(app.queryByLabelText(CREDIT)).toBeNull();
    await act(async () => router.push('/saved' as never));
    await flush();
    expect(app.getByText('From the crowd · @maya')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Play HEDEX, From the crowd'));
    await flush();
    expect(app.getByLabelText(CREDIT)).toBeTruthy();
    expect(app.getByText('Cyclops Cove 4')).toBeTruthy();
    // Back in the Discover that was already open, not a second copy stacked on top.
    expect(router.canGoBack()).toBe(false);
  });

  it('hiding a video takes it out of Your clips too', async () => {
    await mayaShares();
    const app = await openFeed();
    for (const like of app.getAllByLabelText('Like')) await fireEvent.press(like);
    await flush();
    await openMenu(app, 1);
    await act(async () => router.push('/saved' as never));
    await flush();
    expect(app.queryByText('From the crowd · @maya')).toBeNull();
  });
});
