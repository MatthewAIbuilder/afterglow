import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { useEffect } from 'react';
import { act, render } from '@testing-library/react-native';
import type { MusicLibrarySnapshot, MusicProviderId } from '../../features/music/models';
import { MusicServiceError, type ConnectResult, type MusicAvailability, type MusicService } from '../../features/music/service';
import type { MusicServices } from '../../features/music/services';
import { CatalogProvider } from '../catalog';
import { MUSIC_STORAGE_KEY, MusicConnectionsProvider, useMusic } from '../music';

/**
 * The music connections provider on its own: duplicate syncs, a disconnect
 * that lands mid sign-in or mid sync, tokens left behind, and the re-read on
 * launch. Test-double services only; nothing contacts Spotify.
 */
const snap = (names: string[], syncedAt = new Date().toISOString()): MusicLibrarySnapshot => ({
  version: 1,
  provider: 'spotify',
  syncedAt,
  artists: names.map((name) => ({ provider: 'spotify', name, key: name.toLowerCase(), savedTracks: 3, savedAlbums: 1, genres: [], sources: ['saved'] })),
  savedTracksRead: 3,
  gaps: [],
});

/** A promise the test resolves by hand, to hold a sign-in or a sync open. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fake(over: Partial<MusicService> = {}) {
  const d = {
    provider: 'spotify' as MusicProviderId,
    availability: (): MusicAvailability => ({ ok: true }),
    connect: jest.fn(async (): Promise<ConnectResult> => ({ ok: true })),
    fetchLibrary: jest.fn(async (_now: Date) => snap(['Subtronics', 'Levity'])),
    disconnect: jest.fn(async () => {}),
  };
  return Object.assign(d, over) as typeof d;
}

/** The latest provider value, read by the tests after each act(). */
const latest: { current?: ReturnType<typeof useMusic> } = {};
function Probe() {
  const music = useMusic();
  useEffect(() => {
    latest.current = music;
  });
  return null;
}
const ctxOf = () => latest.current!;

async function mount(spotify: MusicService) {
  const services = { spotify, 'apple-music': fake({ provider: 'apple-music', availability: () => ({ ok: false, reason: 'needs-full-app' }) }) } as MusicServices;
  await render(
    <CatalogProvider>
      <MusicConnectionsProvider services={services}>
        <Probe />
      </MusicConnectionsProvider>
    </CatalogProvider>,
  );
  await act(async () => {});
}

const saved = async () => JSON.parse((await AsyncStorage.getItem(MUSIC_STORAGE_KEY)) ?? '{}');

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('music connections provider', () => {
  it('a successful connection signs in, reads the library and keeps only the normalised import', async () => {
    const s = fake();
    await mount(s);
    await act(async () => void (await ctxOf().connect('spotify')));
    expect(ctxOf().state.spotify).toMatchObject({ connected: true, syncing: false });
    expect(ctxOf().state.spotify?.snapshot?.artists.map((a) => a.name)).toEqual(['Subtronics', 'Levity']);
    expect(ctxOf().imported.matched).toBe(2);
    const stored = JSON.stringify(await saved());
    expect(stored).not.toMatch(/token|code|verifier/i);
  });

  it('shows connecting while the sign-in sheet is open, and a second tap does nothing', async () => {
    const hold = deferred<ConnectResult>();
    const s = fake({ connect: jest.fn(() => hold.promise) });
    await mount(s);
    let first!: Promise<unknown>;
    await act(async () => {
      first = ctxOf().connect('spotify');
    });
    expect(ctxOf().connecting).toEqual(['spotify']);
    await act(async () => expect(await ctxOf().connect('spotify')).toBe('cancelled'));
    expect(s.connect).toHaveBeenCalledTimes(1);
    await act(async () => {
      hold.resolve({ ok: true });
      await first;
    });
    expect(ctxOf().connecting).toEqual([]);
    expect(ctxOf().state.spotify?.connected).toBe(true);
  });

  it('a failed or cancelled sign-in leaves nothing behind', async () => {
    const s = fake({ connect: jest.fn(async (): Promise<ConnectResult> => ({ ok: false, reason: 'denied' })) });
    await mount(s);
    await act(async () => expect(await ctxOf().connect('spotify')).toBe('denied'));
    expect(ctxOf().state.spotify).toBeUndefined();
    expect(ctxOf().connecting).toEqual([]);
    expect(s.fetchLibrary).not.toHaveBeenCalled();
  });

  it('a sign-in that throws is reported, never stuck on connecting', async () => {
    const s = fake({ connect: jest.fn(async (): Promise<ConnectResult> => { throw new Error('boom'); }) });
    await mount(s);
    await act(async () => expect(await ctxOf().connect('spotify')).toBe('unknown'));
    expect(ctxOf().connecting).toEqual([]);
  });

  it('duplicate sync requests share one read', async () => {
    const hold = deferred<MusicLibrarySnapshot>();
    const s = fake();
    await mount(s);
    await act(async () => void (await ctxOf().connect('spotify')));
    s.fetchLibrary.mockImplementationOnce(() => hold.promise);
    let a!: Promise<void>, b!: Promise<void>;
    await act(async () => {
      a = ctxOf().sync('spotify');
      b = ctxOf().sync('spotify');
    });
    expect(a).toBe(b);
    expect(ctxOf().state.spotify?.syncing).toBe(true);
    await act(async () => {
      hold.resolve(snap(['Excision']));
      await a;
    });
    expect(s.fetchLibrary).toHaveBeenCalledTimes(2); // the connect's read, then one shared re-read
    expect(ctxOf().state.spotify?.snapshot?.artists.map((x) => x.name)).toEqual(['Excision']);
    // A new sync after that one finished reads again.
    await act(async () => void (await ctxOf().sync('spotify')));
    expect(s.fetchLibrary).toHaveBeenCalledTimes(3);
  });

  it('a failed sync keeps the last good import and says why', async () => {
    const s = fake();
    await mount(s);
    await act(async () => void (await ctxOf().connect('spotify')));
    s.fetchLibrary.mockImplementationOnce(async () => {
      throw new MusicServiceError('network');
    });
    await act(async () => void (await ctxOf().sync('spotify')));
    expect(ctxOf().state.spotify).toMatchObject({ connected: true, syncing: false, error: 'network' });
    expect(ctxOf().state.spotify?.snapshot?.artists).toHaveLength(2);
  });

  it('expired access asks to connect again but keeps the import until you disconnect', async () => {
    const s = fake();
    await mount(s);
    await act(async () => void (await ctxOf().connect('spotify')));
    s.fetchLibrary.mockImplementationOnce(async () => {
      throw new MusicServiceError('expired');
    });
    await act(async () => void (await ctxOf().sync('spotify')));
    expect(ctxOf().state.spotify).toMatchObject({ connected: false, error: 'expired' });
    expect(ctxOf().imported.matched).toBe(2);
  });

  it('disconnecting removes the import from memory and storage, and forgets the sign-in', async () => {
    const s = fake();
    await mount(s);
    await act(async () => void (await ctxOf().connect('spotify')));
    expect((await saved()).spotify).toBeDefined();
    await act(async () => void (await ctxOf().disconnect('spotify')));
    expect(ctxOf().state.spotify).toBeUndefined();
    expect(ctxOf().imported.matched).toBe(0);
    expect(ctxOf().library).toEqual([]);
    expect(await AsyncStorage.getItem(MUSIC_STORAGE_KEY)).toBeNull();
    expect(s.disconnect).toHaveBeenCalled();
  });

  it('a read that finishes after disconnecting is dropped', async () => {
    const hold = deferred<MusicLibrarySnapshot>();
    const s = fake();
    await mount(s);
    await act(async () => void (await ctxOf().connect('spotify')));
    s.fetchLibrary.mockImplementationOnce(() => hold.promise);
    let read!: Promise<void>;
    await act(async () => {
      read = ctxOf().sync('spotify');
    });
    await act(async () => void (await ctxOf().disconnect('spotify')));
    await act(async () => {
      hold.resolve(snap(['Excision']));
      await read;
    });
    expect(ctxOf().state.spotify).toBeUndefined();
    expect(await AsyncStorage.getItem(MUSIC_STORAGE_KEY)).toBeNull();
  });

  it('a read that refreshes the sign-in after you disconnected doesn’t leave it behind', async () => {
    // A real keychain: disconnect clears it, then the running read's token refresh writes it back.
    const keychain = new Map<string, string>();
    const hold = deferred<MusicLibrarySnapshot>();
    const s = fake({
      connect: jest.fn(async (): Promise<ConnectResult> => {
        keychain.set('spotify', 'session-1');
        return { ok: true };
      }),
      disconnect: jest.fn(async () => void keychain.delete('spotify')),
    });
    await mount(s);
    await act(async () => void (await ctxOf().connect('spotify')));
    s.fetchLibrary.mockImplementationOnce(() => hold.promise.then((snapshot) => (keychain.set('spotify', 'session-2'), snapshot)));
    let read!: Promise<void>;
    await act(async () => {
      read = ctxOf().sync('spotify');
    });
    await act(async () => void (await ctxOf().disconnect('spotify')));
    expect(keychain.size).toBe(0);
    await act(async () => {
      hold.resolve(snap(['Excision']));
      await read;
    });
    expect(keychain.size).toBe(0);
    expect(ctxOf().state.spotify).toBeUndefined();
  });

  it('disconnecting while a reconnect’s sign-in is open forgets what that sign-in stored', async () => {
    const s = fake();
    await mount(s);
    await act(async () => void (await ctxOf().connect('spotify')));
    const hold = deferred<ConnectResult>();
    s.connect.mockImplementationOnce(() => hold.promise);
    let reconnect!: Promise<unknown>;
    await act(async () => {
      reconnect = ctxOf().connect('spotify');
    });
    await act(async () => void (await ctxOf().disconnect('spotify')));
    const before = s.disconnect.mock.calls.length;
    await act(async () => {
      hold.resolve({ ok: true });
      expect(await reconnect).toBe('cancelled');
    });
    expect(s.disconnect.mock.calls.length).toBe(before + 1);
    expect(ctxOf().state.spotify).toBeUndefined();
  });

  it('on launch, a sign-in left in the secure store with no connection is forgotten', async () => {
    const s = fake();
    await mount(s);
    expect(s.disconnect).toHaveBeenCalledTimes(1);
  });

  it('on launch, a connected library with no import yet, or older than a day, is read again; a fresh one is not', async () => {
    const old = new Date(Date.now() - 2 * 24 * 3600_000).toISOString();
    await AsyncStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify({ spotify: { provider: 'spotify', connected: true, syncing: false, snapshot: snap(['Subtronics'], old) } }));
    const stale = fake();
    await mount(stale);
    expect(stale.fetchLibrary).toHaveBeenCalledTimes(1);
    expect(stale.disconnect).not.toHaveBeenCalled();

    await AsyncStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify({ spotify: { provider: 'spotify', connected: true, syncing: false } }));
    const empty = fake();
    await mount(empty);
    expect(empty.fetchLibrary).toHaveBeenCalledTimes(1);

    await AsyncStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify({ spotify: { provider: 'spotify', connected: true, syncing: false, snapshot: snap(['Subtronics']) } }));
    const fresh = fake();
    await mount(fresh);
    expect(fresh.fetchLibrary).not.toHaveBeenCalled();
  });
});
