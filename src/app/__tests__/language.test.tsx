import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { ActionSheetIOS } from 'react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { readStoredLanguage } from '../../i18n/storedLanguage';
import { renderApp } from './appRoutes';

/**
 * Settings → Language through the real routes: it shows the phone's language,
 * and picking Español saves it for the next start and starts Afterglow again.
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

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  mockReload.mockClear();
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('language in Settings', () => {
  it('follows the phone, and picking Español saves it and starts again', async () => {
    const app = await renderApp('/settings');
    await flush();
    expect(app.getByText('English (from your phone)')).toBeTruthy();
    let options: string[] = [];
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((o, pick) => {
      options = o.options;
      pick(o.options.indexOf('Español'));
    });
    await fireEvent.press(app.getByLabelText('Language: English (from your phone). Change the language of the app'));
    expect(options).toEqual(['Same as my phone', 'English', 'Español', 'Cancel']);
    expect(readStoredLanguage()).toBe('es');
    expect(mockReload).toHaveBeenCalled();
  });

  it('picking the language already in use changes nothing', async () => {
    const app = await renderApp('/settings');
    await flush();
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((o, pick) => pick(o.options.indexOf('Same as my phone')));
    await fireEvent.press(app.getByLabelText('Language: English (from your phone). Change the language of the app'));
    expect(mockReload).not.toHaveBeenCalled();
  });
});
