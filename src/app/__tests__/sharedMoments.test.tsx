import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/**
 * Videos you shared from somewhere else (the website, Expo Go, another phone,
 * before a reinstall) still show on your profile in the app, opening as the
 * shared video; one kept on this phone isn't listed twice.
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

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  await mockSocial.service.signUp('sam@example.com', 'password123');
  await mockSocial.service.saveProfile({ handle: 'sam', displayName: 'Sam', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
});

describe('moments shared from elsewhere', () => {
  it('shows on Profile in the app, beside the ones kept on this phone', async () => {
    const elsewhere = await mockSocial.service.shareMemory({ memoryId: 'web1', videoUri: 'blob:web1', thumbUri: 'blob:web1.jpg', artistId: 'subtronics', capturedAt: '2026-10-04T23:00:00.000Z', durationSec: 20 });
    const here = await mockSocial.service.shareMemory({ memoryId: 'm1', videoUri: 'file:///m1.mp4', artistId: 'subtronics', capturedAt: '2026-10-05T23:00:00.000Z', durationSec: 12 });
    const uid = mockSocial.currentUser()!.uid;
    await AsyncStorage.setItem(
      'memories.v1',
      JSON.stringify([{ id: 'm1', file: 'm1.mp4', capturedAt: '2026-10-05T23:00:00.000Z', addedAt: '2026-10-05T23:30:00.000Z', artistId: 'subtronics', durationSec: 12, sharedId: here.id, sharedBy: uid }]),
    );
    const app = await renderApp('/profile');
    await flush();
    const shared = app.getAllByLabelText(/^Video: .*, shared$/);
    expect(shared).toHaveLength(2);
    expect(elsewhere.id).not.toBe(here.id);
  });
});
