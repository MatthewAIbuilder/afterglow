import { describe, expect, it } from '@jest/globals';
import { connectionView, connectProblem, musicNote, syncedAgo } from '../copy';
import type { MusicLibrarySnapshot } from '../models';
import type { MusicAvailability } from '../service';
import { cleanMusicState, connected, connectFailed, disconnected, syncFailed, syncStarted, syncSucceeded } from '../store';

const AT = new Date('2026-09-29T12:00:00Z');
const snap = (provider: 'spotify' | 'apple-music', names: string[], syncedAt = '2026-09-29T11:00:00.000Z'): MusicLibrarySnapshot => ({
  version: 1,
  provider,
  syncedAt,
  artists: names.map((name) => ({ provider, name, key: name.toLowerCase(), savedTracks: 2, savedAlbums: 1, genres: [], sources: ['saved'] })),
  savedTracksRead: names.length * 2,
  gaps: [],
});
const good = syncSucceeded(connected({}, 'spotify'), 'spotify', snap('spotify', ['Illenium', 'Subtronics']));
const OK: MusicAvailability = { ok: true };
const available = { spotify: OK, 'apple-music': OK };

describe('connection state', () => {
  it('a successful sync stores the snapshot and clears any problem', () => {
    const s = syncSucceeded(syncFailed(good, 'spotify', 'network'), 'spotify', snap('spotify', ['Levity']));
    expect(s.spotify).toMatchObject({ connected: true, syncing: false, error: undefined });
    expect(s.spotify!.snapshot!.artists.map((a) => a.name)).toEqual(['Levity']);
  });

  it('a failed sync never destroys the last good snapshot', () => {
    for (const kind of ['network', 'rate-limited', 'unknown', 'expired', 'denied'] as const) {
      const s = syncFailed(syncStarted(good, 'spotify', AT), 'spotify', kind);
      expect(s.spotify!.snapshot).toEqual(good.spotify!.snapshot);
      expect(s.spotify!.syncing).toBe(false);
      expect(s.spotify!.error).toBe(kind);
    }
  });

  it('expired sign-in marks the service disconnected but keeps its last import until you disconnect', () => {
    const s = syncFailed(good, 'spotify', 'expired');
    expect(s.spotify!.connected).toBe(false);
    expect(s.spotify!.snapshot).toBeDefined();
  });

  it('disconnecting removes everything imported from that service, and only that service', () => {
    const both = syncSucceeded(connected(good, 'apple-music'), 'apple-music', snap('apple-music', ['ILLENIUM']));
    const s = disconnected(both, 'spotify');
    expect(s.spotify).toBeUndefined();
    expect(JSON.stringify(s)).not.toContain('Subtronics');
    expect(s['apple-music']!.snapshot!.artists).toHaveLength(1);
  });

  it('a sync that finishes after disconnecting is dropped', () => {
    expect(syncSucceeded(disconnected(good, 'spotify'), 'spotify', snap('spotify', ['Late']))).toEqual({});
  });

  it('a snapshot is only stored under its own service', () => {
    expect(syncSucceeded(good, 'spotify', snap('apple-music', ['Wrong']))).toBe(good);
    const mixed = { ...snap('spotify', ['Right']), artists: [...snap('spotify', ['Right']).artists, ...snap('apple-music', ['Wrong']).artists] };
    expect(syncSucceeded(good, 'spotify', mixed).spotify!.snapshot!.artists.map((a) => a.name)).toEqual(['Right']);
  });

  it('a sign-in that didn’t finish leaves no trace for a new service, and keeps an existing import', () => {
    expect(connectFailed(syncStarted(connected({}, 'spotify'), 'spotify', AT), 'spotify', 'denied')).toEqual({});
    expect(connectFailed({}, 'apple-music', undefined)).toEqual({});
    expect(connectFailed(good, 'spotify', 'denied').spotify!.snapshot).toBeDefined();
  });

  it('reads saved state defensively: unknown services, bad records and an in-flight sync are dropped', () => {
    const raw = JSON.parse(JSON.stringify({ ...syncStarted(good, 'spotify', AT), tidal: { provider: 'tidal' }, 'apple-music': { provider: 'spotify' } }));
    const s = cleanMusicState(raw);
    expect(Object.keys(s)).toEqual(['spotify']);
    expect(s.spotify!.syncing).toBe(false);
    expect(s.spotify!.snapshot!.artists).toHaveLength(2);
    expect(cleanMusicState(null)).toEqual({});
    expect(cleanMusicState('nonsense')).toEqual({});
  });

  it('never stores a token: the saved state has no credential fields', () => {
    const text = JSON.stringify(good);
    expect(text).not.toMatch(/token|secret|password|refresh/i);
  });
});

describe('what the screens say', () => {
  it('no service connected: offers Connect, or says plainly it isn’t available', () => {
    expect(connectionView('spotify', undefined, OK, AT)).toMatchObject({
      status: 'not-connected',
      label: 'Not connected',
      primary: { action: 'connect', label: 'Connect Spotify' },
      canDisconnect: false,
    });
    const off = connectionView('spotify', undefined, { ok: false, reason: 'not-set-up' }, AT);
    expect(off).toMatchObject({ status: 'unavailable', detail: 'Not available in this version of Afterglow yet.', canDisconnect: false });
    expect(off.primary).toBeUndefined();
    // Expo Go: Spotify needs a development build.
    expect(connectionView('spotify', undefined, { ok: false, reason: 'needs-full-app' }, AT).detail).toMatch(/full version/);
  });

  it('each of the seven states says exactly what’s true', () => {
    const view = (c: Parameters<typeof connectionView>[1], reach: Parameters<typeof connectionView>[4] = {}) => connectionView('spotify', c, OK, AT, reach);
    expect(view(undefined, { connecting: true })).toMatchObject({ status: 'connecting', label: 'Connecting', headline: 'Connecting to Spotify…', busy: true });
    expect(view(connected({}, 'spotify').spotify)).toMatchObject({ status: 'connected', headline: 'Connected to Spotify', primary: { action: 'sync' } });
    expect(view(syncStarted(connected({}, 'spotify'), 'spotify', AT).spotify)).toMatchObject({ status: 'syncing', headline: 'Reading your library…', busy: true });
    expect(view(syncStarted(good, 'spotify', AT).spotify)).toMatchObject({ status: 'syncing', headline: 'Syncing your library…', busy: true });
    expect(view(good.spotify, { matched: 2, upcoming: 1 })).toMatchObject({
      status: 'synced',
      label: 'Synced',
      headline: 'Connected to Spotify',
      stats: [
        { value: '1 hour ago', label: 'Last synced' },
        { value: '2', label: 'artists analyzed' },
        { value: '1', label: 'on upcoming festivals' },
      ],
      notes: [],
      tone: 'good',
      primary: { action: 'sync', label: 'Sync now' },
      canDisconnect: true,
    });
    expect(view(syncFailed(good, 'spotify', 'expired').spotify)).toMatchObject({
      status: 'reauthorize',
      label: 'Sign in again',
      headline: 'Spotify needs you to sign in again',
      primary: { action: 'connect', label: 'Sign in again' },
      tone: 'warn',
    });
    expect(view(syncFailed(good, 'spotify', 'denied').spotify).headline).toBe('Spotify didn’t allow access');
    expect(view(syncFailed(good, 'spotify', 'network').spotify)).toMatchObject({
      status: 'failed',
      label: 'Sync failed',
      detail: 'Couldn’t reach Spotify. Check your connection and try again. Your last import is still used until you disconnect.',
      tone: 'warn',
      primary: { action: 'sync', label: 'Try again' },
      canDisconnect: true,
    });
    expect(view(syncFailed(good, 'spotify', 'rate-limited').spotify).detail).toMatch(/^Spotify is busy right now/);
    // A failed first sync has no import to keep.
    expect(view(syncFailed(connected({}, 'spotify'), 'spotify', 'unknown').spotify).detail).toBe('Something went wrong reading your library. Try again.');
  });

  it('never shows account details: only sync time and counts', () => {
    const v = connectionView('spotify', good.spotify, OK, AT, { matched: 2, upcoming: 2 });
    const text = JSON.stringify(v);
    for (const leak of ['Illenium', 'Subtronics', 'email', 'token']) expect(text).not.toContain(leak);
  });

  it('a library with nothing in it, nothing on Afterglow, or parts missing says so quietly', () => {
    const empty = syncSucceeded(connected({}, 'spotify'), 'spotify', snap('spotify', []));
    expect(connectionView('spotify', empty.spotify, OK, AT, { matched: 0, upcoming: 0 })).toMatchObject({
      status: 'synced',
      stats: [{ label: 'Last synced' }, { value: '0', label: 'artists analyzed' }],
      notes: ['Your Spotify library had no saved songs, followed artists or top artists to read yet.'],
    });
    expect(connectionView('spotify', good.spotify, OK, AT, { matched: 0, upcoming: 0 }).notes).toEqual([
      'None of these artists play Afterglow’s lineups yet, so your map grows from what you do here.',
    ]);
    const partial = syncSucceeded(connected({}, 'spotify'), 'spotify', { ...snap('spotify', ['Illenium']), gaps: ['recent', 'top'] });
    expect(connectionView('spotify', partial.spotify, OK, AT, { matched: 1, upcoming: 1 }).notes).toEqual([
      'Spotify didn’t share your top artists and recent listening this time, so this uses the rest.',
    ]);
  });

  it('a sign-in that didn’t finish says why, once; cancelling says nothing', () => {
    expect(connectProblem('spotify', undefined)).toBeUndefined();
    expect(connectProblem('spotify', 'cancelled')).toBeUndefined();
    expect(connectProblem('spotify', 'denied')).toMatch(/access wasn’t allowed/);
    expect(connectProblem('spotify', 'network')).toBe('Couldn’t reach Spotify. Check your connection and try again.');
    expect(connectProblem('spotify', 'unknown')).toBe('Spotify didn’t connect. Try again.');
  });

  it('My Sound: an offer to connect only for a newcomer with a service available', () => {
    expect(musicNote({ state: {}, availability: available, matched: 0, ownSignal: false })).toEqual({
      text: 'Connect Spotify or Apple Music to start your map from what you already play.',
      action: 'connect',
    });
    expect(musicNote({ state: {}, availability: available, matched: 0, ownSignal: true })).toBeUndefined();
    const none = { spotify: { ok: false, reason: 'not-set-up' }, 'apple-music': { ok: false, reason: 'needs-full-app' } } as const;
    expect(musicNote({ state: {}, availability: none, matched: 0, ownSignal: false })).toBeUndefined();
  });

  it('My Sound: syncing, failed, and a library with little on Afterglow', () => {
    expect(musicNote({ state: syncStarted(good, 'spotify', AT), availability: available, matched: 5, ownSignal: true })!.text).toBe(
      'Bringing in your Spotify library…',
    );
    expect(musicNote({ state: syncFailed(good, 'spotify', 'network'), availability: available, matched: 5, ownSignal: true })).toEqual({
      text: 'Couldn’t sync Spotify. Your map still uses your last import.',
      action: 'open',
    });
    expect(musicNote({ state: good, availability: available, matched: 1, ownSignal: false })!.text).toBe(
      'Only 1 of your Spotify artists plays Afterglow’s lineups so far. React to clips to place more.',
    );
    expect(musicNote({ state: good, availability: available, matched: 0, ownSignal: false })!.text).toMatch(/^None of your Spotify artists/);
    // Enough of your library is here: nothing to say.
    expect(musicNote({ state: good, availability: available, matched: 12, ownSignal: false })).toBeUndefined();
  });

  it('says when a library was synced', () => {
    expect(syncedAgo('2026-09-29T11:59:40Z', AT)).toBe('just now');
    expect(syncedAgo('2026-09-29T11:59:00Z', AT)).toBe('1 minute ago');
    expect(syncedAgo('2026-09-29T11:48:00Z', AT)).toBe('12 minutes ago');
    expect(syncedAgo('2026-09-29T09:00:00Z', AT)).toBe('3 hours ago');
    expect(syncedAgo('2026-09-28T12:00:00Z', AT)).toBe('yesterday');
    expect(syncedAgo('2026-09-25T12:00:00Z', AT)).toBe('4 days ago');
    expect(syncedAgo('nonsense', AT)).toBe('');
  });
});
