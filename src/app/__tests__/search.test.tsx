import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/** Search from Discover, through the real routes with the in-memory backend. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const flush = async () => {
  for (let i = 0; i < 8; i++)
    await act(async () => {
      await Promise.resolve();
    });
};
// The testing library runs on fake timers once the app is rendered: move them on by hand.
const wait = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
});

describe('search', () => {
  it('opens from Discover and finds artists and festivals, then remembers what you opened', async () => {
    const app = await renderApp('/');
    await flush();
    await fireEvent.press(app.getByLabelText('Search artists, festivals and people'));
    await flush();
    await fireEvent.changeText(app.getByLabelText('Search Afterglow'), 'solstice');
    await flush();
    expect(app.getByText('Festivals')).toBeTruthy();
    await fireEvent.press(app.getByLabelText(/^Solstice 2026, /));
    await flush();
    expect(JSON.parse((await AsyncStorage.getItem('recentSearches.v1'))!)).toEqual([{ kind: 'festival', id: 'solstice-26', label: 'Solstice 2026' }]);
  });

  it('before typing: recent searches, top matches; nothing matching says so', async () => {
    await AsyncStorage.setItem('recentSearches.v1', JSON.stringify([{ kind: 'artist', id: 'subtronics', label: 'SUBTRONICS' }]));
    const app = await renderApp('/search');
    await flush();
    expect(app.getByLabelText('SUBTRONICS, artist')).toBeTruthy();
    expect(app.getByText('Your top matches')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Remove SUBTRONICS from recent searches'));
    await flush();
    expect(app.queryByLabelText('SUBTRONICS, artist')).toBeNull();
    await fireEvent.changeText(app.getByLabelText('Search Afterglow'), 'zzzzqq');
    await flush();
    expect(app.getByText('Nothing on Afterglow matches “zzzzqq”.')).toBeTruthy();
  });

  it('finds people when signed in', async () => {
    const maya = await mockSocial.service.signUp('maya@example.com', 'password123');
    await mockSocial.service.saveProfile({ handle: 'mayachen', displayName: 'Maya Chen', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
    void maya;
    await mockSocial.service.signUp('me@example.com', 'password123');
    const app = await renderApp('/search');
    await flush();
    await fireEvent.changeText(app.getByLabelText('Search Afterglow'), '@may');
    await wait(350);
    await flush();
    expect(app.getByText('People')).toBeTruthy();
    expect(app.getByLabelText('Maya Chen, @mayachen')).toBeTruthy();
  });
});
