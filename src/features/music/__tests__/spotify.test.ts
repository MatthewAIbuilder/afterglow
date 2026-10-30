import { describe, expect, it, jest } from '@jest/globals';
import { SECRET_KEY } from '../secrets';
import { MusicServiceError } from '../service';
import { readSpotifyLibrary, spotifyClient, SPOTIFY_API } from '../spotify/api';
import { normalizeSpotify, type SpotifyLibrary } from '../spotify/normalize';
import { spotifyService } from '../spotify/service';
import { SPOTIFY_ENDPOINTS, SPOTIFY_SCOPES, type SpotifySession } from '../spotify/tokens';
import {
  fakeFetch,
  memorySecrets,
  SPOTIFY_FOLLOWING,
  SPOTIFY_ROUTES,
  SPOTIFY_SAVED_PAGE_1,
  SPOTIFY_SAVED_PAGE_2,
  SPOTIFY_TOKEN,
  SPOTIFY_TOP_MEDIUM,
  SPOTIFY_TOP_SHORT,
} from './fixtures';

const AT = new Date('2026-09-29T12:00:00Z');
const NOW = AT.getTime();

const library = (over: Partial<SpotifyLibrary> = {}): SpotifyLibrary => ({
  saved: [...SPOTIFY_SAVED_PAGE_1.items, ...SPOTIFY_SAVED_PAGE_2.items],
  followed: SPOTIFY_FOLLOWING.artists.items,
  top: SPOTIFY_TOP_MEDIUM.items,
  recent: SPOTIFY_TOP_SHORT.items,
  gaps: [],
  ...over,
});
const byName = (snap: ReturnType<typeof normalizeSpotify>, name: string) => snap.artists.find((a) => a.name === name);

describe('Spotify library → artist signals', () => {
  it('aggregates saved songs per artist, each song once, with albums', () => {
    const snap = normalizeSpotify(library(), AT);
    const illenium = byName(snap, 'Illenium')!;
    // Three different songs (one appears on both pages), from two albums.
    expect(illenium.savedTracks).toBe(3);
    expect(illenium.savedAlbums).toBe(2);
    expect(illenium.providerArtistId).toBe('sp-illenium');
    expect(illenium.key).toBe('illenium');
    expect(snap.provider).toBe('spotify');
    expect(snap.syncedAt).toBe('2026-09-29T12:00:00.000Z');
  });

  it('marks followed artists and keeps their genres', () => {
    const snap = normalizeSpotify(library(), AT);
    const subtronics = byName(snap, 'Subtronics')!;
    expect(subtronics.followed).toBe(true);
    expect(subtronics.genres).toEqual(['riddim', 'dubstep']);
    expect(subtronics.sources).toEqual(expect.arrayContaining(['saved', 'followed', 'top']));
    expect(byName(snap, 'John Summit')!.followed).toBe(true);
    // Illenium isn't followed: the answer is simply unset, nothing is guessed.
    expect(byName(snap, 'Illenium')!.followed).toBeUndefined();
  });

  it('ranks top artists and marks recent ones', () => {
    const snap = normalizeSpotify(library(), AT);
    expect(byName(snap, 'Illenium')!.topRank).toBe(1);
    expect(byName(snap, 'Seven Lions')!.topRank).toBe(3);
    expect(byName(snap, 'LEVITY')!.recent).toBe(true);
    expect(byName(snap, 'Illenium')!.recent).toBe(true);
    expect(byName(snap, 'Hozier')!.recent).toBeUndefined();
  });

  it('credits every artist on a collab, and one artist appears once however many sections name them', () => {
    const snap = normalizeSpotify(library(), AT);
    expect(byName(snap, 'Excision')!.savedTracks).toBe(1);
    expect(snap.artists.filter((a) => a.key === 'subtronics')).toHaveLength(1);
    expect(new Set(snap.artists.map((a) => a.key)).size).toBe(snap.artists.length);
  });

  it('copes with local files, removed songs and missing genres', () => {
    const snap = normalizeSpotify(library(), AT);
    expect(byName(snap, 'Tape B')!.savedTracks).toBe(1);
    expect(byName(snap, 'Tape B')!.providerArtistId).toBeUndefined();
    expect(byName(snap, 'Hozier')!.genres).toEqual([]);
    expect(byName(snap, 'LEVITY')!.genres).toEqual([]);
    // 7 saved items, one of them null and one a repeat of a song already read.
    expect(snap.savedTracksRead).toBe(7);
  });

  it('never crashes on missing optional fields or an empty library', () => {
    const odd = {
      saved: [{}, { track: {} }, { track: { artists: null } }, { track: { id: 'x', artists: [null, { name: '' }, { id: 'y' }] } }],
      followed: [null, {}, { id: 'z' }],
      top: [{ name: null }],
      recent: [undefined],
      gaps: [],
    } as unknown as SpotifyLibrary;
    expect(() => normalizeSpotify(odd, AT)).not.toThrow();
    expect(normalizeSpotify(odd, AT).artists).toEqual([]);
    expect(normalizeSpotify({ saved: [], followed: [], top: [], recent: [], gaps: [] }, AT).artists).toEqual([]);
  });

  it('keeps only names, ids, counts and genres: no song titles or album names', () => {
    const text = JSON.stringify(normalizeSpotify(library(), AT));
    expect(text).not.toContain('Good Things Fall Apart');
    expect(text).not.toContain('Ascend');
    expect(text).not.toContain('added_at');
  });

  it('puts the strongest artists first', () => {
    const snap = normalizeSpotify(library(), AT);
    expect(snap.artists[0].name).toBe('Subtronics'); // followed, saved and top
    expect(snap.artists.slice(0, 2).map((a) => a.name)).toContain('Illenium');
  });
});

const session = (over: Partial<SpotifySession> = {}): SpotifySession => ({
  accessToken: 'fixture-access-0',
  refreshToken: 'fixture-refresh-0',
  expiresAt: NOW + 3_600_000,
  ...over,
});

function sessions(initial: SpotifySession | null) {
  const store = { current: initial, cleared: false };
  return {
    store,
    load: async () => store.current,
    save: async (s: SpotifySession) => void (store.current = s),
    clear: async () => {
      store.current = null;
      store.cleared = true;
    },
  };
}

describe('Spotify client', () => {
  it('reads every section, following pages, with the access token', async () => {
    const net = fakeFetch(SPOTIFY_ROUTES);
    const client = spotifyClient({ fetch: net.fetch, sessions: sessions(session()), clientId: 'cid', now: () => NOW });
    const lib = await readSpotifyLibrary(client.get);
    expect(lib.saved).toHaveLength(8);
    expect(lib.followed).toHaveLength(2);
    expect(lib.top).toHaveLength(4);
    expect(lib.recent).toHaveLength(2);
    expect(lib.gaps).toEqual([]);
    expect(net.calls.every((c) => c.init?.headers?.Authorization === 'Bearer fixture-access-0')).toBe(true);
  });

  it('refreshes a token that is about to run out, and keeps the new one', async () => {
    const net = fakeFetch({ ...SPOTIFY_ROUTES, [SPOTIFY_ENDPOINTS.tokenEndpoint]: { status: 200, body: { ...SPOTIFY_TOKEN, refresh_token: undefined } } });
    const s = sessions(session({ expiresAt: NOW + 10_000 }));
    const client = spotifyClient({ fetch: net.fetch, sessions: s, clientId: 'cid', now: () => NOW });
    await readSpotifyLibrary(client.get);
    const refresh = net.calls.find((c) => c.url === SPOTIFY_ENDPOINTS.tokenEndpoint)!;
    expect(refresh.init?.body).toContain('grant_type=refresh_token');
    expect(refresh.init?.body).toContain('client_id=cid');
    expect(refresh.init?.body).not.toContain('client_secret');
    // Spotify didn't send a new refresh token: the old one is kept.
    expect(s.store.current).toEqual({ accessToken: 'fixture-access-1', refreshToken: 'fixture-refresh-0', expiresAt: NOW + 3_600_000, scope: SPOTIFY_TOKEN.scope });
  });

  it('refreshes once when Spotify says the token is no longer valid', async () => {
    const net = fakeFetch({
      ...SPOTIFY_ROUTES,
      [`${SPOTIFY_API}/me/tracks?limit=50`]: [{ status: 401 }, { status: 200, body: SPOTIFY_SAVED_PAGE_1 }],
      [SPOTIFY_ENDPOINTS.tokenEndpoint]: { status: 200, body: SPOTIFY_TOKEN },
    });
    const client = spotifyClient({ fetch: net.fetch, sessions: sessions(session()), clientId: 'cid', now: () => NOW });
    const lib = await readSpotifyLibrary(client.get);
    expect(lib.saved).toHaveLength(8);
  });

  it('a refused refresh (revoked access) is `expired` and forgets the session', async () => {
    const net = fakeFetch({ ...SPOTIFY_ROUTES, [SPOTIFY_ENDPOINTS.tokenEndpoint]: { status: 400, body: { error: 'invalid_grant' } } });
    const s = sessions(session({ expiresAt: NOW - 1 }));
    const client = spotifyClient({ fetch: net.fetch, sessions: s, clientId: 'cid', now: () => NOW });
    const e = await readSpotifyLibrary(client.get).catch((x) => x);
    expect(e).toBeInstanceOf(MusicServiceError);
    expect(e.kind).toBe('expired');
    expect(s.store.cleared).toBe(true);
    // No token or refresh token ever appears in an error.
    expect(String(e.message)).not.toMatch(/fixture-/);
  });

  it('with no session at all, reports `expired` without calling Spotify', async () => {
    const net = fakeFetch({});
    const client = spotifyClient({ fetch: net.fetch, sessions: sessions(null), clientId: 'cid', now: () => NOW });
    await expect(readSpotifyLibrary(client.get)).rejects.toMatchObject({ kind: 'expired' });
    expect(net.calls).toHaveLength(0);
  });

  it('a part Spotify refuses becomes a gap, not a failure', async () => {
    const net = fakeFetch({ ...SPOTIFY_ROUTES, [`${SPOTIFY_API}/me/following?type=artist&limit=50`]: { status: 403 } });
    const client = spotifyClient({ fetch: net.fetch, sessions: sessions(session()), clientId: 'cid', now: () => NOW });
    const lib = await readSpotifyLibrary(client.get);
    expect(lib.gaps).toEqual(['followed']);
    expect(lib.followed).toEqual([]);
    expect(lib.saved).toHaveLength(8);
  });

  it('every part refused is `denied`', async () => {
    const refused = Object.fromEntries(Object.keys(SPOTIFY_ROUTES).map((u) => [u, { status: 403 }]));
    const client = spotifyClient({ fetch: fakeFetch(refused).fetch, sessions: sessions(session()), clientId: 'cid', now: () => NOW });
    await expect(readSpotifyLibrary(client.get)).rejects.toMatchObject({ kind: 'denied' });
  });

  it('rate limits and outages fail the sync with their kind', async () => {
    const busy = fakeFetch({ ...SPOTIFY_ROUTES, [`${SPOTIFY_API}/me/tracks?limit=50`]: { status: 429 } });
    const c1 = spotifyClient({ fetch: busy.fetch, sessions: sessions(session()), clientId: 'cid', now: () => NOW });
    await expect(readSpotifyLibrary(c1.get)).rejects.toMatchObject({ kind: 'rate-limited' });
    const offline = spotifyClient({
      fetch: async () => {
        throw new Error('offline');
      },
      sessions: sessions(session()),
      clientId: 'cid',
      now: () => NOW,
    });
    await expect(readSpotifyLibrary(offline.get)).rejects.toMatchObject({ kind: 'network' });
  });

  it('never sends the token outside the Spotify API', async () => {
    const net = fakeFetch({
      ...SPOTIFY_ROUTES,
      [`${SPOTIFY_API}/me/tracks?limit=50`]: { status: 200, body: { ...SPOTIFY_SAVED_PAGE_1, next: 'https://evil.example/steal' } },
    });
    const client = spotifyClient({ fetch: net.fetch, sessions: sessions(session()), clientId: 'cid', now: () => NOW });
    await expect(readSpotifyLibrary(client.get)).rejects.toBeInstanceOf(MusicServiceError);
    expect(net.calls.some((c) => c.url.includes('evil'))).toBe(false);
  });

  it('asks only for the three read scopes it needs, and private playlists (Plan to playlist, only when you tap it)', () => {
    expect([...SPOTIFY_SCOPES].sort()).toEqual(['playlist-modify-private', 'user-follow-read', 'user-library-read', 'user-top-read']);
  });
});

describe('Spotify service', () => {
  const make = (over: Partial<Parameters<typeof spotifyService>[0]> = {}) => {
    const secrets = memorySecrets();
    const net = fakeFetch({ ...SPOTIFY_ROUTES, [SPOTIFY_ENDPOINTS.tokenEndpoint]: { status: 200, body: SPOTIFY_TOKEN } });
    const service = spotifyService({
      clientId: 'cid',
      secrets,
      fetch: net.fetch,
      signIn: async () => ({ type: 'code', code: 'one-time-code', codeVerifier: 'verifier', redirectUri: 'afterglow://music-auth' }),
      secureStorage: true,
      now: () => NOW,
      ...over,
    });
    return { service, secrets, net };
  };

  it('is not offered without a client id, or without a secure store', () => {
    expect(make({ clientId: '' }).service.availability()).toEqual({ ok: false, reason: 'not-set-up' });
    expect(make({ secureStorage: false }).service.availability()).toEqual({ ok: false, reason: 'not-on-this-device' });
    expect(make().service.availability()).toEqual({ ok: true });
  });

  it('in Expo Go it says a development build is needed, and never opens the sign-in', async () => {
    const signIn = jest.fn(async () => ({ type: 'cancelled' as const }));
    const { service } = make({ needsOwnApp: true, signIn });
    expect(service.availability()).toEqual({ ok: false, reason: 'needs-full-app' });
    expect(await service.connect()).toEqual({ ok: false, reason: 'unavailable' });
    expect(signIn).not.toHaveBeenCalled();
  });

  it('a sign-in Spotify refuses at the token step (bad code, wrong redirect) stores nothing', async () => {
    const secrets = memorySecrets();
    const net = fakeFetch({ [SPOTIFY_ENDPOINTS.tokenEndpoint]: { status: 400, body: { error: 'invalid_grant' } } });
    const { service } = make({ secrets, fetch: net.fetch });
    expect(await service.connect()).toEqual({ ok: false, reason: 'unknown' });
    expect(secrets.items.size).toBe(0);
  });

  it('no connection during sign-in is a network problem, and stores nothing', async () => {
    const secrets = memorySecrets();
    const { service } = make({ secrets, fetch: async () => { throw new Error('offline'); } });
    expect(await service.connect()).toEqual({ ok: false, reason: 'network' });
    expect(secrets.items.size).toBe(0);
  });

  it('the code is exchanged with the same redirect address the sign-in used', async () => {
    const { service, net } = make();
    await service.connect();
    const body = net.calls.find((c) => c.url === SPOTIFY_ENDPOINTS.tokenEndpoint)!.init!.body!;
    expect(body).toContain(`redirect_uri=${encodeURIComponent('afterglow://music-auth')}`);
    expect(body).not.toContain('client_secret');
  });

  it('an expired session that can’t be refreshed makes the next sync `expired` and forgets the session', async () => {
    const { service, secrets } = make();
    await service.connect();
    const stored = JSON.parse(secrets.items.get(SECRET_KEY.spotify)!);
    secrets.items.set(SECRET_KEY.spotify, JSON.stringify({ ...stored, expiresAt: NOW - 1 }));
    const refused = make({ secrets, fetch: fakeFetch({ [SPOTIFY_ENDPOINTS.tokenEndpoint]: { status: 400, body: { error: 'invalid_grant' } } }).fetch });
    await expect(refused.service.fetchLibrary(AT)).rejects.toMatchObject({ kind: 'expired' });
    expect(secrets.items.size).toBe(0);
  });

  it('connecting exchanges the code with PKCE and keeps the session in the secure store only', async () => {
    const { service, secrets, net } = make();
    expect(await service.connect()).toEqual({ ok: true });
    const exchange = net.calls.find((c) => c.url === SPOTIFY_ENDPOINTS.tokenEndpoint)!;
    expect(exchange.init?.body).toContain('grant_type=authorization_code');
    expect(exchange.init?.body).toContain('code_verifier=verifier');
    expect(JSON.parse(secrets.items.get(SECRET_KEY.spotify)!).accessToken).toBe('fixture-access-1');
  });

  it('a cancelled or refused sign-in stores nothing', async () => {
    const cancelled = make({ signIn: async () => ({ type: 'cancelled' }) });
    expect(await cancelled.service.connect()).toEqual({ ok: false, reason: 'cancelled' });
    const denied = make({ signIn: async () => ({ type: 'denied' }) });
    expect(await denied.service.connect()).toEqual({ ok: false, reason: 'denied' });
    expect(cancelled.secrets.items.size + denied.secrets.items.size).toBe(0);
  });

  it('reads the library as a Spotify snapshot, then disconnecting forgets the sign-in', async () => {
    const { service, secrets } = make();
    await service.connect();
    const snap = await service.fetchLibrary(AT);
    expect(snap.provider).toBe('spotify');
    expect(snap.artists.every((a) => a.provider === 'spotify')).toBe(true);
    await service.disconnect();
    expect(secrets.items.size).toBe(0);
  });
});
