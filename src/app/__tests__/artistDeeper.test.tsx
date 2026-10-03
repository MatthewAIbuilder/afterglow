import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { forgetArtistCrowd } from '../../features/artists/ArtistCrowdRow';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/** The deeper artist page: their next show, you and them, and videos from the crowd. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 10; i++) await settle();
};
const s = () => mockSocial.service;
async function person(handle: string) {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: handle, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
}

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 3, 12) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetArtistCrowd();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('the deeper artist page', () => {
  it('shows their next show, and what you’ve done with their music', async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
    await AsyncStorage.setItem('reactions.v1', JSON.stringify({ c11: { liked: true, saved: false, skipped: false } }));
    await AsyncStorage.setItem('seen.v1', JSON.stringify({ c11: Date.now() - 1000 }));
    await AsyncStorage.setItem(
      'memories.v1',
      JSON.stringify([{ id: 'm1', file: 'm1.mov', capturedAt: '2024-07-20T23:00:00.000Z', addedAt: '2024-07-20T23:00:00.000Z', artistId: 'subtronics', past: { name: 'Lost Lands', year: 2024, city: 'Thornville' } }]),
    );
    const app = await renderApp('/artist/subtronics');
    await flush();
    expect(app.getByLabelText(/^Next show: [^,]+, .*\. Opens the festival\.$/)).toBeTruthy();
    expect(app.getByText('You and them')).toBeTruthy();
    expect(app.getByText('Seen live at Lost Lands 2024')).toBeTruthy();
    expect(app.getByText('1 video of them in your Memories')).toBeTruthy();
    expect(app.getByText(/^Watched 1 set · liked 1$/)).toBeTruthy();
  });

  it('nothing about you for an artist you haven’t met yet', async () => {
    const app = await renderApp('/artist/subtronics');
    await flush();
    expect(app.queryByText('You and them')).toBeNull();
  });

  it('videos from the crowd: everyone’s shared videos of them, opening each one', async () => {
    await person('maya');
    await s().shareMemory({ memoryId: 'x1', videoUri: 'file:///x1.mov', capturedAt: '2026-09-01T22:00:00.000Z', festivalId: 'cyclops-cove-4', artistId: 'subtronics' });
    await s().shareMemory({ memoryId: 'x2', videoUri: 'file:///x2.mov', capturedAt: '2024-07-20T22:00:00.000Z', artistId: 'subtronics', past: { name: 'Lost Lands', year: 2024 } });
    await s().shareMemory({ memoryId: 'x3', videoUri: 'file:///x3.mov', capturedAt: '2026-09-01T22:00:00.000Z', festivalId: 'cyclops-cove-4', artistId: 'levity' });
    await s().signOut();
    await person('sam');
    const app = await renderApp('/artist/subtronics');
    await flush();
    expect(app.getByText('From the crowd')).toBeTruthy();
    expect(app.getByText('2 videos')).toBeTruthy();
    expect(app.getByLabelText('SUBTRONICS at Cyclops Cove 4, filmed by @maya')).toBeTruthy();
    expect(app.getByLabelText('SUBTRONICS at a throwback, Lost Lands ’24, filmed by @maya')).toBeTruthy();
  });
});
