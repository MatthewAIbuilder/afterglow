import { describe, expect, it } from '@jest/globals';
import { connectionView, musicNote, syncedAgo } from '../copy';
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
    expect(connectionView('spotify', undefined, OK, AT)).toMatchObject({ line: 'Not connected', primary: { action: 'connect' }, canDisconnect: false });
    const off = connectionView('spotify', undefined, { ok: false, reason: 'not-set-up' }, AT);
    expect(off).toMatchObject({ line: 'Not available in this version of Afterglow yet.', canDisconnect: false });
    expect(off.primary).toBeUndefined();
    expect(connectionView('apple-music', undefined, { ok: false, reason: 'needs-full-app' }, AT).line).toMatch(/full version/);
  });

  it('connected, syncing, failed and expired each say exactly what’s true', () => {
    expect(connectionView('spotify', good.spotify, OK, AT, 2).line).toBe('Connected · 2 artists · 2 on Afterglow · synced 1 h ago');
    expect(connectionView('spotify', syncStarted(good, 'spotify', AT).spotify, OK, AT)).toMatchObject({ line: 'Syncing your library…', busy: true });
    expect(connectionView('spotify', syncStarted(connected({}, 'spotify'), 'spotify', AT).spotify, OK, AT).line).toBe('Reading your library…');
    expect(connectionView('spotify', syncFailed(good, 'spotify', 'network').spotify, OK, AT)).toMatchObject({
      line: 'Couldn’t sync just now. Your last import is still used.',
      tone: 'warn',
      primary: { action: 'sync', label: 'Try again' },
      canDisconnect: true,
    });
    expect(connectionView('spotify', syncFailed(good, 'spotify', 'expired').spotify, OK, AT)).toMatchObject({
      primary: { action: 'connect', label: 'Connect again' },
      tone: 'warn',
    });
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
    expect(syncedAgo('2026-09-29T11:30:00Z', AT)).toBe('30 min ago');
    expect(syncedAgo('2026-09-28T12:00:00Z', AT)).toBe('yesterday');
    expect(syncedAgo('2026-09-25T12:00:00Z', AT)).toBe('4 days ago');
    expect(syncedAgo('nonsense', AT)).toBe('');
  });
});
