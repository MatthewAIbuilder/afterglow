import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Asset } from 'expo-media-library';
import { ActionSheetIOS } from 'react-native';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { State } from 'react-native-gesture-handler';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/** Track ID: Shazam suggests the song while you tag a video; it's kept (and shared) only if you add it. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));
const RUMBLE = { title: 'Rumble', artist: 'Skrillex, Fred again.. & Flowdan', appleMusicUrl: 'https://music.apple.com/us/album/rumble/1?i=2' };
jest.mock('../../lib/shazam', () => ({
  canFindTracks: () => true,
  findTrack: jest.fn(async () => ({ found: RUMBLE })),
}));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 8; i++) await settle();
};

/** A video chosen from the library, filmed on Saturday night at Cyclops Cove 4 in Boca Raton. */
async function openTagging() {
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
const saved = async (): Promise<{ track?: unknown }[]> => JSON.parse((await AsyncStorage.getItem('memories.v1')) ?? '[]');

describe('track ID while tagging', () => {
  it('suggests the song; added, it’s kept with the video and shared with it', async () => {
    const app = await openTagging();
    expect(app.getByText('Shazam hears')).toBeTruthy();
    expect(app.getByText('Rumble')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Add Rumble by Skrillex, Fred again.. & Flowdan as the track'));
    expect(app.getByLabelText('Track: Rumble by Skrillex, Fred again.. & Flowdan. Opens in Apple Music.')).toBeTruthy();
    await fireEvent.press(app.getByLabelText(/^SUBTRONICS, Playing Saturday/));
    await fireEvent.press(app.getByLabelText('Save to Memories'));
    await flush();
    expect((await saved())[0].track).toEqual(RUMBLE);
    const shared = await mockSocial.service.festivalMemories('cyclops-cove-4', 10);
    expect(shared[0]).toMatchObject({ artistId: 'subtronics', track: RUMBLE });
  });

  it('“Not it” hides the suggestion and keeps nothing', async () => {
    const app = await openTagging();
    await fireEvent.press(app.getByText('Not it'));
    expect(app.queryByText('Shazam hears')).toBeNull();
    await fireEvent.press(app.getByLabelText(/^SUBTRONICS, Playing Saturday/));
    await fireEvent.press(app.getByLabelText('Save to Memories'));
    await flush();
    expect((await saved())[0].track).toBeUndefined();
    expect((await mockSocial.service.festivalMemories('cyclops-cove-4', 10))[0].track).toBeUndefined();
  });
});
