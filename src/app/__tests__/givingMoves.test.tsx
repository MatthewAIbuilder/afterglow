import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

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
const person = async (handle: string, name: string) => {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: name, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
};
/** Videos of an artist in your Memories, on these days of September. */
const filmed = (artistId: string, days: number[]) =>
  AsyncStorage.setItem(
    'memories.v1',
    JSON.stringify(
      days.map((d, i) => {
        const at = new Date(2026, 8, d, 22).toISOString();
        return { id: `m-${artistId}-${i}`, file: `m${i}.mov`, capturedAt: at, addedAt: at, artistId };
      }),
    ),
  );
const PLUR = 'plurabcdefghijkmnpqr';
const ART = 'artabcdefghijkmnpqrs';

/** Maya gives Sam a PLUR sprout and a SUBTRONICS collectible, and Sam picks both up: Sam is signed in. */
async function samWasGiven() {
  const maya = await person('maya', 'Maya');
  await s().giveSprout({ id: PLUR, kind: 'plur' });
  await s().giveSprout({ id: ART, kind: 'seedling', artistId: 'subtronics', artistName: 'SUBTRONICS' });
  await s().signOut();
  await person('sam', 'Sam');
  await s().claimSprout(PLUR);
  await s().claimSprout(ART);
  return maya;
}

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 3, 20, 0) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
});

describe('giving moves it', () => {
  it('a sprout you were given goes on to the next person and leaves your garden, with no seed', async () => {
    await samWasGiven();
    const app = await renderApp('/garden');
    await flush(20);
    expect(app.getByLabelText('PLUR sprout, from Maya. In bloom.')).toBeTruthy();
    await act(async () => router.push('/give-sprout'));
    await flush();
    await fireEvent.press(app.getByLabelText('PLUR sprout'));
    await flush();
    expect(app.getByText('Giving it moves it: it leaves your garden for theirs.')).toBeTruthy();
    await fireEvent.press(app.getByText('Show the code'));
    await flush();
    const on = [...mockSocial.sprouts.values()].find((x) => x.via === PLUR)!;
    expect(on).toMatchObject({ kind: 'plur' });
    expect(mockSocial.sprouts.get(PLUR)?.passedOn).toBe(on.id);
    await act(async () => router.push('/garden'));
    await flush();
    await act(async () => router.push('/give-sprout'));
    await flush();
    // It used no seed, and there isn't another to give.
    expect(app.getByText('5 of 5 seeds left today')).toBeTruthy();
    expect(app.queryByLabelText('PLUR sprout')).toBeNull();
    await act(async () => router.push('/garden'));
    await flush();
    expect(app.queryByLabelText('PLUR sprout, from Maya. In bloom.')).toBeNull();
  }, 30_000);

  it('an artist collectible you were given goes on too', async () => {
    await samWasGiven();
    const app = await renderApp('/give-sprout');
    await flush(20);
    await fireEvent.press(app.getByLabelText('SUBTRONICS collectible, given to you'));
    await flush();
    expect(app.getByText(/Given to you\. The one you give leaves your garden for theirs\.$/)).toBeTruthy();
    await fireEvent.press(app.getByText('Show the code'));
    await flush();
    const on = [...mockSocial.sprouts.values()].find((x) => x.via === ART)!;
    expect(on).toMatchObject({ artistId: 'subtronics' });
    await act(async () => router.push('/garden'));
    await flush();
    expect(app.queryByLabelText('SUBTRONICS collectible, from Maya.')).toBeNull();
  }, 30_000);

  it('your own artist collectible leaves once given and picked up', async () => {
    await person('maya', 'Maya');
    await filmed('subtronics', [20, 21, 22]);
    const app = await renderApp('/garden');
    await flush(20);
    expect(app.getByLabelText('SUBTRONICS collectible, Bronze · 3 videos.')).toBeTruthy();
    await act(async () => router.push('/give-sprout?artist=subtronics'));
    await flush();
    expect(app.getByText(/The one you give leaves your garden: film them again to earn it back\.$/)).toBeTruthy();
    await fireEvent.press(app.getByText('Show the code'));
    await flush();
    // Someone picks it up: it's gone for good (until you film them again).
    const [given] = [...mockSocial.sprouts.values()];
    expect(given).toMatchObject({ artistId: 'subtronics' });
    await s().signOut();
    await person('sam', 'Sam');
    await s().claimSprout(given.id);
    await s().signIn('maya@example.com', 'password123');
    await flush();
    await act(async () => router.push('/garden'));
    await flush(20);
    expect(app.queryByLabelText('SUBTRONICS collectible, Bronze · 3 videos.')).toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem('sprouts.v1')) ?? '{}').gifts[0].claimedBy).toBeTruthy();
  }, 30_000);
});
