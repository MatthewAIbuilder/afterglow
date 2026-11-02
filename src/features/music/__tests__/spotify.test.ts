import { describe, expect, it } from '@jest/globals';
import { SECRET_KEY } from '../secrets';
import { libraryFromEmbeds, parseSpotifyLink, readEmbedPage, type TextFetch } from '../spotify/links';
import { normalizeSpotify, type SpotifyLibrary } from '../spotify/normalize';
import { spotifyService } from '../spotify/service';
import { memorySecrets, SPOTIFY_FOLLOWING, SPOTIFY_SAVED_PAGE_1, SPOTIFY_SAVED_PAGE_2, SPOTIFY_TOP_MEDIUM, SPOTIFY_TOP_SHORT } from './fixtures';

const AT = new Date('2026-09-29T12:00:00Z');

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

/** A Spotify embed page as the app reads it: its JSON data script with a track list. */
const embedPage = (name: string, tracks: { uri?: string; title: string; subtitle?: string; artists?: { name: string }[] }[]) =>
  `<html><head><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { state: { data: { entity: { name, trackList: tracks } } } } } })}</script></head><body></body></html>`;

const PLAYLIST = '37i9dQZF1DXcBWIGoYBM5M';
const page = embedPage('Festival warm-up', [
  { uri: 'spotify:track:1', title: 'Where You Are', subtitle: 'John Summit, Hayla' },
  { uri: 'spotify:track:2', title: 'Get Down', subtitle: 'Odd\u00a0Mob' },
  { uri: 'spotify:track:3', title: 'Shiver', subtitle: 'John Summit' },
  { title: 'No artist' },
]);

function net(routes: Record<string, { status: number; body?: string; url?: string } | 'offline'>) {
  const calls: string[] = [];
  const fetchText: TextFetch = async (url) => {
    calls.push(url);
    const r = routes[url];
    if (r === 'offline') throw new Error('offline');
    if (!r) return { ok: false, status: 404, text: async () => '' };
    return { ok: r.status < 300, status: r.status, url: r.url ?? url, text: async () => r.body ?? '' };
  };
  return { fetchText, calls };
}

describe('Spotify by link', () => {
  it('reads playlist, album and artist links however they were shared', () => {
    expect(parseSpotifyLink(`https://open.spotify.com/playlist/${PLAYLIST}?si=abc123`)).toEqual({ kind: 'playlist', id: PLAYLIST });
    expect(parseSpotifyLink(`Listen to this https://open.spotify.com/intl-es/playlist/${PLAYLIST}?si=x`)).toEqual({ kind: 'playlist', id: PLAYLIST });
    expect(parseSpotifyLink(`spotify:album:${PLAYLIST}`)).toEqual({ kind: 'album', id: PLAYLIST });
    expect(parseSpotifyLink(`https://open.spotify.com/artist/${PLAYLIST}`)).toEqual({ kind: 'artist', id: PLAYLIST });
    expect(parseSpotifyLink('https://spotify.link/AbCdEf')).toEqual({ short: 'https://spotify.link/AbCdEf' });
    expect(parseSpotifyLink(`https://open.spotify.com/track/${PLAYLIST}`)).toBeUndefined();
    expect(parseSpotifyLink('https://example.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBeUndefined();
    expect(parseSpotifyLink('my playlist')).toBeUndefined();
  });

  it('reads the songs and artists from the embed page, and nothing from a page without them', () => {
    const r = readEmbedPage(page);
    expect(r?.name).toBe('Festival warm-up');
    expect(r?.tracks.map((t) => t.artists)).toEqual([['John Summit', 'Hayla'], ['Odd Mob'], ['John Summit']]);
    expect(readEmbedPage('<html>Page not found</html>')).toBeUndefined();
    expect(readEmbedPage(embedPage('Empty', []))).toBeUndefined();
  });

  it('counts each artist once per song, however many links have the song', () => {
    const r = readEmbedPage(page)!;
    const snap = normalizeSpotify(libraryFromEmbeds([r, r]), AT);
    expect(snap.artists.find((a) => a.name === 'John Summit')?.savedTracks).toBe(2);
    expect(snap.savedTracksRead).toBe(3);
    expect(snap.gaps).toEqual([]);
    // Song titles never leave the reading.
    expect(JSON.stringify(snap)).not.toContain('Shiver');
  });

  it('adding a link reads it straight away and keeps it in the secure store; syncing reads every link', async () => {
    const secrets = memorySecrets();
    const { fetchText, calls } = net({ [`https://open.spotify.com/embed/playlist/${PLAYLIST}`]: { status: 200, body: page } });
    const svc = spotifyService({ secrets, fetchText, onPhone: true });
    expect(svc.availability()).toEqual({ ok: true });
    expect(await svc.connect(`https://open.spotify.com/playlist/${PLAYLIST}?si=1`)).toEqual({ ok: true });
    expect(JSON.parse(secrets.items.get(SECRET_KEY.spotify)!)).toEqual({ links: [{ kind: 'playlist', id: PLAYLIST, name: 'Festival warm-up' }] });
    // The same playlist twice is kept once.
    await svc.connect(`spotify:playlist:${PLAYLIST}`);
    expect(await svc.links!()).toEqual([{ kind: 'playlist', name: 'Festival warm-up' }]);
    const snap = await svc.fetchLibrary(AT);
    expect(snap.provider).toBe('spotify');
    expect(snap.artists.map((a) => a.name)).toEqual(expect.arrayContaining(['John Summit', 'Hayla', 'Odd Mob']));
    expect(calls.every((u) => u.startsWith('https://open.spotify.com/embed/'))).toBe(true);
    await svc.disconnect();
    expect(secrets.items.has(SECRET_KEY.spotify)).toBe(false);
  });

  it('says why a link didn’t work: not a link, private, or no signal', async () => {
    const secrets = memorySecrets();
    const { fetchText } = net({
      [`https://open.spotify.com/embed/playlist/${PLAYLIST}`]: { status: 404 },
      [`https://open.spotify.com/embed/album/${PLAYLIST}`]: 'offline',
    });
    const svc = spotifyService({ secrets, fetchText, onPhone: true });
    expect(await svc.connect('hello')).toEqual({ ok: false, reason: 'bad-link' });
    expect(await svc.connect(`https://open.spotify.com/playlist/${PLAYLIST}`)).toEqual({ ok: false, reason: 'not-public' });
    expect(await svc.connect(`https://open.spotify.com/album/${PLAYLIST}`)).toEqual({ ok: false, reason: 'network' });
    expect(secrets.items.size).toBe(0);
  });

  it('follows a short spotify.link to the playlist', async () => {
    const { fetchText } = net({
      'https://spotify.link/AbCdEf': { status: 200, url: `https://open.spotify.com/playlist/${PLAYLIST}?si=z`, body: '' },
      [`https://open.spotify.com/embed/playlist/${PLAYLIST}`]: { status: 200, body: page },
    });
    const svc = spotifyService({ secrets: memorySecrets(), fetchText, onPhone: true });
    expect(await svc.connect('https://spotify.link/AbCdEf')).toEqual({ ok: true });
  });

  it('a sync with no signal keeps the last import (network), and isn’t offered on the website', async () => {
    const secrets = memorySecrets();
    secrets.items.set(SECRET_KEY.spotify, JSON.stringify({ links: [{ kind: 'playlist', id: PLAYLIST }] }));
    const svc = spotifyService({ secrets, fetchText: net({ [`https://open.spotify.com/embed/playlist/${PLAYLIST}`]: 'offline' }).fetchText, onPhone: true });
    await expect(svc.fetchLibrary(AT)).rejects.toMatchObject({ kind: 'network' });
    expect(spotifyService({ secrets, fetchText: net({}).fetchText, onPhone: false }).availability()).toEqual({ ok: false, reason: 'not-on-this-device' });
  });
});
