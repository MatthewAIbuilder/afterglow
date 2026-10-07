import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/** Your garden's private copy: kept with your account, and read back when the phone's own copy is gone. */
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
const NOW = new Date(2026, 9, 3, 20, 0);
const PLUR = 'plurplurplurplurplur';
const WILD = 'wild:edc-2026-10-02';
const saved = async () => JSON.parse((await AsyncStorage.getItem('sprouts.v1')) ?? '{}') as { garden?: { id: string; account: string }[]; wild?: { id: string }[]; bloomed?: Record<string, string>; starterAt?: number };

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
});

// Two app starts per test: well over Jest's 5 s default when the whole suite runs at once.
jest.setTimeout(20_000);

describe('garden backups', () => {
  it('keeps a private copy with your account, and a wiped phone gets its garden back', async () => {
    const u = await s().signUp('ana@example.com', 'password123');
    await s().saveProfile({ handle: 'ana', displayName: 'Ana', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
    await AsyncStorage.setItem(
      'sprouts.v1',
      JSON.stringify({
        gifts: [],
        claims: [],
        garden: [{ id: PLUR, kind: 'plur', from: 'maya-uid', handle: 'maya', name: 'Maya', at: NOW.getTime() - 3 * 86_400_000, account: u.uid }],
        bloomed: { [WILD]: 'bass' },
        starterAt: NOW.getTime() - 10 * 86_400_000,
        wild: [{ id: WILD, kind: 'seedling', from: '', name: 'EDC', foundAt: 'EDC', at: NOW.getTime() - 86_400_000 }],
      }),
    );
    const first = await renderApp('/garden');
    await flush();
    await settle(6000);
    await flush();
    const copy = mockSocial.gardenBackups.get(u.uid);
    expect(copy).toContain(PLUR);
    expect(copy).toContain(WILD);
    await first.unmount();

    // The phone forgets everything (a cleared browser, a reinstall): signing in brings it back.
    await AsyncStorage.clear();
    await AsyncStorage.setItem('welcomed.v1', 'true');
    const again = await renderApp('/garden');
    await flush();
    await settle(1000);
    await flush();
    const back = await saved();
    expect(back.garden?.map((g) => [g.id, g.account])).toEqual([[PLUR, u.uid]]);
    expect(back.wild?.map((w) => w.id)).toEqual([WILD]);
    expect(back.bloomed?.[WILD]).toBe('bass');
    expect(back.starterAt).toBe(NOW.getTime() - 10 * 86_400_000);
    await again.unmount();
  });

  it('an empty phone never writes over a full copy before reading it', async () => {
    const u = await s().signUp('ben@example.com', 'password123');
    await s().saveProfile({ handle: 'ben', displayName: 'Ben', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
    const full = JSON.stringify({ v: 1, garden: [{ id: PLUR, kind: 'plur', from: 'maya-uid', handle: 'maya', name: 'Maya', at: NOW.getTime() - 86_400_000, account: 'whoever' }], gifts: [], bloomed: {}, wild: [] });
    mockSocial.gardenBackups.set(u.uid, full);
    mockSocial.network.down = true;
    const app = await renderApp('/garden');
    await flush();
    await settle(6000);
    await flush();
    // No signal: nothing read, nothing written.
    expect(mockSocial.gardenBackups.get(u.uid)).toBe(full);
    expect((await saved()).garden ?? []).toEqual([]);
    mockSocial.network.down = false;
    await app.unmount();
    const later = await renderApp('/garden');
    await flush();
    await settle(6000);
    await flush();
    expect((await saved()).garden?.map((g) => [g.id, g.account])).toEqual([[PLUR, u.uid]]);
    expect(mockSocial.gardenBackups.get(u.uid)).toContain(PLUR);
    await later.unmount();
  });

  it('a video you posted gives you that artist’s collectible, even when it isn’t on this phone', async () => {
    await s().signUp('cara@example.com', 'password123');
    await s().saveProfile({ handle: 'cara', displayName: 'Cara', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
    await s().shareMemory({ memoryId: 'old1', videoUri: 'file:///old1.mov', festivalId: 'cyclops-cove-4', night: 'Friday', artistId: 'hedex', capturedAt: '2025-12-04T22:30:00.000Z', durationSec: 30, width: 1080, height: 1920 });
    const app = await renderApp('/artist/hedex');
    await flush();
    await settle(1000);
    await flush();
    expect(app.getByText('YOUR COLLECTIBLE')).toBeTruthy();
    await app.unmount();
  });
});

