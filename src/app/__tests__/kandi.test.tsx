import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/** Kandi through the real routes: made from a friend's profile, left in their garden, read there, seen by visitors. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (n = 10) => {
  for (let i = 0; i < n; i++) await settle();
};
const s = () => mockSocial.service;
const person = async (handle: string, name: string) => {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: name, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 3, 20, 0) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
});

describe('kandi', () => {
  it('made on a friend’s profile, it hangs in their garden with a note only they read', async () => {
    const maya = await person('maya', 'Maya Lin');
    await s().signOut();
    await person('sam', 'Sam');
    const app = await renderApp('/u/maya');
    await flush();
    await fireEvent.press(app.getByText('Make kandi for Maya'));
    await flush();
    expect(app.getByText('Kandi for Maya')).toBeTruthy();
    await fireEvent.changeText(app.getByLabelText('The word in letter beads'), 'besties');
    await fireEvent.press(app.getByLabelText('UV glow'));
    await fireEvent.changeText(app.getByLabelText('A note with your kandi'), 'See you at the rail');
    await fireEvent.press(app.getByText('Leave it in Maya’s garden'));
    await flush();
    expect(app.getByText('Left in Maya’s garden')).toBeTruthy();
    const [k] = [...mockSocial.kandi.values()];
    expect(k).toMatchObject({ to: maya, word: 'BESTIES', beads: 'uv', note: 'See you at the rail' });

    // Maya: the bell, then her garden.
    await act(async () => void (await s().signIn('maya@example.com', 'password123')));
    await flush(20);
    await act(async () => router.push('/notifications'));
    await flush();
    expect(app.getByText('@sam left you kandi: “BESTIES”')).toBeTruthy();
    await act(async () => router.push('/garden'));
    await flush(20);
    await fireEvent.press(app.getByLabelText('Kandi spelling BESTIES, from @sam'));
    await flush();
    expect(app.getByText('“See you at the rail”')).toBeTruthy();
    // Visitors see the bracelet in her garden (never the note).
    await settle(4500);
    await flush();
    expect(mockSocial.gardens.get(maya)?.kandi).toEqual([{ word: 'BESTIES', beads: 'uv', from: 'sam' }]);
  });

  it('with no signal it waits on the phone and goes once there is', async () => {
    const maya = await person('maya', 'Maya Lin');
    await s().signOut();
    await person('sam', 'Sam');
    mockSocial.network.down = true;
    const app = await renderApp(`/kandi-make?uid=${maya}&name=Maya`);
    await flush();
    await fireEvent.press(app.getByText('Leave it in Maya’s garden'));
    await flush();
    expect(mockSocial.kandi.size).toBe(0);
    mockSocial.network.down = false;
    await settle(16_000);
    await flush(20);
    expect(mockSocial.kandi.size).toBe(1);
  });
});
