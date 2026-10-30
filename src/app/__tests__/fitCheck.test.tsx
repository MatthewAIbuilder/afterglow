import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { ActionSheetIOS } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { renderApp, showTab } from './appRoutes';

/** Fit check in festival mode (as a test from Settings): snap your outfit, send it to your crew, see it on Profile. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i++) await settle();
};
const s = () => mockSocial.service;

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetGoers();
});

describe('fit check', () => {
  it('snaps today’s fit in festival mode and keeps it', async () => {
    await s().signUp('maya@example.com', 'password123');
    await s().saveProfile({ handle: 'maya', displayName: 'Maya', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
    const app = await renderApp('/settings');
    await flush();
    await fireEvent.press(app.getByLabelText(/^Test festival mode with .*: see how the app looks on festival day$/));
    await flush();
    await showTab(app, 'Lineup');
    await flush();
    (ImagePicker.launchCameraAsync as jest.Mock).mockImplementationOnce(async () => ({ canceled: false, assets: [{ uri: 'file:///picked/fit.jpg', width: 900, height: 1200 }] }));
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementationOnce((o, cb) => cb(o.options.indexOf('Take a photo')));
    await fireEvent.press(app.getByLabelText('Snap today’s fit'));
    await flush();
    expect(app.getByLabelText('Your fit today. Opens it big.')).toBeTruthy();
    const kept = JSON.parse((await AsyncStorage.getItem('fitChecks.v1')) ?? '[]');
    expect(kept).toHaveLength(1);
    expect(kept[0].uri).toContain('fit-checks');
    await app.unmount();
  });
});
