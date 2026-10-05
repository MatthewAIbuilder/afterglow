import { describe, expect, it } from '@jest/globals';
import { BUILT_IN } from '../../bundled';
import { createCatalog } from '../../catalog';
import { MAX_SHOW_ARTISTS, MAX_SHOWS, parseCatalogFile } from '../../file';
import { buildCatalog, mergeSnapshots } from '../../merge';
import type { CatalogSnapshot } from '../../models';
import { validateSnapshot } from '../../validate';
import type { EdmtrainEvent } from '../edmtrain';
import { edmtrainShows, SHOW_RULES } from '../edmtrainShows';

const TODAY = '2026-10-05';
const artists = [
  { id: 'subtronics', name: 'Subtronics' },
  { id: 'rufus-du-sol', name: 'RÜFÜS DU SOL' },
  { id: 'crankdat', name: 'Crankdat' },
  { id: 'fred', name: 'Fred again..' },
];
let nextId = 1000;
const show = (date: string, names: string[], over: Partial<EdmtrainEvent> = {}): EdmtrainEvent => {
  const id = nextId++;
  return {
    id,
    link: `https://edmtrain.com/denver-co/club-night-${id}`,
    name: null,
    date,
    festivalInd: false,
    venue: { id: 3, name: 'Mission Ballroom', location: 'Denver, CO', latitude: 39.77123, longitude: -104.97987 },
    artistList: names.map((name, i) => ({ id: i + 1, name, b2bInd: false })),
    ...over,
  };
};

describe('club shows from EDMTrain', () => {
  it('lists Afterglow artists by name, ignoring capitals and accents, and never adds new ones', () => {
    const e = show('2026-10-18', ['SUBTRONICS', 'Rufus Du Sol', 'Someone New'], { name: 'Wasteland Halloween' });
    const { shows, skipped } = edmtrainShows([e], artists, TODAY);
    expect(shows).toEqual([
      {
        id: `edm-${e.id}`,
        date: '2026-10-18',
        name: 'Wasteland Halloween',
        venue: 'Mission Ballroom',
        location: 'Denver, CO',
        place: { lat: 39.771, lon: -104.98 },
        link: e.link,
        artists: ['subtronics', 'rufus-du-sol'],
      },
    ]);
    expect(skipped.noArtists).toBe(0);
    // Only someone new on the bill: no show.
    expect(edmtrainShows([show('2026-10-18', ['Someone New'])], artists, TODAY).shows).toEqual([]);
  });

  it('counts a b2b act for each of its artists on Afterglow', () => {
    const { shows } = edmtrainShows([show('2026-10-20', ['SUBTRONICS B2B CRANKDAT', 'Crankdat'])], artists, TODAY);
    expect(shows[0].artists).toEqual(['subtronics', 'crankdat']);
    // A b2b act that's on Afterglow under its own name stays itself.
    const withB2b = [...artists, { id: 'sub-b2b-crank', name: 'Subtronics b2b Crankdat' }];
    expect(edmtrainShows([show('2026-10-20', ['SUBTRONICS B2B CRANKDAT'])], withB2b, TODAY).shows[0].artists).toEqual(['sub-b2b-crank']);
  });

  it('uses the venue when the event has no name of its own', () => {
    const [s] = edmtrainShows([show('2026-10-18', ['Subtronics'], { name: '  ' })], artists, TODAY).shows;
    expect(s.name).toBeUndefined();
    expect(s.venue).toBe('Mission Ballroom');
    // A name that's just the venue again isn't repeated.
    expect(edmtrainShows([show('2026-10-18', ['Subtronics'], { name: 'MISSION BALLROOM' })], artists, TODAY).shows[0].name).toBeUndefined();
  });

  it('leaves out festivals, livestreams, past and far-off shows, and anything without an id, link, venue or day', () => {
    const events = [
      show('2026-10-18', ['Subtronics'], { festivalInd: true }),
      show('2026-10-18', ['Subtronics'], { livestreamInd: true }),
      show('2026-10-04', ['Subtronics']),
      show('2027-06-01', ['Subtronics']),
      show('2026-10-18', ['Subtronics'], { link: undefined }),
      show('2026-10-18', ['Subtronics'], { link: 'http://edmtrain.com/x' }),
      show('2026-10-18', ['Subtronics'], { venue: undefined }),
      show('2026-10-18', ['Subtronics'], { date: 'Oct 18' }),
      show('2026-10-18', ['Subtronics'], { id: undefined }),
      show('2026-10-05', ['Subtronics']),
    ];
    const { shows, skipped } = edmtrainShows(events, artists, TODAY);
    expect(shows.map((s) => s.date)).toEqual(['2026-10-05']);
    expect(skipped).toEqual({ notShows: 2, outOfRange: 2, incomplete: 5, noArtists: 0, full: 0 });
  });

  it('keeps the soonest few per artist and caps the whole list, farthest dropped first', () => {
    const days = Array.from({ length: 10 }, (_, i) => `2026-11-${String(i + 10)}`);
    const events = [...days].reverse().map((d) => show(d, ['Subtronics']));
    const { shows, skipped } = edmtrainShows(events, artists, TODAY);
    expect(shows.map((s) => s.date)).toEqual(days.slice(0, SHOW_RULES.perArtist));
    expect(skipped.full).toBe(10 - SHOW_RULES.perArtist);
    // A show stays while anyone on it still has room; the cap counts everyone on it.
    const shared = edmtrainShows([...events, show('2026-12-01', ['Subtronics', 'Crankdat'])], artists, TODAY).shows;
    expect(shared.at(-1)!.artists).toEqual(['subtronics', 'crankdat']);
    expect(edmtrainShows(events, artists, TODAY, { ...SHOW_RULES, maxShows: 2 }).shows.map((s) => s.date)).toEqual(days.slice(0, 2));
  });

  it('lists the same event once', () => {
    const e = show('2026-10-18', ['Subtronics']);
    expect(edmtrainShows([e, { ...e }], artists, TODAY).shows).toHaveLength(1);
  });
});

describe('shows in the catalogue file', () => {
  const file = (shows: unknown) => ({ version: 1, mode: 'add', artists: [], festivals: [], clips: [], shows });
  const good = { id: 'edm-1', date: '2031-03-07', venue: 'Echostage', location: 'Washington, DC', link: 'https://edmtrain.com/x-1', artists: ['a', 'b'] };

  it('reads good shows and explains the rest', () => {
    const parsed = parseCatalogFile(
      file([
        good,
        { ...good, id: 'edm-2', name: 'Halloween', place: { lat: 38.92, lon: -76.97 } },
        { ...good, id: 'edm-3', link: 'http://edmtrain.com/x' },
        { ...good, id: 'edm-4', date: '2031-02-30' },
        { ...good, id: 'edm-5', artists: [] },
        'nope',
      ]),
    );
    expect(parsed.snapshot!.shows).toEqual([
      { id: 'edm-1', date: '2031-03-07', venue: 'Echostage', location: 'Washington, DC', link: 'https://edmtrain.com/x-1', artistIds: ['a', 'b'] },
      { id: 'edm-2', date: '2031-03-07', name: 'Halloween', venue: 'Echostage', location: 'Washington, DC', place: { lat: 38.92, lon: -76.97 }, link: 'https://edmtrain.com/x-1', artistIds: ['a', 'b'] },
    ]);
    expect(parsed.problems).toEqual(['4 shows were left out: each needs an id, a date like "2026-10-18", a venue, an https link and its artists.']);
    expect(parseCatalogFile(file({})).problems[0]).toMatch(/^"shows" should be a list/);
  });

  it('caps the number of shows and the artists on each', () => {
    const many = Array.from({ length: MAX_SHOWS + 5 }, (_, i) => ({ ...good, id: `edm-${i}` }));
    expect(parseCatalogFile(file(many)).snapshot!.shows).toHaveLength(MAX_SHOWS);
    const crowded = { ...good, artists: Array.from({ length: 20 }, (_, i) => `a${i}`) };
    expect(parseCatalogFile(file([crowded])).snapshot!.shows![0].artistIds).toHaveLength(MAX_SHOW_ARTISTS);
  });

  it('keeps only artists on Afterglow, soonest first, and gives each artist theirs', () => {
    const snapshot: CatalogSnapshot = {
      artists: [
        { id: 'a', name: 'A', sound: {} },
        { id: 'b', name: 'B', sound: {} },
      ],
      festivals: [],
      clips: [],
      shows: [
        { id: 's2', date: '2031-05-01', venue: 'V', location: '', link: 'https://e.com/2', artistIds: ['a', 'gone'] },
        { id: 's1', date: '2031-04-01', venue: 'V', location: '', link: 'https://e.com/1', artistIds: ['a', 'b'] },
        { id: 's3', date: '2031-06-01', venue: 'V', location: '', link: 'https://e.com/3', artistIds: ['gone'] },
        { id: 's0', date: '2020-01-01', venue: 'V', location: '', link: 'https://e.com/0', artistIds: ['b'] },
      ],
    };
    const checked = validateSnapshot(snapshot);
    expect(checked.problems).toEqual([]);
    expect(checked.snapshot.shows!.map((s) => s.id)).toEqual(['s0', 's1', 's2']);
    expect(checked.snapshot.shows![2].artistIds).toEqual(['a']);
    const catalog = createCatalog(checked.snapshot);
    expect(catalog.showsOf('a').map((s) => s.id)).toEqual(['s1', 's2']);
    expect(catalog.showsOf('b').map((s) => s.id)).toEqual(['s0', 's1']);
    expect(catalog.showsOf('b', '2026-10-05').map((s) => s.id)).toEqual(['s1']);
    expect(catalog.showsOf('nobody')).toEqual([]);
    // A file's shows sit beside the base's, the file's winning by id.
    const merged = mergeSnapshots(checked.snapshot, { artists: [], festivals: [], clips: [], shows: [{ ...snapshot.shows![1], venue: 'New' }] });
    expect(merged.shows!.find((s) => s.id === 's1')!.venue).toBe('New');
    expect(merged.shows).toHaveLength(3);
  });

  it('come through the import with the app’s own check, with nothing to complain about', () => {
    const someone = BUILT_IN.snapshot.artists[0];
    const { shows } = edmtrainShows([show('2026-10-18', [someone.name.toUpperCase()])], BUILT_IN.snapshot.artists, TODAY);
    const text = JSON.stringify({ version: 1, mode: 'add', artists: [], festivals: [], clips: [], shows });
    const built = buildCatalog(BUILT_IN.snapshot, parseCatalogFile(text), { needClips: false });
    expect(built.problems).toEqual([]);
    expect(built.usedFile).toBe(true);
    expect(built.catalog.showsOf(someone.id).map((s) => s.venue)).toEqual(['Mission Ballroom']);
  });

  it('the bundled catalogue has none', () => {
    expect(BUILT_IN.snapshot.shows).toBeUndefined();
    expect(BUILT_IN.catalog.shows).toEqual([]);
  });
});
