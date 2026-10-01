import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Asset } from 'expo-media-library';
import { ActionSheetIOS } from 'react-native';
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
});

describe('share to Discover while tagging', () => {
  it('needs who was playing, then is on by default and shares as you save', async () => {
    const app = await openTagging();
    expect(app.getByText('Pick the festival and who was playing to share it to Discover.')).toBeTruthy();
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
});
