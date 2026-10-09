import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert, type AlertButton } from 'react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));
// The in-memory backend's first account stands in for the gnome hats' keeper.
jest.mock('../../features/profile/backdrops', () => ({ ...jest.requireActual<object>('../../features/profile/backdrops'), GNOME_FRIENDS: ['uid-1'] }));

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
const HAT = 'gnomehatabcdefghijkm';

/** Grace (the keeper) gives Sam a hat, and Sam picks it up: Sam is signed in. */
async function samHasAHat(grown: boolean) {
  const grace = await person('grace', 'Grace');
  expect(grace).toBe('uid-1');
  await s().giveSprout({ id: HAT, kind: 'gnome' });
  await s().signOut();
  const sam = await person('sam', 'Sam');
  await s().claimSprout(HAT);
  const at = new Date(2026, 9, 3, 12).getTime();
  await AsyncStorage.setItem(
    'sprouts.v1',
    JSON.stringify({ gifts: [], claims: [], garden: [{ id: HAT, kind: 'gnome', from: grace, handle: 'grace', name: 'Grace', at, account: sam }], bloomed: grown ? { [HAT]: 'gnome' } : {}, ...(grown ? { bloomedAt: { [HAT]: at + 60_000 } } : {}), starterAt: at }),
  );
  return sam;
}

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 10, 20, 0) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
});

describe('gnome hats', () => {
  it('the keeper gives as many hats as they like, with no seeds', async () => {
    await person('grace', 'Grace');
    const app = await renderApp('/give-sprout');
    await flush();
    await fireEvent.press(app.getByLabelText('Gnome hat'));
    await flush();
    expect(app.getByText('You can give as many as you like, and they don’t use seeds.')).toBeTruthy();
    expect(app.queryByText('5 of 5 seeds left today')).toBeNull();
    await fireEvent.press(app.getByText('Show the code'));
    await flush();
    const [given] = [...mockSocial.sprouts.values()];
    expect(given).toMatchObject({ kind: 'gnome', from: 'uid-1' });
    expect(given.via).toBeUndefined();
  });

  it('a hat still growing can’t be passed on', async () => {
    await samHasAHat(false);
    const app = await renderApp('/garden');
    await flush(20);
    expect(app.getByLabelText(/^Gnome hat, from Grace\. Gnome hat · 6 more growth to peeking out/)).toBeTruthy();
    await act(async () => router.push('/give-sprout'));
    await flush();
    expect(app.queryByLabelText('Gnome hat')).toBeNull();
  });

  it('a grown gnome passed on leaves your garden as a new hat for them, and comes back if you take it back', async () => {
    await samHasAHat(true);
    const app = await renderApp('/garden');
    await flush(20);
    // It grew: the garden celebrates it, and it's a gnome now.
    expect(app.getByText('Your gnome is fully grown and hopping around your garden. You can pass it on now: it leaves your garden and starts again as a hat in theirs.')).toBeTruthy();
    await fireEvent.press(app.getByText('Lovely'));
    await flush();
    expect(app.getByLabelText('Gnome, from Grace. Gnome.')).toBeTruthy();
    await act(async () => router.push('/give-sprout'));
    await flush();
    await fireEvent.press(app.getByLabelText('Gnome hat'));
    await flush();
    expect(app.getByText('Your grown gnome leaves your garden, and they get a new hat to grow.')).toBeTruthy();
    await fireEvent.press(app.getByText('Show the code'));
    await flush();
    const passed = [...mockSocial.sprouts.values()].find((x) => x.via === HAT);
    expect(passed).toMatchObject({ kind: 'gnome', from: 'uid-2' });
    expect(mockSocial.sprouts.get(HAT)?.passedOn).toBe(passed!.id);
    // Taken back before anyone has it: it's yours again.
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons?: AlertButton[]) => buttons?.find((b) => b.text === 'Take it back')?.onPress?.());
    await fireEvent.press(app.getByText('Take it back'));
    await flush(20);
    alert.mockRestore();
    expect(mockSocial.sprouts.has(passed!.id)).toBe(false);
    expect(mockSocial.sprouts.get(HAT)?.passedOn).toBeUndefined();
    await act(async () => router.push('/garden'));
    await flush();
    expect(app.getByLabelText('Gnome, from Grace. Gnome.')).toBeTruthy();
    // Passed on again and picked up: it's gone from your garden for good.
    await act(async () => router.push('/give-sprout'));
    await flush();
    await fireEvent.press(app.getByLabelText('Gnome hat'));
    await fireEvent.press(app.getByText('Show the code'));
    await flush();
    const again = [...mockSocial.sprouts.values()].find((x) => x.via === HAT)!;
    await act(async () => router.push('/garden'));
    await flush();
    expect(app.queryByLabelText('Gnome, from Grace. Gnome.')).toBeNull();
    expect(again.kind).toBe('gnome');
  }, 30_000);
});
