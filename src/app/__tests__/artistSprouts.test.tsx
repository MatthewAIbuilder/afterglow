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
/** Videos of an artist in your Memories. */
const filmed = async (artistId: string, n: number) => {
  const list = Array.from({ length: n }, (_, i) => {
    const at = new Date(2026, 8, 20 + i, 22).toISOString();
    return { id: `m-${artistId}-${i}`, file: `m${i}.mov`, capturedAt: at, addedAt: at, artistId };
  });
  await AsyncStorage.setItem('memories.v1', JSON.stringify(list));
};
/** What the garden already celebrated (none: anything earned now gets its moment). */
const celebrated = (shown: Record<string, number>) => AsyncStorage.setItem('sprouts.v1', JSON.stringify({ gifts: [], claims: [], garden: [], bloomed: {}, artistShown: shown }));

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 3, 20, 0) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
});

describe('artist sprouts', () => {
  it('filming an artist grows their sprout, with its own moment in the garden', async () => {
    await filmed('subtronics', 2);
    await celebrated({});
    const app = await renderApp('/garden');
    await flush();
    expect(app.getByText('Artist sprout unlocked')).toBeTruthy();
    expect(app.getAllByText('SUBTRONICS sprout').length).toBeGreaterThan(0);
    expect(app.getByText(/^A cyclops sprout, grown from your video of SUBTRONICS/)).toBeTruthy();
    await settle(500);
    await fireEvent.press(app.getByText('Lovely'));
    await flush();
    expect(app.queryByText('Artist sprout unlocked')).toBeNull();
    expect(app.getByText('Artist sprouts · 1')).toBeTruthy();
    expect(app.getByLabelText('SUBTRONICS sprout, 2 videos.')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('SUBTRONICS sprout, 2 videos.'));
    await flush();
    expect(app.getByText('1 more video of them for bronze. First filmed Sep 20, 2026.')).toBeTruthy();
  });

  it('levels up with more videos, and celebrates the new level', async () => {
    await filmed('subtronics', 3);
    await celebrated({ subtronics: 1 });
    const app = await renderApp('/garden');
    await flush();
    expect(app.getByText('Artist sprout levelled up')).toBeTruthy();
    expect(app.getByText(/^Bronze now: you’ve filmed SUBTRONICS 3 times/)).toBeTruthy();
  });

  it('videos from before the update grow their sprouts quietly', async () => {
    await filmed('subtronics', 1);
    const app = await renderApp('/garden');
    await flush();
    expect(app.queryByText('Artist sprout unlocked')).toBeNull();
    expect(app.getByLabelText('SUBTRONICS sprout, 1 video.')).toBeTruthy();
  });

  it('with none yet, the garden shows signature sprouts to aim for', async () => {
    const app = await renderApp('/garden');
    await flush();
    expect(app.getByText('Film a set and that artist’s sprout grows in your garden.')).toBeTruthy();
    expect(app.getByLabelText(/^SUBTRONICS: a cyclops sprout\. Film their set to grow it\.$/)).toBeTruthy();
  });

  it('an artist page shows their sprout, and how to grow it', async () => {
    const app = await renderApp('/artist/subtronics');
    await flush();
    expect(app.getByText('Their sprout')).toBeTruthy();
    expect(app.getByText('A cyclops sprout')).toBeTruthy();
    expect(app.getByText('Film their set and it grows in your garden.')).toBeTruthy();
  });

  it('can be given, and lands in their garden as that artist’s sprout', async () => {
    await person('maya', 'Maya');
    await filmed('subtronics', 3);
    const app = await renderApp('/give-sprout?artist=subtronics');
    await flush();
    expect(app.getAllByText('SUBTRONICS sprout').length).toBeGreaterThan(0);
    expect(app.getByText(/^A cyclops sprout\. Bronze · 3 videos of them filmed/)).toBeTruthy();
    await fireEvent.press(app.getByText('Show the code'));
    await flush();
    expect(app.getByLabelText('A code for your SUBTRONICS sprout. Someone scans it to pick it up.')).toBeTruthy();
    const [given] = [...mockSocial.sprouts.values()];
    expect(given).toMatchObject({ artistId: 'subtronics', artistName: 'SUBTRONICS' });
    // Sam picks it up from the link.
    await s().signOut();
    await person('sam', 'Sam');
    await act(async () => router.push(`/sprout/${given.id}?u=${given.from}&h=maya&k=seedling&n=Maya&a=subtronics&an=SUBTRONICS`));
    await flush();
    expect(app.getByText('Maya gave you a SUBTRONICS sprout')).toBeTruthy();
    await fireEvent.press(app.getByText('Add to my garden'));
    await flush();
    await act(async () => router.push('/garden'));
    await flush();
    expect(app.getByLabelText('SUBTRONICS sprout, from Maya.')).toBeTruthy();
  });

  it('a link edited to name an artist still gives the plain sprout that was given', async () => {
    await person('maya', 'Maya');
    await s().giveSprout({ id: 'abcdefghijkmnpqrstuv', kind: 'plur' });
    await s().signOut();
    await person('sam', 'Sam');
    const maya = [...mockSocial.sprouts.values()][0].from;
    const app = await renderApp(`/sprout/abcdefghijkmnpqrstuv?u=${maya}&h=maya&k=plur&n=Maya&a=subtronics&an=SUBTRONICS`);
    await flush();
    await fireEvent.press(app.getByText('Add to my garden'));
    await flush();
    await act(async () => router.push('/garden'));
    await flush();
    expect(app.getByLabelText('PLUR sprout, from Maya. In bloom.')).toBeTruthy();
    expect(app.queryByLabelText('SUBTRONICS sprout, from Maya.')).toBeNull();
  });

  it('only artists you filmed can be given', async () => {
    await person('maya', 'Maya');
    const app = await renderApp('/give-sprout?artist=subtronics');
    await flush();
    // Not filmed: it offers a plain sprout instead.
    expect(app.queryByText('SUBTRONICS sprout')).toBeNull();
    expect(app.getAllByText('Sprout').length).toBeGreaterThan(0);
  });
});
