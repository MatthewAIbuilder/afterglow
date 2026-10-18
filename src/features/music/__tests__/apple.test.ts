import { describe, expect, it } from '@jest/globals';
import { appleMusicClient, readAppleMusicLibrary } from '../apple/api';
import { MusicKitError, musicKitProblem, noMusicKit, type AppleMusicAuthorizer } from '../apple/musicKit';
import { connectProblem } from '../copy';
import { readAuthorization } from '../apple/nativeMusicKit';
import { normalizeAppleMusic, type AppleMusicLibrary } from '../apple/normalize';
import { appleMusicService } from '../apple/service';
import { SECRET_KEY } from '../secrets';
import {
  APPLE_HEAVY_ROTATION,
  APPLE_LIBRARY_ARTISTS,
  APPLE_RECENT,
  APPLE_ROUTES,
  APPLE_SONGS_PAGE_1,
  APPLE_SONGS_PAGE_2,
  fakeFetch,
  memorySecrets,
} from './fixtures';

const AT = new Date('2026-09-29T12:00:00Z');
const TOKEN_URL = 'https://tokens.example/apple-music';

const library = (over: Partial<AppleMusicLibrary> = {}): AppleMusicLibrary => ({
  songs: [...APPLE_SONGS_PAGE_1.data, ...APPLE_SONGS_PAGE_2.data],
  artists: APPLE_LIBRARY_ARTISTS.data,
  heavyRotation: APPLE_HEAVY_ROTATION.data,
  recent: APPLE_RECENT.data,
  gaps: [],
  ...over,
});
const byName = (snap: ReturnType<typeof normalizeAppleMusic>, name: string) => snap.artists.find((a) => a.name === name);

describe('Apple Music library → artist signals', () => {
  it('aggregates library songs per artist, with albums and genres', () => {
    const snap = normalizeAppleMusic(library(), AT);
    const illenium = byName(snap, 'ILLENIUM')!;
    expect(illenium.savedTracks).toBe(3);
    expect(illenium.savedAlbums).toBe(2);
    expect(illenium.genres).toEqual(['dance', 'music']);
    expect(illenium.provider).toBe('apple-music');
    expect(snap.savedTracksRead).toBe(4);
  });

  it('library artists add Apple’s catalogue id to artists already there', () => {
    const snap = normalizeAppleMusic(library(), AT);
    expect(byName(snap, 'ILLENIUM')!.providerArtistId).toBe('1034567');
    expect(byName(snap, 'Sara Landry')!.genres).toEqual(['techno', 'electronic']);
    // A library artist with no songs read and no other signal doesn't become a record.
    expect(byName(snap, 'Someone Local')).toBeUndefined();
  });

  it('heavy rotation ranks artists (playlists skipped) and recent plays are marked', () => {
    const snap = normalizeAppleMusic(library(), AT);
    expect(byName(snap, 'ILLENIUM')!.topRank).toBe(1);
    expect(byName(snap, 'Tape B')!.topRank).toBe(2);
    expect(byName(snap, 'Sara Landry')!.recent).toBe(true);
    expect(byName(snap, 'John Summit')!.recent).toBe(true);
    expect(byName(snap, 'John Summit')!.savedTracks).toBe(0);
  });

  it('never claims a favourite: Apple doesn’t list them, so followed is unknown and a gap', () => {
    const snap = normalizeAppleMusic(library(), AT);
    expect(snap.artists.every((a) => a.followed === undefined)).toBe(true);
    expect(snap.gaps).toContain('followed');
  });

  it('copes with missing optional fields', () => {
    const odd = {
      songs: [{}, { attributes: null }, { attributes: { artistName: null } }, { id: 'x', attributes: { artistName: 'Solo', genreNames: null } }],
      artists: [{}, { relationships: { catalog: { data: [] } } }],
      heavyRotation: [{ type: 'albums' }, { attributes: {} }],
      recent: [null],
      gaps: [],
    } as unknown as AppleMusicLibrary;
    const snap = normalizeAppleMusic(odd, AT);
    expect(snap.artists.map((a) => a.name)).toEqual(['Solo']);
    expect(snap.artists[0].genres).toEqual([]);
  });

  it('keeps no song titles or album names', () => {
    const text = JSON.stringify(normalizeAppleMusic(library(), AT));
    expect(text).not.toContain('Crashing');
    expect(text).not.toContain('Fallen Embers');
    expect(text).not.toContain('Festival Warmup');
  });
});

describe('Apple Music client', () => {
  const get = (routes: Record<string, unknown>) =>
    appleMusicClient({ fetch: fakeFetch(routes as never).fetch, developerToken: 'dev', userToken: 'user' });

  it('reads every section with both tokens, following pages', async () => {
    const net = fakeFetch(APPLE_ROUTES);
    const lib = await readAppleMusicLibrary(appleMusicClient({ fetch: net.fetch, developerToken: 'dev', userToken: 'user' }));
    expect(lib.songs).toHaveLength(5);
    expect(lib.artists).toHaveLength(3);
    expect(lib.gaps).toEqual([]);
    expect(net.calls.every((c) => c.init?.headers?.Authorization === 'Bearer dev' && c.init?.headers?.['Music-User-Token'] === 'user')).toBe(true);
  });

  it('a missing section (404) is a gap', async () => {
    const lib = await readAppleMusicLibrary(get({ ...APPLE_ROUTES, 'https://api.music.apple.com/v1/me/history/heavy-rotation?limit=10': { status: 404 } }));
    expect(lib.gaps).toEqual(['top']);
  });

  it('403 means the permission is gone (`expired`); 401 means the developer token is wrong (`unavailable`)', async () => {
    await expect(readAppleMusicLibrary(get({ ...APPLE_ROUTES, 'https://api.music.apple.com/v1/me/library/songs?limit=100': { status: 403 } }))).rejects.toMatchObject({ kind: 'expired' });
    await expect(readAppleMusicLibrary(get({ ...APPLE_ROUTES, 'https://api.music.apple.com/v1/me/library/songs?limit=100': { status: 401 } }))).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('never follows a link off the Apple Music API', async () => {
    const routes = { ...APPLE_ROUTES, 'https://api.music.apple.com/v1/me/library/songs?limit=100': { status: 200, body: { ...APPLE_SONGS_PAGE_1, next: 'https://evil.example/x' } } };
    await expect(readAppleMusicLibrary(get(routes))).rejects.toMatchObject({ kind: 'unknown' });
  });
});

describe('Apple Music service', () => {
  const authorizer = (result: Awaited<ReturnType<AppleMusicAuthorizer['authorize']>>): AppleMusicAuthorizer => ({
    isSupported: () => true,
    authorize: async () => result,
  });
  const make = (over: Partial<Parameters<typeof appleMusicService>[0]> = {}) => {
    const secrets = memorySecrets();
    const net = fakeFetch({ ...APPLE_ROUTES, [TOKEN_URL]: { status: 200, body: { token: 'dev' } } });
    const service = appleMusicService({
      authorizer: authorizer({ status: 'authorized', userToken: 'user-token' }),
      tokenUrl: TOKEN_URL,
      secrets,
      fetch: net.fetch,
      isIOS: true,
      ...over,
    });
    return { service, secrets, net };
  };

  it('says honestly when it can’t connect', () => {
    expect(make({ isIOS: false }).service.availability()).toEqual({ ok: false, reason: 'not-on-this-device' });
    // This build ships without MusicKit (Expo Go): the full app is needed.
    expect(make({ authorizer: noMusicKit }).service.availability()).toEqual({ ok: false, reason: 'needs-full-app' });
    expect(make({ tokenUrl: '' }).service.availability()).toEqual({ ok: false, reason: 'not-set-up' });
    expect(make().service.availability()).toEqual({ ok: true });
  });

  it('without MusicKit, connect never pretends to succeed', async () => {
    const { service, secrets } = make({ authorizer: noMusicKit });
    expect(await service.connect()).toEqual({ ok: false, reason: 'unavailable' });
    expect(secrets.items.size).toBe(0);
  });

  it('a permission refused in Apple’s prompt is `denied` and stores nothing', async () => {
    const { service, secrets } = make({ authorizer: authorizer({ status: 'denied' }) });
    expect(await service.connect()).toEqual({ ok: false, reason: 'denied' });
    expect(secrets.items.size).toBe(0);
  });

  it('connects, reads an Apple Music snapshot, and disconnecting forgets the permission', async () => {
    const { service, secrets } = make();
    expect(await service.connect()).toEqual({ ok: true });
    expect(secrets.items.get(SECRET_KEY['apple-music'])).toBe('user-token');
    const snap = await service.fetchLibrary(AT);
    expect(snap.provider).toBe('apple-music');
    expect(snap.artists.every((a) => a.provider === 'apple-music')).toBe(true);
    await service.disconnect();
    expect(secrets.items.size).toBe(0);
  });

  it('a permission removed since forgets the stored token and reports `expired`', async () => {
    const secrets = memorySecrets();
    await secrets.set(SECRET_KEY['apple-music'], 'old');
    const net = fakeFetch({ ...APPLE_ROUTES, [TOKEN_URL]: { status: 200, body: { token: 'dev' } }, 'https://api.music.apple.com/v1/me/library/songs?limit=100': { status: 403 } });
    const service = appleMusicService({ authorizer: authorizer({ status: 'denied' }), tokenUrl: TOKEN_URL, secrets, fetch: net.fetch, isIOS: true });
    await expect(service.fetchLibrary(AT)).rejects.toMatchObject({ kind: 'expired' });
    expect(secrets.items.size).toBe(0);
  });

  it('with MusicKit’s own developer token, no token link is needed', async () => {
    const asked: string[] = [];
    const musicKit: AppleMusicAuthorizer = {
      isSupported: () => true,
      developerToken: async () => 'musickit-dev',
      authorize: async (dev) => {
        asked.push(dev);
        return { status: 'authorized', userToken: 'user-token' };
      },
    };
    const { service, net } = make({ authorizer: musicKit, tokenUrl: '' });
    expect(service.availability()).toEqual({ ok: true });
    expect(await service.connect()).toEqual({ ok: true });
    expect(asked).toEqual(['musickit-dev']);
    await service.fetchLibrary(AT);
    expect(net.calls.some((c) => c.url === TOKEN_URL)).toBe(false);
  });

  it('MusicKit giving no developer token (MusicKit off for the app) can’t connect', async () => {
    const musicKit: AppleMusicAuthorizer = { isSupported: () => true, developerToken: async () => Promise.reject(new Error('no')), authorize: async () => ({ status: 'authorized', userToken: 'x' }) };
    const { service, secrets } = make({ authorizer: musicKit, tokenUrl: '' });
    // Said as such ("Apple hasn't switched on Apple Music for Afterglow yet"), not as "not available".
    expect(await service.connect()).toEqual({ ok: false, reason: 'not-ready' });
    expect(secrets.items.size).toBe(0);
  });
});

describe('MusicKit’s answer', () => {
  it('a user token only counts when it’s there', () => {
    expect(readAuthorization({ status: 'authorized', userToken: 'u' })).toEqual({ status: 'authorized', userToken: 'u' });
    expect(readAuthorization({ status: 'authorized' })).toEqual({ status: 'cancelled' });
    expect(readAuthorization({ status: 'denied' })).toEqual({ status: 'denied' });
    expect(readAuthorization({ status: 'restricted' })).toEqual({ status: 'restricted' });
    expect(readAuthorization(null)).toEqual({ status: 'cancelled' });
  });
});

describe('why Apple Music didn’t connect', () => {
  it('MusicKit’s errors, as something the person can fix', () => {
    expect(musicKitProblem('developerToken: MusicTokenRequestError.developerTokenRequestFailed')).toBe('not-ready');
    expect(musicKitProblem('privacyAcknowledgementRequired')).toBe('music-app');
    expect(musicKitProblem('userNotSignedIn')).toBe('signed-out');
    expect(musicKitProblem('no-library')).toBe('no-library');
    expect(musicKitProblem('something else')).toBe('unknown');
    expect(readAuthorization({ status: 'failed', reason: 'privacyAcknowledgementRequired' })).toEqual({ status: 'failed', problem: 'music-app' });
  });

  it('connect says which: no developer token, no library', async () => {
    const secrets = memorySecrets();
    const net = fakeFetch(APPLE_ROUTES);
    const noToken: AppleMusicAuthorizer = { isSupported: () => true, developerToken: async () => Promise.reject(new MusicKitError('not-ready')), authorize: async () => ({ status: 'authorized', userToken: 'x' }) };
    expect(await appleMusicService({ authorizer: noToken, tokenUrl: '', secrets, fetch: net.fetch, isIOS: true }).connect()).toEqual({ ok: false, reason: 'not-ready' });
    const noLibrary: AppleMusicAuthorizer = { isSupported: () => true, developerToken: async () => 'dev', authorize: async () => ({ status: 'failed', problem: 'no-library' }) };
    expect(await appleMusicService({ authorizer: noLibrary, tokenUrl: '', secrets, fetch: net.fetch, isIOS: true }).connect()).toEqual({ ok: false, reason: 'no-library' });
    expect(secrets.items.size).toBe(0);
    expect(connectProblem('apple-music', 'music-app')).toBe('Open the Music app once and accept Apple’s welcome screen, then try again.');
  });
});

