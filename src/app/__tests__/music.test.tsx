import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { MusicLibrarySnapshot, MusicProviderId } from '../../features/music/models';
import { MusicServiceError, type MusicAvailability, type MusicService } from '../../features/music/service';
import { renderApp } from './appRoutes';

/**
 * Music connections, through the real routes and providers. The services are
 * test doubles: nothing here signs in to or calls Spotify or Apple Music, and
 * no real account or credential is involved.
 */
const mockServices: Partial<Record<MusicProviderId, MusicService>> = {};
jest.mock('../../features/music/services', () => ({ defaultMusicServices: () => mockServices }));

const snapshot = (provider: MusicProviderId, names: string[]): MusicLibrarySnapshot => ({
  version: 1,
  provider,
  syncedAt: new Date().toISOString(),
  artists: names.map((name, i) => ({
    provider,
    name,
    key: name.toLowerCase(),
    savedTracks: 6 - i,
    savedAlbums: 1,
    followed: i === 0 ? true : undefined,
    genres: [],
    sources: ['saved'],
  })),
  savedTracksRead: 10,
  gaps: [],
});

function service(provider: MusicProviderId, over: Partial<MusicService> = {}): MusicService & Record<string, any> {
  return {
    provider,
    availability: (): MusicAvailability => ({ ok: true }),
    connect: jest.fn(async () => ({ ok: true as const })),
    fetchLibrary: jest.fn(async () => snapshot(provider, ['Subtronics', 'Levity', 'Nobody On A Lineup'])),
    disconnect: jest.fn(async () => {}),
    ...over,
  };
}


const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(50);
    await Promise.resolve();
  });

/** A Spotify library already connected and synced on this phone. */
const storeConnected = () =>
  AsyncStorage.setItem(
    'musicLibrary.v1',
    JSON.stringify({ spotify: { provider: 'spotify', connected: true, syncing: false, snapshot: snapshot('spotify', ['Subtronics', 'Levity']) } }),
  );

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockServices.spotify = service('spotify');
  mockServices['apple-music'] = service('apple-music', { availability: () => ({ ok: false, reason: 'needs-full-app' }) });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('Music connections', () => {
  it('opens from Profile and shows the disconnected state, explained plainly', async () => {
    const app = await renderApp('/profile');
    await settle();
    await fireEvent.press(app.getByLabelText('Music connections, none connected'));
    await settle();
    expect(app.getByText(/^Start your map from the artists you already play\. What you do in Afterglow still counts for more\.$/)).toBeTruthy();
    expect(app.getByText('What Afterglow reads')).toBeTruthy();
    expect(app.getByText(/Your password, your account details, your playlists/)).toBeTruthy();
    expect(app.getByLabelText(/^Spotify\. Not connected\. Not connected\./)).toBeTruthy();
    expect(app.getByLabelText('Connect Spotify')).toBeTruthy();
    // Apple Music can't connect in this build: it says so, with no Connect button.
    expect(app.getByText('Needs the full version of Afterglow. It can’t connect in this preview.')).toBeTruthy();
    expect(app.queryByLabelText('Connect Apple Music')).toBeNull();
  });

  it('a service that isn’t set up, or Expo Go, offers nothing to press', async () => {
    mockServices.spotify = service('spotify', { availability: () => ({ ok: false, reason: 'not-set-up' }) });
    const app = await renderApp('/music');
    await settle();
    expect(app.getByText('Not available in this version of Afterglow yet.')).toBeTruthy();
    expect(app.queryByLabelText('Connect Spotify')).toBeNull();
  });

  it('connecting shows Connecting, then reads the library, shows the stats, and My Sound starts from it', async () => {
    let signedIn: (r: { ok: true }) => void = () => {};
    mockServices.spotify = service('spotify', { connect: jest.fn(() => new Promise<{ ok: true }>((resolve) => (signedIn = resolve))) });
    const app = await renderApp('/music');
    await settle();
    await fireEvent.press(app.getByLabelText('Connect Spotify'));
    await settle();
    expect(app.getByText('Connecting to Spotify…')).toBeTruthy();
    expect(app.getByText('Connecting')).toBeTruthy();
    await act(async () => signedIn({ ok: true }));
    await settle();
    expect(mockServices.spotify!.connect).toHaveBeenCalledTimes(1);
    expect(mockServices.spotify!.fetchLibrary).toHaveBeenCalledTimes(1);
    expect(app.getByText('Connected to Spotify')).toBeTruthy();
    expect(app.getByText('Synced')).toBeTruthy();
    expect(app.getByText('just now')).toBeTruthy();
    expect(app.getByText('artists analyzed')).toBeTruthy();
    expect(app.getByText('on upcoming festivals')).toBeTruthy();
    expect(app.getByLabelText(/Artists analyzed 3\. On upcoming festivals 2$/i)).toBeTruthy();
    const saved = JSON.parse((await AsyncStorage.getItem('musicLibrary.v1')) ?? '{}');
    expect(saved.spotify.snapshot.artists).toHaveLength(3);
    // No credentials in normal storage.
    expect(JSON.stringify(saved)).not.toMatch(/token/i);

    const sound = await renderApp('/sound');
    await settle();
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(sound.getByText(/^Shaped by your Spotify library\. Leaning [a-z ]+\.$/)).toBeTruthy();
  });

  it('a sign-in that didn’t finish says why, and leaves nothing connected', async () => {
    mockServices.spotify = service('spotify', { connect: jest.fn(async () => ({ ok: false as const, reason: 'network' as const })) });
    const app = await renderApp('/music');
    await settle();
    await fireEvent.press(app.getByLabelText('Connect Spotify'));
    await settle();
    expect(app.getByText('Couldn’t reach Spotify. Check your connection and try again.')).toBeTruthy();
    expect(app.getByLabelText('Connect Spotify')).toBeTruthy();
    expect(mockServices.spotify!.fetchLibrary).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('musicLibrary.v1')).toBeNull();
  });

  it('shows the syncing state while the library is being read', async () => {
    let finish: (s: MusicLibrarySnapshot) => void = () => {};
    mockServices.spotify = service('spotify', {
      fetchLibrary: jest.fn(() => new Promise<MusicLibrarySnapshot>((resolve) => (finish = resolve))),
    });
    const app = await renderApp('/music');
    await settle();
    await fireEvent.press(app.getByLabelText('Connect Spotify'));
    await settle();
    expect(app.getByText('Reading your library…')).toBeTruthy();
    expect(app.getByText('Syncing')).toBeTruthy();
    expect(app.queryByLabelText('Sync now, Spotify')).toBeNull();
    await act(async () => finish(snapshot('spotify', ['Subtronics'])));
    await settle();
    expect(app.getByText('artist analyzed')).toBeTruthy();
  });

  it('Sync now reads again; a second tap while it runs doesn’t start another read', async () => {
    await storeConnected();
    let finish: (s: MusicLibrarySnapshot) => void = () => {};
    mockServices.spotify = service('spotify', {
      fetchLibrary: jest.fn(() => new Promise<MusicLibrarySnapshot>((resolve) => (finish = resolve))),
    });
    const app = await renderApp('/music');
    await settle();
    const button = app.getByLabelText('Sync now, Spotify');
    await fireEvent.press(button);
    await fireEvent.press(button);
    await settle();
    expect(mockServices.spotify!.fetchLibrary).toHaveBeenCalledTimes(1);
    expect(app.getByText('Syncing your library…')).toBeTruthy();
    await act(async () => finish(snapshot('spotify', ['Subtronics', 'Levity', 'Excision'])));
    await settle();
    expect(app.getByText('Connected to Spotify')).toBeTruthy();
  });

  it('a failed sync says so and keeps the last import', async () => {
    await storeConnected();
    mockServices.spotify = service('spotify', {
      fetchLibrary: jest.fn(async () => {
        throw new MusicServiceError('network');
      }),
    });
    const app = await renderApp('/music');
    await settle();
    expect(app.getByText('Connected to Spotify')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Sync now, Spotify'));
    await settle();
    expect(app.getByText('Sync failed')).toBeTruthy();
    expect(app.getByText('Couldn’t sync your library')).toBeTruthy();
    expect(app.getByText('Couldn’t reach Spotify. Check your connection and try again. Your last import is still used until you disconnect.')).toBeTruthy();
    expect(app.getByLabelText('Try again, Spotify')).toBeTruthy();
    const saved = JSON.parse((await AsyncStorage.getItem('musicLibrary.v1')) ?? '{}');
    expect(saved.spotify.snapshot.artists.map((a: { name: string }) => a.name)).toEqual(['Subtronics', 'Levity']);
  });

  it('an expired or revoked sign-in asks you to sign in again', async () => {
    await storeConnected();
    mockServices.spotify = service('spotify', {
      fetchLibrary: jest.fn(async () => {
        throw new MusicServiceError('expired');
      }),
    });
    const app = await renderApp('/music');
    await settle();
    await fireEvent.press(app.getByLabelText('Sync now, Spotify'));
    await settle();
    expect(app.getByText('Spotify needs you to sign in again')).toBeTruthy();
    expect(app.getByText('Access ended or was removed. Your last import is still used until you disconnect.')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Sign in again, Spotify'));
    await settle();
    expect(mockServices.spotify!.connect).toHaveBeenCalledTimes(1);
  });

  it('disconnecting removes the imported music and forgets the sign-in', async () => {
    await storeConnected();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    const app = await renderApp('/music');
    await settle();
    await fireEvent.press(app.getByLabelText('Disconnect Spotify and remove imported music data'));
    await settle();
    expect(alert).toHaveBeenCalledWith(
      'Disconnect Spotify?',
      expect.stringMatching(/Everything Afterglow imported from Spotify is removed[\s\S]*spotify\.com\/account\/apps/),
      expect.any(Array),
    );
    expect(mockServices.spotify!.disconnect).toHaveBeenCalledTimes(1);
    expect(app.getByLabelText('Connect Spotify')).toBeTruthy();
    expect(app.queryByText('artists analyzed')).toBeNull();
    expect(await AsyncStorage.getItem('musicLibrary.v1')).toBeNull();
  });
});

describe('My Sound with connected music', () => {
  it('offers to connect when you have nothing yet', async () => {
    const app = await renderApp('/sound');
    await settle();
    expect(app.getByText('Connect Spotify to start your map from what you already play.')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Connect your music'));
    await settle();
    expect(app.getByText('Music connections')).toBeTruthy();
  });

  it('says so when few of your artists are on Afterglow, without filling the map', async () => {
    await AsyncStorage.setItem(
      'musicLibrary.v1',
      JSON.stringify({ spotify: { provider: 'spotify', connected: true, syncing: false, snapshot: snapshot('spotify', ['Subtronics', 'Nobody On A Lineup']) } }),
    );
    const app = await renderApp('/sound');
    await settle();
    expect(app.getByText('Only 1 of your Spotify artists plays Afterglow’s lineups so far. React to clips to place more.')).toBeTruthy();
  });

  it('an artist from your library says where the match comes from', async () => {
    await storeConnected();
    const app = await renderApp('/artist/subtronics');
    await settle();
    expect(app.getByText('From your Spotify library')).toBeTruthy();
    // EXCISION isn't in the library, but sounds like it.
    const near = await renderApp('/artist/excision');
    await settle();
    expect(near.getByText('Close to artists in your Spotify library')).toBeTruthy();
  });

  it('starting over keeps connected music, and says so', async () => {
    await storeConnected();
    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ levity: 'love' }));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    const app = await renderApp('/sound');
    await settle();
    await fireEvent.press(app.getByLabelText('Start your sound over'));
    await settle();
    expect(alert).toHaveBeenCalledWith(expect.any(String), expect.stringMatching(/Your Spotify library stays connected/), expect.any(Array));
    expect(JSON.parse((await AsyncStorage.getItem('musicLibrary.v1')) ?? '{}').spotify.snapshot.artists).toHaveLength(2);
  });
});
