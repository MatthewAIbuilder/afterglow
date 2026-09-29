import { describe, expect, it } from '@jest/globals';
import { BUILT_IN } from '../../../data/bundled';
import { MOCK_TASTE } from '../../../data/mock/tasteProfile';
import { importedMusic } from '../../music/imported';
import { combineLibraries } from '../../music/library';
import { normalizeSpotify, type SpotifyArtist, type SpotifyLibrary } from '../../music/spotify/normalize';
import { artistsOnMap } from '../../sound-map/layout';
import { computeTaste, IMPORT_CAP, PRIOR_YIELDS_AT, startingPrior, type ImportedTaste } from '../engine';
import { soundLean } from '../lean';
import { similarityWith } from '../similarity';

/**
 * A brand-new listener connects Spotify, end to end: Spotify's responses are
 * normalised, merged, matched to the real built-in catalogue (EDC, ACL, the
 * rest) and handed to the one taste engine, exactly as the app does it. The
 * library should give a useful first map, and then what you do in Afterglow
 * should take over.
 */
const catalog = BUILT_IN.catalog;
const similarity = similarityWith(catalog.similarities);
const AT = new Date('2026-09-29T12:00:00Z');
const none = { liked: false, saved: false, skipped: false };
const clipOf = (artistId: string) => catalog.clips.find((c) => c.artistId === artistId)!.id;

const artist = (id: string | null, name: string | null, genres?: string[] | null): SpotifyArtist => ({ id, name, genres });
const saved = (trackId: string | null, ...artists: [string | null, string | null][]) => ({
  track: { id: trackId, name: 'song', album: { id: `al-${trackId}` }, artists: artists.map(([id, name]) => ({ id, name })) },
});

/** A house fan's Spotify, with the untidy parts real libraries have. */
const HOUSE_FAN: SpotifyLibrary = {
  saved: [
    saved('t1', ['sp-guetta', 'David Guetta']),
    saved('t2', ['sp-guetta', 'David Guetta']),
    saved('t3', ['sp-guetta', 'David Guetta'], ['sp-alesso', 'Alesso']),
    saved('t4', ['sp-summit', 'John Summit']),
    // The same song twice (it happens across pages): one song.
    saved('t4', ['sp-summit', 'John Summit']),
    // A local file: no ids at all.
    saved(null, [null, 'Afrojack']),
    // A removed song, and a song with no artists.
    { track: null },
    { track: { id: 't9', name: 'x', album: null, artists: null } },
    // Nobody Afterglow has.
    saved('t10', ['sp-local', 'The Garage Band Down The Street']),
  ],
  followed: [artist('sp-guetta', 'David Guetta', ['dance pop', 'edm']), artist('sp-alesso', 'ALESSO', null), artist('sp-afro', 'afrojack', ['big room'])],
  top: [
    artist('sp-guetta', 'David Guetta', ['edm']),
    artist('sp-summit', 'John Summit', ['house', 'tech house']),
    artist('sp-alesso', 'Alesso'),
    artist('sp-afro', 'Afrojack'),
    artist('sp-local', 'The Garage Band Down The Street', ['garage rock']),
    // Missing metadata: no name, or an empty one.
    artist('sp-x', null),
    artist('sp-y', ''),
  ],
  recent: [artist('sp-summit', 'John Summit')],
  gaps: [],
};

function importOf(lib: SpotifyLibrary) {
  const snap = normalizeSpotify(lib, AT);
  return { snap, imported: importedMusic(combineLibraries([snap.artists]), catalog.artists) };
}

function tasteWith(imported: ImportedTaste, reactions = {}, ratings = {}) {
  return computeTaste(startingPrior(MOCK_TASTE, imported), catalog.artists, catalog.clips, reactions, similarity, ratings, imported);
}

describe('a brand-new listener connects Spotify', () => {
  const { snap, imported } = importOf(HOUSE_FAN);
  const first = tasteWith(imported);
  const map = artistsOnMap(catalog.artists, first.taste, first.informed);
  const LIBRARY = ['david-guetta', 'alesso', 'afrojack', 'john-summit'];

  it('reads the library once per artist, however messy', () => {
    const names = snap.artists.map((a) => a.key);
    expect(new Set(names).size).toBe(names.length);
    expect(snap.artists.find((a) => a.key === 'david guetta')).toMatchObject({ savedTracks: 3, followed: true, topRank: 1 });
    expect(snap.artists.find((a) => a.key === 'john summit')).toMatchObject({ savedTracks: 1, recent: true });
    // Nameless records are left out rather than guessed.
    expect(snap.artists.every((a) => a.name.trim() !== '')).toBe(true);
  });

  it('matches only artists Afterglow has, whatever the spelling, and each once', () => {
    expect(Object.keys(imported.artists).sort()).toEqual([...LIBRARY].sort());
    expect(imported.matched).toBe(4);
    expect(imported.libraryArtists).toBe(5);
    expect(Object.keys(imported.artists)).not.toContain('the-garage-band-down-the-street');
  });

  it('starts the map from the library: its artists lead, not the built-in guess', () => {
    expect(Object.keys(imported.artists).length).toBeGreaterThanOrEqual(PRIOR_YIELDS_AT);
    // The library's artists are the top of the map, strongest (followed, top 1, most saved) at the centre.
    expect(map[0].id).toBe('david-guetta');
    expect(map.slice(0, 4).map((a) => a.id).sort()).toEqual([...LIBRARY].sort());
    for (const id of LIBRARY) expect(first.informed[id]).toBe(true);
    // The made-up bass favourites no longer outrank a house fan's own artists.
    for (const id of LIBRARY) expect(first.taste[id]).toBeGreaterThan(first.taste.illenium);
    expect(first.informed.illenium).toBe(false);
    // Similar sounds from the lineups fill in around them, and My Sound leans house.
    expect(map.length).toBeGreaterThan(LIBRARY.length);
    expect(soundLean(catalog.artists, first.taste, first.informed)[0]).toBe('house');
  });

  it('artists on a festival lineup join the map; library artists Afterglow doesn’t have never do', () => {
    expect(map.every((a) => catalog.festivals.some((f) => f.lineup.includes(a.id)))).toBe(true);
    expect(map.map((a) => a.name)).not.toContain('The Garage Band Down The Street');
  });

  it('what you do in Afterglow outweighs the library', () => {
    // One like on an artist the library never mentions beats the library's strongest artist.
    const liked = tasteWith(imported, { [clipOf('levity')]: { ...none, liked: true } });
    expect(liked.taste.levity).toBeGreaterThan(first.taste['david-guetta']);
    // One skip on a library artist puts them below where they started (50%) and below every other library artist.
    const skipped = tasteWith(imported, { [clipOf('john-summit')]: { ...none, skipped: true } });
    expect(skipped.taste['john-summit']).toBeLessThan(0.5);
    for (const id of ['david-guetta', 'alesso', 'afrojack']) expect(skipped.taste['john-summit']).toBeLessThan(skipped.taste[id]);
    // A rating is taken at its word, library or not.
    expect(tasteWith(imported, {}, { 'david-guetta': 'pass' }).taste['david-guetta']).toBeLessThanOrEqual(0.3);
    // The imported layer never exceeds its cap for anyone.
    for (const v of Object.values(first.imported)) expect(v).toBeLessThanOrEqual(IMPORT_CAP + 1e-9);
  });

  it('as you react, your own behaviour increasingly decides the map', () => {
    const reactions = {
      [clipOf('levity')]: { ...none, liked: true, saved: true },
      [clipOf('sara-landry')]: { ...none, liked: true },
      [clipOf('john-summit')]: { ...none, skipped: true },
    };
    const later = tasteWith(imported, reactions);
    const top = artistsOnMap(catalog.artists, later.taste, later.informed)[0];
    expect(top.id).toBe('levity');
    expect(later.taste['sara-landry']).toBeGreaterThan(later.taste.alesso);
  });

  it('a library with fewer than three Afterglow artists keeps the built-in guess; disconnecting brings it back', () => {
    const small = importOf({ ...HOUSE_FAN, followed: [], top: [artist('sp-summit', 'John Summit')], saved: [], recent: [] }).imported;
    expect(small.matched).toBe(1);
    expect(startingPrior(MOCK_TASTE, small)).toBe(MOCK_TASTE);
    const gone: ImportedTaste = { artists: {}, sounds: [] };
    expect(startingPrior(MOCK_TASTE, gone)).toBe(MOCK_TASTE);
    const back = tasteWith(gone);
    expect(back.taste).toEqual(computeTaste(MOCK_TASTE, catalog.artists, catalog.clips, {}, similarity).taste);
  });

  it('the listener from the example (ILLENIUM and Subtronics on repeat) finds them at the centre of the map', () => {
    const bass = importOf({
      saved: [saved('b1', ['i', 'Illenium']), saved('b2', ['i', 'Illenium']), saved('b3', ['s', 'Subtronics']), saved('b4', ['e', 'Excision'])],
      followed: [artist('i', 'Illenium'), artist('s', 'Subtronics')],
      top: [artist('s', 'Subtronics'), artist('i', 'Illenium'), artist('e', 'Excision')],
      recent: [artist('s', 'Subtronics')],
      gaps: [],
    }).imported;
    const t = tasteWith(bass);
    const top2 = artistsOnMap(catalog.artists, t.taste, t.informed).slice(0, 2).map((a) => a.id).sort();
    expect(top2).toEqual(['illenium', 'subtronics']);
  });
});
