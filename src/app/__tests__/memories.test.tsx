import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Asset } from 'expo-media-library';
import { ActionSheetIOS, Alert, type AlertButton } from 'react-native';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { State } from 'react-native-gesture-handler';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { router } from 'expo-router';
import { renderApp } from './appRoutes';

/**
 * Memories and profiles through the real routes and providers: press and
 * hold in Discover, tag with the guess, find it in Memories, share it to a
 * profile, and everything around it (report, block, delete). The phone's
 * picker, files and location are stand-ins, and the social backend is the
 * in-memory one: nothing reaches Firebase.
 */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const files = (jest.requireMock('expo-file-system') as { __files: Map<string, string> }).__files;
const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 6; i++) await settle();
};
/** Move to another screen in the same app, the way a tap would. */
async function go(href: string) {
  await act(async () => router.push(href as never));
  await flush();
}

/** Saturday night at Cyclops Cove 4 in Boca Raton, 10:30 PM on the phone's clock. */
const CYCLOPS_SATURDAY = new Date(2026, 11, 5, 22, 30).getTime();

function pickFromLibrary(when = CYCLOPS_SATURDAY, city = 'Boca Raton') {
  jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementationOnce((_o, cb) => cb(1));
  (ImagePicker.launchImageLibraryAsync as jest.Mock<typeof ImagePicker.launchImageLibraryAsync>).mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///cache/ImagePicker/ABC.MOV', duration: 42_000, width: 1080, height: 1920, assetId: 'ASSET-1', type: 'video' }],
  } as ImagePicker.ImagePickerResult);
  (Asset as unknown as jest.Mock).mockImplementation(() => ({
    getCreationTime: async () => when,
    getLocation: async () => ({ latitude: 26.35, longitude: -80.08 }),
  }));
  (Location.reverseGeocodeAsync as jest.Mock<typeof Location.reverseGeocodeAsync>).mockResolvedValueOnce([{ city, region: 'Florida' } as Location.LocationGeocodedAddress]);
}

/** Press and hold around the first clip in Discover. */
function holdClip(id = 'c1') {
  fireGestureHandler(getByGestureTestId(`hold-${id}`), [{ state: State.BEGAN }, { state: State.ACTIVE }, { state: State.END }]);
}

/** Alerts answer themselves with the button of this label. */
function answerAlerts(choose: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons?: AlertButton[]) => {
    buttons?.find((b) => b.text === choose)?.onPress?.();
  });
}

const saved = async () => JSON.parse((await AsyncStorage.getItem('memories.v1')) ?? '[]');

async function storeMemory(over: Record<string, unknown> = {}) {
  files.set('file:///docs/memories/mtest1.mov', 'video');
  files.set('file:///docs/memories/mtest1.jpg', 'still');
  await AsyncStorage.setItem(
    'memories.v1',
    JSON.stringify([
      { id: 'mtest1', file: 'mtest1.mov', thumb: 'mtest1.jpg', capturedAt: new Date(CYCLOPS_SATURDAY).toISOString(), addedAt: new Date(CYCLOPS_SATURDAY).toISOString(), durationSec: 42, festivalId: 'cyclops-cove-4', night: 'Saturday', artistId: 'subtronics', ...over },
    ]),
  );
}

/** An account with a profile, signed in (or out) before the app opens. */
async function withProfile(handle = 'maya', signedIn = true) {
  await mockSocial.service.signUp(`${handle}@example.com`, 'password123');
  await mockSocial.service.saveProfile({ handle, displayName: handle === 'maya' ? 'Maya' : handle, bio: 'Rail rider.', showFestivals: true, showSound: false }, { festivals: [], sounds: [] });
  if (!signedIn) await mockSocial.service.signOut();
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  files.clear();
  mockSocial = fakeSocial();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('adding a memory from Discover', () => {
  it('press and hold, choose a video, and the sheet opens on the guess; saving files it under the festival and night', async () => {
    pickFromLibrary();
    const app = await renderApp('/');
    await flush();
    await act(async () => holdClip());
    await flush();
    expect(app.getByText('New memory')).toBeTruthy();
    expect(app.getByText('Sat, Dec 5 · 10:30 PM · Boca Raton')).toBeTruthy();
    // Date and city agree: Cyclops Cove 4, Saturday, already chosen.
    expect(app.getByRole('button', { name: 'Cyclops Cove 4', selected: true })).toBeTruthy();
    expect(app.getByRole('button', { name: 'Saturday', selected: true })).toBeTruthy();
    // No set times yet, so nobody is picked for you; that night's lineup is offered, SUBTRONICS among the first.
    await fireEvent.press(app.getByLabelText(/^SUBTRONICS, Playing Saturday/));
    await fireEvent.press(app.getByLabelText('Save to Memories'));
    await flush();
    const [m] = await saved();
    expect(m).toMatchObject({ festivalId: 'cyclops-cove-4', night: 'Saturday', artistId: 'subtronics', durationSec: 42, place: { city: 'Boca Raton', region: 'Florida' } });
    expect(m.file).toMatch(/\.mov$/);
    expect(files.has(`file:///docs/memories/${m.file}`)).toBe(true);
    // Learned: the hold tip won't show again.
    expect(JSON.parse((await AsyncStorage.getItem('hints.v1')) ?? '[]')).toContain('hold');
  });

  it('a video from somewhere else: nothing is guessed, and it can be saved untagged', async () => {
    pickFromLibrary(new Date(2026, 6, 4, 21, 0).getTime(), 'Chicago');
    const app = await renderApp('/');
    await flush();
    await act(async () => holdClip());
    await flush();
    expect(app.getByRole('button', { name: 'Not at a festival or show', selected: true })).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Save to Memories'));
    await flush();
    const [m] = await saved();
    expect(m.festivalId).toBeUndefined();
    expect(m.artistId).toBeUndefined();
  });

  /** Record a video from Discover (hold the button for a couple of seconds), then Cancel on the tagging sheet. */
  async function recordThenCancel() {
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementationOnce((_o, cb) => cb(0));
    const app = await renderApp('/');
    await flush();
    await act(async () => holdClip());
    await flush();
    const record = app.getByLabelText('Record a video');
    await fireEvent(record, 'pressIn');
    await settle(2000);
    await fireEvent(app.getByLabelText('Stop recording'), 'pressOut');
    await flush();
    await fireEvent.press(app.getByLabelText('Cancel'));
    await flush();
    return app;
  }

  it('a video you just recorded is saved to Photos too, and cancelling asks whether to keep it', async () => {
    const create = MediaLibrary.Asset.create as unknown as jest.Mock;
    create.mockClear();
    const alert = answerAlerts('Keep in Memories');
    await recordThenCancel();
    expect(alert).toHaveBeenCalledWith('Keep this video?', expect.any(String), expect.any(Array));
    // Kept, untagged, to finish later.
    const kept = await saved();
    expect(kept).toHaveLength(1);
    expect(kept[0].festivalId).toBeUndefined();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('a video you just filmed can be trimmed before you save or share it', async () => {
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementationOnce((_o, cb) => cb(0));
    const app = await renderApp('/');
    await flush();
    await act(async () => holdClip());
    await flush();
    await fireEvent(app.getByLabelText('Record a video'), 'pressIn');
    await settle(7000);
    await fireEvent(app.getByLabelText('Stop recording'), 'pressOut');
    await flush();
    expect(app.getByText('Trim (optional)')).toBeTruthy();
    expect(app.getByLabelText('The part that plays')).toBeTruthy();
  });

  it('or deletes it, when you say so', async () => {
    answerAlerts('Delete video');
    await recordThenCancel();
    expect(await saved()).toEqual([]);
  });

  it('a video that’s too long says so and opens nothing', async () => {
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementationOnce((_o, cb) => cb(1));
    (ImagePicker.launchImageLibraryAsync as jest.Mock<typeof ImagePicker.launchImageLibraryAsync>).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///cache/long.mp4', duration: 600_000, width: 1080, height: 1920, type: 'video' }],
    } as ImagePicker.ImagePickerResult);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const app = await renderApp('/');
    await flush();
    await act(async () => holdClip());
    await flush();
    expect(alert).toHaveBeenCalledWith('That video is too long', 'Choose a clip of a minute or less.');
    expect(app.queryByText('New memory')).toBeNull();
  });
});

describe('Memories', () => {
  it('empty: explains how to add one', async () => {
    const app = await renderApp('/memories');
    await flush();
    expect(app.getByText('Keep the moments')).toBeTruthy();
    expect(app.getByRole('button', { name: 'Add a memory' })).toBeTruthy();
  });

  it('organizes by festival, night and set, and plays a memory with its details', async () => {
    await storeMemory();
    const app = await renderApp('/profile');
    await flush();
    await fireEvent.press(app.getByLabelText('Memories, 1'));
    await flush();
    expect(app.getByText('1 clip from 1 festival. Private to you.')).toBeTruthy();
    expect(app.getByText('Cyclops Cove 4')).toBeTruthy();
    expect(app.getByText('Saturday')).toBeTruthy();
    expect(app.getByText('SUBTRONICS')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Memory: SUBTRONICS · Saturday · Cyclops Cove 4'));
    await flush();
    expect(app.getByText('Saturday · Cyclops Cove 4')).toBeTruthy();
    expect(app.getByText('Sat, Dec 5 · 10:30 PM')).toBeTruthy();
    // Profiles aren't set up in this test's build unless signed in; the share action still appears when available.
    expect(app.getByRole('button', { name: 'Share to profile' })).toBeTruthy();

    // The artist's page shows it too.
    await go('/artist/subtronics');
    expect(app.getByText('Your memories')).toBeTruthy();
    expect(app.getByLabelText('Your memory of SUBTRONICS, Saturday')).toBeTruthy();
  });

  it('untagged memories come first and open the tagging sheet', async () => {
    await storeMemory({ festivalId: undefined, night: undefined, artistId: undefined });
    const app = await renderApp('/memories');
    await flush();
    expect(app.getByText('Not tagged yet')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Untagged memory. Tag it'));
    await flush();
    expect(app.getByText('Tag memory')).toBeTruthy();
    // Filmed on a Cyclops Cove night: the festival is already chosen, so tagging is one tap.
    expect(app.getByRole('button', { name: 'Cyclops Cove 4', selected: true })).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Save to Memories'));
    await flush();
    expect((await saved())[0].festivalId).toBe('cyclops-cove-4');
  });

  it('deleting asks first and removes the video and its still from the phone', async () => {
    await storeMemory();
    const alert = answerAlerts('Delete');
    const app = await renderApp('/memory/mtest1');
    await flush();
    await fireEvent.press(app.getByRole('button', { name: 'Delete' }));
    await flush();
    expect(alert).toHaveBeenCalledWith('Delete this memory?', expect.stringMatching(/removed from this phone/), expect.any(Array));
    expect(await saved()).toEqual([]);
    expect(files.size).toBe(0);
  });
});

describe('social profiles', () => {
  it('not set up in this build: says so plainly, no sign-in offered', async () => {
    mockSocial = fakeSocial({ available: false });
    const app = await renderApp('/profile');
    await flush();
    expect(app.queryByRole('button', { name: 'Create your profile' })).toBeNull();
    expect(app.getByText('Your festivals, your videos and your sound.')).toBeTruthy();
  });

  it('create an account (agreeing to the guidelines), make a profile, and see it on Profile', async () => {
    const app = await renderApp('/profile');
    await flush();
    await fireEvent.press(app.getByRole('button', { name: 'Create your profile' }));
    await flush();
    expect(app.getByText('Community guidelines')).toBeTruthy();
    await fireEvent.changeText(app.getByLabelText('Email'), 'maya@example.com');
    await fireEvent.changeText(app.getByLabelText('Password'), 'password123');
    // Not without agreeing.
    await fireEvent.press(app.getByRole('button', { name: 'Create profile' }));
    expect(app.getByText('Agree to the guidelines to create your profile.')).toBeTruthy();
    await fireEvent.press(app.getByRole('checkbox'));
    await fireEvent.press(app.getByRole('button', { name: 'Create profile' }));
    await flush();
    expect(app.getByText('Create your profile')).toBeTruthy();
    // The handle is suggested from the email.
    expect(app.getByLabelText('Handle').props.value).toBe('maya');
    await fireEvent.changeText(app.getByLabelText('Name'), 'Maya Chen');
    await settle(500);
    await flush();
    expect(app.getByText('Available')).toBeTruthy();
    await fireEvent.press(app.getByRole('button', { name: 'Create profile' }));
    await flush();
    expect(mockSocial.profiles.get('uid-1')).toMatchObject({ handle: 'maya', displayName: 'Maya Chen', festivals: [], sounds: [] });
    expect(app.getByText('Maya Chen')).toBeTruthy();
    expect(app.getByText('@maya')).toBeTruthy();
  });

  it('a handle someone else has is refused before saving', async () => {
    await withProfile('maya', false);
    await mockSocial.service.signUp('sam@example.com', 'password123');
    const app = await renderApp('/profile-edit');
    await flush();
    await fireEvent.changeText(app.getByLabelText('Name'), 'Sam');
    await fireEvent.changeText(app.getByLabelText('Handle'), 'maya');
    await settle(500);
    await flush();
    expect(app.getByText('Someone already has that handle.')).toBeTruthy();
  });

  it('share a memory to your profile; others see it there; remove it again', async () => {
    await withProfile();
    await storeMemory();
    const alert = answerAlerts('Share');
    const app = await renderApp('/memory/mtest1');
    await flush();
    await fireEvent.press(app.getByRole('button', { name: 'Share to profile' }));
    await flush();
    expect(alert).toHaveBeenCalledWith('Share to your profile?', expect.stringMatching(/doesn’t add where you filmed it, but some videos carry their location inside the file/), expect.any(Array));
    expect(mockSocial.memories.size).toBe(1);
    const shared = [...mockSocial.memories.values()][0];
    expect(shared).toMatchObject({ uid: 'uid-1', handle: 'maya', festivalId: 'cyclops-cove-4', artistId: 'subtronics' });
    expect(JSON.stringify(shared)).not.toMatch(/Boca|lat|lng/);
    expect((await saved())[0]).toMatchObject({ sharedId: shared.id, sharedBy: 'uid-1' });
    expect(app.getByRole('button', { name: 'On your profile' })).toBeTruthy();

    await go('/u/maya');
    expect(app.getByText('Maya')).toBeTruthy();
    expect(app.getByText('Memories · 1')).toBeTruthy();
    expect(app.getByLabelText('Video of SUBTRONICS')).toBeTruthy();

    alert.mockRestore();
    answerAlerts('Remove');
    await go('/memory/mtest1');
    await fireEvent.press(app.getByRole('button', { name: 'On your profile' }));
    await flush();
    expect(mockSocial.memories.size).toBe(0);
    expect((await saved())[0].sharedId).toBeUndefined();
  });

  it('someone else can report and block a profile; blocked people disappear from search', async () => {
    await withProfile('maya', false);
    await mockSocial.service.signUp('sam@example.com', 'password123');
    const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions');
    sheet.mockImplementationOnce((_o, cb) => cb(0)); // Report
    sheet.mockImplementationOnce((_o, cb) => cb(0)); // Offensive or explicit
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const app = await renderApp('/u/maya');
    await flush();
    await fireEvent.press(app.getByLabelText('More: report or block'));
    await flush();
    expect(mockSocial.reports).toEqual([expect.objectContaining({ by: 'uid-2', target: { kind: 'profile', id: 'uid-1', ownerUid: 'uid-1' }, reason: 'offensive', note: undefined })]);
    const foundBefore = (await mockSocial.service.searchProfiles('ma')).some((p) => p.handle === 'maya');

    (Alert.alert as jest.Mock).mockRestore();
    answerAlerts('Block');
    sheet.mockImplementationOnce((_o, cb) => cb(1)); // Block
    await fireEvent.press(app.getByLabelText('More: report or block'));
    await flush();
    expect(mockSocial.blocks.get('uid-2')).toEqual(['uid-1']);
    expect(app.getByText('You blocked @maya.')).toBeTruthy();

    await go('/people');
    await fireEvent.changeText(app.getByLabelText('Search people'), 'ma');
    await settle(400);
    await flush();
    expect(app.queryByLabelText('Maya, @maya')).toBeNull();
    // Before blocking, search found her.
    expect(foundBefore).toBe(true);
  });

  it('“Going to” on your profile follows your plans when it’s switched on', async () => {
    await withProfile();
    const app = await renderApp('/festival/acl-26');
    await flush();
    await fireEvent.press(app.getByLabelText(/^I'm going/));
    await flush();
    await settle(3500);
    await flush();
    expect(mockSocial.profiles.get('uid-1')?.festivals).toEqual(['acl-26']);
  });

  it('deleting your account removes your profile and everything shared, and needs your password', async () => {
    await withProfile();
    await storeMemory({ sharedId: 'shared-x', sharedBy: 'uid-1' });
    mockSocial.memories.set('shared-x', { id: 'shared-x', uid: 'uid-1', handle: 'maya', memoryId: 'mtest1', videoUrl: 'https://example.test/v.mp4', capturedAt: '2026-12-06T03:30:00.000Z', createdAt: '' });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const app = await renderApp('/profile-edit');
    await flush();
    await fireEvent.press(app.getByRole('button', { name: 'Delete account' }));
    await fireEvent.changeText(app.getByLabelText('Password to delete your account'), 'wrong');
    await fireEvent.press(app.getByRole('button', { name: 'Delete account forever' }));
    await flush();
    expect(app.getByText('That email and password don’t match.')).toBeTruthy();
    expect(mockSocial.profiles.size).toBe(1);
    await fireEvent.changeText(app.getByLabelText('Password to delete your account'), 'password123');
    await fireEvent.press(app.getByRole('button', { name: 'Delete account forever' }));
    await flush();
    expect(mockSocial.profiles.size).toBe(0);
    expect(mockSocial.handles.size).toBe(0);
    expect(mockSocial.memories.size).toBe(0);
    // The memory itself stays on the phone, no longer marked shared.
    expect((await saved())[0]).toMatchObject({ id: 'mtest1' });
    expect((await saved())[0].sharedId).toBeUndefined();
  });
});
