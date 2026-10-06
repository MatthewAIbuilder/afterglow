import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Asset } from 'expo-media-library';
import * as Network from 'expo-network';
import { router } from 'expo-router';
import { ActionSheetIOS, Alert } from 'react-native';
import { SocialError } from '../../features/social/service';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { State } from 'react-native-gesture-handler';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/** Tagging a video with the festival and who was playing offers to share it to Discover as you save. */
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

/** A video chosen from the library, filmed on Saturday night at Cyclops Cove 4 in Boca Raton. */
function pickFromLibrary() {
  jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementationOnce((_o, cb) => cb(1));
  (ImagePicker.launchImageLibraryAsync as jest.Mock<typeof ImagePicker.launchImageLibraryAsync>).mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///cache/ImagePicker/ABC.MOV', duration: 42_000, width: 1080, height: 1920, assetId: 'ASSET-1', type: 'video' }],
  } as ImagePicker.ImagePickerResult);
  (Asset as unknown as jest.Mock).mockImplementation(() => ({
    getCreationTime: async () => new Date(2026, 11, 5, 22, 30).getTime(),
    getLocation: async () => ({ latitude: 26.35, longitude: -80.08 }),
  }));
  (Location.reverseGeocodeAsync as jest.Mock<typeof Location.reverseGeocodeAsync>).mockResolvedValueOnce([{ city: 'Boca Raton', region: 'Florida' } as Location.LocationGeocodedAddress]);
}

async function openTagging() {
  pickFromLibrary();
  const app = await renderApp('/');
  await flush();
  await act(async () => fireGestureHandler(getByGestureTestId('hold-c1'), [{ state: State.BEGAN }, { state: State.ACTIVE }, { state: State.END }]));
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
  network.__setState({ isConnected: true, isInternetReachable: true });
});
const network = Network as unknown as { __setState: (s: { isConnected?: boolean; isInternetReachable?: boolean }) => void };
const savedMemories = async (): Promise<{ id: string; sharedId?: string }[]> => JSON.parse((await AsyncStorage.getItem('memories.v1')) ?? '[]');

describe('share to Discover while tagging', () => {
  it('needs who was playing, then is on by default and shares as you save', async () => {
    const app = await openTagging();
    expect(app.getByText('Pick who was playing to share it to Discover.')).toBeTruthy();
    await fireEvent.press(app.getByLabelText(/^SUBTRONICS, Playing Saturday/));
    expect(app.getByTestId('share-to-discover').props.value).toBe(true);
    expect(app.getByText(/^People discovering Cyclops Cove 4 can watch it, credited to @sam\./)).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Save to Memories'));
    await flush();
    const shared = await mockSocial.service.festivalMemories('cyclops-cove-4', 10);
    expect(shared).toHaveLength(1);
    expect(shared[0]).toMatchObject({ handle: 'sam', artistId: 'subtronics', night: 'Saturday' });
  });

  it('switched off, it stays in your Memories only', async () => {
    const app = await openTagging();
    await fireEvent.press(app.getByLabelText(/^SUBTRONICS, Playing Saturday/));
    await fireEvent(app.getByTestId('share-to-discover'), 'valueChange', false);
    expect(app.getByText('Only in your Memories, on this phone.')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Save to Memories'));
    await flush();
    expect(await mockSocial.service.festivalMemories('cyclops-cove-4', 10)).toEqual([]);
    expect(JSON.parse((await AsyncStorage.getItem('memories.v1')) ?? '[]')).toHaveLength(1);
  });

  it('with no signal it waits on the phone, says so, and shares itself once there’s signal', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const app = await openTagging();
    await fireEvent.press(app.getByLabelText(/^SUBTRONICS, Playing Saturday/));
    network.__setState({ isConnected: false, isInternetReachable: false });
    mockSocial.network.down = true;
    await fireEvent.press(app.getByLabelText('Save to Memories'));
    await flush();
    // No error: it's kept for later, on the phone.
    expect(alert).not.toHaveBeenCalledWith('Couldn’t share it to Discover', expect.anything());
    const [m] = await savedMemories();
    expect(JSON.parse((await AsyncStorage.getItem('shareOutbox.v1')) ?? '[]')).toMatchObject([{ memoryId: m.id }]);
    await act(async () => router.push({ pathname: '/memory/[id]', params: { id: m.id } }));
    await flush();
    expect(app.getByText('Waiting for signal')).toBeTruthy();

    mockSocial.network.down = false;
    await act(async () => network.__setState({ isConnected: true, isInternetReachable: true }));
    await flush();
    expect(await mockSocial.service.festivalMemories('cyclops-cove-4', 10)).toHaveLength(1);
    expect((await savedMemories())[0].sharedId).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem('shareOutbox.v1')) ?? '[]')).toEqual([]);
    expect(app.getByText('On your profile')).toBeTruthy();
    // Retagging it later only changes Memories, and says so.
    await act(async () => router.push({ pathname: '/memory-tag', params: { id: m.id } }));
    await flush();
    expect(app.getByTestId('shared-note').props.children).toMatch(/keeps the tags it was shared with/);
  });

  it('a share refused once signal is back is let go, with a plain message', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const app = await openTagging();
    await fireEvent.press(app.getByLabelText(/^SUBTRONICS, Playing Saturday/));
    // Bars, but nothing getting through: it tries, then waits.
    mockSocial.network.down = true;
    await fireEvent.press(app.getByLabelText('Save to Memories'));
    await flush();
    expect(JSON.parse((await AsyncStorage.getItem('shareOutbox.v1')) ?? '[]')).toHaveLength(1);
    mockSocial.network.down = false;
    jest.spyOn(mockSocial.service, 'shareMemory').mockRejectedValue(new SocialError('too-large'));
    await settle(20_000);
    await flush();
    expect(alert).toHaveBeenCalledWith('Couldn’t share it to Discover', expect.stringMatching(/too big to share.*saved in your Memories/));
    expect(JSON.parse((await AsyncStorage.getItem('shareOutbox.v1')) ?? '[]')).toEqual([]);
    expect(await mockSocial.service.festivalMemories('cyclops-cove-4', 10)).toEqual([]);
  });

  it('can’t be deleted while it’s uploading, and saving twice keeps one', async () => {
    let finish: () => void = () => {};
    const real = mockSocial.service.shareMemory;
    jest.spyOn(mockSocial.service, 'shareMemory').mockImplementation((input, onProgress) => new Promise((resolve, reject) => {
      finish = () => void real(input, onProgress).then(resolve, reject);
    }));
    const app = await openTagging();
    await fireEvent.press(app.getByLabelText(/^SUBTRONICS, Playing Saturday/));
    const save = app.getByLabelText('Save to Memories');
    await fireEvent.press(save);
    await fireEvent.press(save);
    await flush();
    const list = await savedMemories();
    expect(list).toHaveLength(1);
    await act(async () => router.push({ pathname: '/memory/[id]', params: { id: list[0].id } }));
    await flush();
    expect(app.getByRole('button', { name: 'Delete' })).toBeDisabled();
    await act(async () => finish());
    await flush();
    expect(app.getByRole('button', { name: 'Delete' })).toBeEnabled();
    expect(await mockSocial.service.festivalMemories('cyclops-cove-4', 10)).toHaveLength(1);
  });

  it('deleted from the phone while it uploads, the Discover copy is taken down again', async () => {
    let finish: () => void = () => {};
    const real = mockSocial.service.shareMemory;
    jest.spyOn(mockSocial.service, 'shareMemory').mockImplementation((input, onProgress) => new Promise((resolve, reject) => {
      finish = () => void real(input, onProgress).then(resolve, reject);
    }));
    const app = await openTagging();
    await fireEvent.press(app.getByLabelText(/^SUBTRONICS, Playing Saturday/));
    await fireEvent(app.getByTestId('share-to-discover'), 'valueChange', false);
    await fireEvent.press(app.getByLabelText('Save to Memories'));
    await flush();
    const [m] = await savedMemories();
    await act(async () => router.push({ pathname: '/memory/[id]', params: { id: m.id } }));
    await flush();
    // The Delete question is up when the share starts (from the same page), and is answered while it uploads.
    const asked: { title: string; buttons?: { text?: string; onPress?: () => void }[] }[] = [];
    jest.spyOn(Alert, 'alert').mockImplementation((title, _msg, buttons) => void asked.push({ title, buttons }));
    await fireEvent.press(app.getByText('Delete'));
    await fireEvent.press(app.getByText('Share to profile'));
    await act(async () => asked.find((a) => a.title === 'Share to your profile?')!.buttons!.find((b) => b.text === 'Share')!.onPress!());
    await flush();
    await act(async () => asked.find((a) => a.title === 'Delete this memory?')!.buttons!.find((b) => b.text === 'Delete')!.onPress!());
    await flush();
    await act(async () => finish());
    await flush();
    expect(await savedMemories()).toEqual([]);
    expect(await mockSocial.service.festivalMemories('cyclops-cove-4', 10)).toEqual([]);
  });
});
