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
import { forgetBadges } from '../../features/badges/useBadges';
import { renderApp, showTab } from './appRoutes';

/**
 * Videos from festivals you went to before Afterglow: the tagging sheet finds
 * the past festival, the video can go to Discover, and it earns a rose gold
 * throwback badge on your profile.
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

/** An old video chosen from the camera roll: filmed in Orlando in November 2024. */
function pickOldVideo() {
  jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementationOnce((_o, cb) => cb(1));
  (ImagePicker.launchImageLibraryAsync as jest.Mock<typeof ImagePicker.launchImageLibraryAsync>).mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///cache/ImagePicker/OLD.MOV', duration: 30_000, width: 1080, height: 1920, assetId: 'ASSET-OLD', type: 'video' }],
  } as ImagePicker.ImagePickerResult);
  (Asset as unknown as jest.Mock).mockImplementation(() => ({
    getCreationTime: async () => new Date(2024, 10, 9, 23, 15).getTime(),
    getLocation: async () => ({ latitude: 28.4, longitude: -81.4 }),
  }));
  (Location.reverseGeocodeAsync as jest.Mock<typeof Location.reverseGeocodeAsync>).mockResolvedValueOnce([{ city: 'Orlando', region: 'Florida' } as Location.LocationGeocodedAddress]);
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetBadges();
  await mockSocial.service.signUp('sam@example.com', 'password123');
  await mockSocial.service.saveProfile({ handle: 'sam', displayName: 'Sam', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('past festivals', () => {
  it('finds the festival for an old video, shares it to Discover as a throwback, and keeps it in Memories', async () => {
    pickOldVideo();
    const app = await renderApp('/');
    await flush();
    await act(async () => fireGestureHandler(getByGestureTestId('hold-c1'), [{ state: State.BEGAN }, { state: State.ACTIVE }, { state: State.END }]));
    await flush();
    // An old video matching nothing on Afterglow opens on finding the past festival, in the year it was filmed.
    expect(app.getByText('Which festival was it?')).toBeTruthy();
    expect(app.getByLabelText('2024').props.accessibilityState).toEqual({ selected: true });
    await fireEvent.changeText(app.getByLabelText('Search for the festival'), 'edc orl');
    await fireEvent.press(app.getByLabelText('EDC Orlando 2024, Orlando'));
    expect(app.getByTestId('past-chosen')).toBeTruthy();
    expect(app.getByText(/rose gold badge/)).toBeTruthy();
    // Who was playing: anyone on Afterglow.
    await fireEvent.changeText(app.getByLabelText('Search for the artist'), 'subtro');
    await fireEvent.press(app.getByLabelText('SUBTRONICS'));
    expect(app.getByTestId('share-to-discover').props.value).toBe(true);
    expect(app.getByText(/^People discovering EDC Orlando 2024 can watch it/)).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Save to Memories'));
    await flush();
    const saved = JSON.parse((await AsyncStorage.getItem('memories.v1')) ?? '[]');
    expect(saved[0]).toMatchObject({ artistId: 'subtronics', past: { name: 'EDC Orlando', year: 2024, city: 'Orlando', seriesId: 'edc-orlando-26' } });
    expect(saved[0].festivalId).toBeUndefined();
    // Shared: it shows with this year's EDC Orlando, as a throwback.
    const shared = await mockSocial.service.festivalMemories('edc-orlando-26', 10);
    expect(shared).toHaveLength(1);
    expect(shared[0].past).toMatchObject({ name: 'EDC Orlando', year: 2024 });
  });

  it('a festival Afterglow doesn’t know can be typed in', async () => {
    pickOldVideo();
    const app = await renderApp('/');
    await flush();
    await act(async () => fireGestureHandler(getByGestureTestId('hold-c1'), [{ state: State.BEGAN }, { state: State.ACTIVE }, { state: State.END }]));
    await flush();
    await fireEvent.press(app.getByLabelText('2023'));
    await fireEvent.changeText(app.getByLabelText('Search for the festival'), 'Sunset Sessions 2023');
    await fireEvent.press(app.getByLabelText('Add Sunset Sessions 2023'));
    await fireEvent.press(app.getByLabelText('Save to Memories'));
    await flush();
    const saved = JSON.parse((await AsyncStorage.getItem('memories.v1')) ?? '[]');
    expect(saved[0].past).toEqual({ name: 'Sunset Sessions', year: 2023, city: 'Orlando' });
  });

  it('earns a throwback badge on your profile, claimed with the unlock, and listed under Been there', async () => {
    const filmed = new Date(2024, 10, 9, 23, 15).toISOString();
    await AsyncStorage.setItem(
      'memories.v1',
      JSON.stringify([{ id: 'm1', file: 'm1.mov', capturedAt: filmed, addedAt: filmed, artistId: 'subtronics', past: { name: 'Lost Lands', year: 2024, city: 'Thornville' } }]),
    );
    const app = await renderApp('/profile');
    await flush();
    await showTab(app, 'Badges');
    await flush();
    expect(app.getByText('Throwbacks · 1')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Lost Lands 2024 throwback badge, new. Tap to claim it'));
    await flush();
    expect(app.getByText('Throwback unlocked')).toBeTruthy();
    // Profile's own Festivals tab (it comes before the tab bar's).
    await fireEvent.press(app.getAllByRole('tab', { name: /^Festivals/ })[0]);
    await flush();
    expect(app.getByLabelText(/^Lost Lands 2024, a throwback/)).toBeTruthy();
    expect(app.getByLabelText('Add a festival you went to before, with a video from your camera roll')).toBeTruthy();
  });
});
