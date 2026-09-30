import { describe, expect, it } from '@jest/globals';
import { BUILT_IN } from '../../bundled';
import { parseCatalogFile } from '../../file';
import { buildCatalog } from '../../merge';
import { type CuratedCatalogue, type EdmtrainEvent, datesLabel, edmtrainCatalogue, fold, slug } from '../edmtrain';

const venue = { id: 7, name: 'Harbor Park', location: 'Tampa, FL' };
const acts = (...names: string[]) => names.map((name, i) => ({ id: i + 1, name }));
const day = (date: string, names: string[], over: Partial<EdmtrainEvent> = {}): EdmtrainEvent => ({
  id: Number(date.replace(/-/g, '')),
  link: 'https://edmtrain.com/tampa-fl/harbor-fest-123',
  name: 'Harbor Fest',
  date,
  festivalInd: true,
  venue,
  artistList: acts(...names),
  ...over,
});

const curated: CuratedCatalogue = {
  artists: [
    { id: 'subtronics', name: 'Subtronics' },
    { id: 'rufus-du-sol', name: 'RÜFÜS DU SOL' },
  ],
  festivals: [{ id: 'edc-orlando-26', name: 'EDC Orlando 2026', location: 'Tinker Field, Orlando', start: '2026-11-06', end: '2026-11-08' }],
};
const TODAY = '2026-09-30';

describe('EDMTrain import helpers', () => {
  it('folds and slugs names', () => {
    expect(fold('RÜFÜS DU SOL')).toBe('rufusdusol');
    expect(fold('Above & Beyond')).toBe('aboveandbeyond');
    expect(slug('Électric Forest 2027!')).toBe('electric-forest-2027');
    expect(slug('!!!')).toBe('event');
  });

  it('writes dates the way the catalogue does', () => {
    expect(datesLabel('2026-11-06', '2026-11-06')).toBe('Nov 6');
    expect(datesLabel('2026-12-30', '2026-12-31')).toBe('Dec 30 and 31');
    expect(datesLabel('2026-12-31', '2027-01-01')).toBe('Dec 31 and Jan 1');
    expect(datesLabel('2026-11-06', '2026-11-08')).toBe('Nov 6 to 8');
    expect(datesLabel('2026-10-30', '2026-11-01')).toBe('Oct 30 to Nov 1');
  });
});

describe('edmtrainCatalogue', () => {
  it('groups a festival listed day by day back into one, with each act on their days', () => {
    const events = [
      day('2026-11-13', ['Subtronics', 'Alpha', 'Bravo', 'Charlie']),
      day('2026-11-14', ['Delta', 'Echo', 'Alpha', 'rufus du sol']),
    ];
    const { file } = edmtrainCatalogue(events, curated, TODAY);
    expect(file.festivals).toHaveLength(1);
    const f = file.festivals[0];
    expect(f).toMatchObject({
      id: 'harbor-fest-2026',
      name: 'Harbor Fest',
      dates: 'Nov 13 and 14',
      location: 'Harbor Park, Tampa, FL',
      start: '2026-11-13',
      end: '2026-11-14',
      days: ['Friday', 'Saturday'],
      source: { name: 'EDMTrain', url: 'https://edmtrain.com/tampa-fl/harbor-fest-123' },
    });
    expect(f.weekends).toBeUndefined();
    // Artists already on Afterglow keep their ids; Alpha plays both days so has no days listed.
    expect(f.lineup).toEqual([
      { artist: 'subtronics', days: ['Friday'] },
      'alpha',
      { artist: 'bravo', days: ['Friday'] },
      { artist: 'charlie', days: ['Friday'] },
      { artist: 'delta', days: ['Saturday'] },
      { artist: 'echo', days: ['Saturday'] },
      { artist: 'rufus-du-sol', days: ['Saturday'] },
    ]);
    // Only new artists are added, with no sound yet.
    expect(file.artists.map((a) => a.id)).toEqual(['alpha', 'bravo', 'charlie', 'delta', 'echo']);
    expect(file.artists[0]).toEqual({ id: 'alpha', name: 'Alpha', sound: {} });
  });

  it('makes two runs a few weeks apart two weekends, and marks acts on only one', () => {
    const events = [
      day('2026-10-02', ['Alpha', 'Bravo', 'Charlie']),
      day('2026-10-03', ['Delta', 'Echo']),
      day('2026-10-09', ['Alpha', 'Foxtrot', 'Charlie']),
      day('2026-10-10', ['Delta', 'Golf']),
    ];
    const f = edmtrainCatalogue(events, curated, TODAY).file.festivals[0];
    expect(f.weekends).toEqual([
      { start: '2026-10-02', end: '2026-10-03' },
      { start: '2026-10-09', end: '2026-10-10' },
    ]);
    expect(f.dates).toBe('Oct 2 to 10');
    expect(f.lineup).toContainEqual({ artist: 'alpha', days: ['Friday'] });
    expect(f.lineup).toContainEqual({ artist: 'bravo', days: ['Friday'], weekend: 1 });
    expect(f.lineup).toContainEqual({ artist: 'golf', days: ['Saturday'], weekend: 2 });
  });

  it('never duplicates a festival curated by hand', () => {
    const edc = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'];
    const events = [
      day('2026-11-06', edc, { name: 'Electric Daisy Carnival Orlando', venue: { id: 9, name: 'Tinker Field', location: 'Orlando, FL' } }),
      day('2026-11-07', edc, { name: 'Electric Daisy Carnival Orlando', venue: { id: 9, name: 'Tinker Field', location: 'Orlando, FL' } }),
    ];
    const { file, skipped } = edmtrainCatalogue(events, curated, TODAY);
    expect(file.festivals).toEqual([]);
    expect(file.artists).toEqual([]);
    expect(skipped.curated).toBe(1);
  });

  it('leaves out small, past, far-off and non-festival events', () => {
    const events = [
      day('2026-11-13', ['Alpha', 'Bravo']), // too small
      day('2026-09-01', ['A', 'B', 'C', 'D', 'E'], { name: 'Over Fest', venue: { id: 2 } }),
      day('2028-01-01', ['A', 'B', 'C', 'D', 'E'], { name: 'Far Fest', venue: { id: 3 } }),
      day('2026-11-20', ['A', 'B', 'C', 'D', 'E'], { name: 'Club Night', festivalInd: false, venue: { id: 4 } }),
      day('not a date', ['A', 'B', 'C', 'D', 'E'], { name: 'Broken', venue: { id: 5 } }),
    ];
    const { file, skipped } = edmtrainCatalogue(events, curated, TODAY);
    expect(file.festivals).toEqual([]);
    expect(skipped).toEqual({ curated: 0, small: 1, outOfRange: 2 });
  });

  it('keeps the soonest festivals when there are too many, and gives each a unique id', () => {
    const events = ['2026-12-01', '2026-11-01', '2026-10-15'].map((d, i) =>
      day(d, ['A', 'B', 'C', 'D', 'E'], { name: 'Same Name', venue: { id: 10 + i } }),
    );
    const { file } = edmtrainCatalogue(events, curated, TODAY, { minActs: 5, maxDaysAhead: 365, maxFestivals: 2 });
    expect(file.festivals.map((f) => f.start)).toEqual(['2026-10-15', '2026-11-01']);
    expect(new Set(file.festivals.map((f) => f.id)).size).toBe(2);
  });

  it('writes a file the app reads with no problems', () => {
    const events = [
      day('2026-10-02', ['Subtronics', 'Alpha', 'Bravo']),
      day('2026-10-03', ['Delta', 'Echo', 'Élan Vital']),
      day('2026-10-09', ['Alpha', 'Foxtrot']),
      day('2026-10-10', ['Delta', 'Golf'], { link: 'http://not-secure.example' }),
    ];
    const { file } = edmtrainCatalogue(events, curated, TODAY);
    const parsed = parseCatalogFile(JSON.stringify(file));
    // Subtronics isn't in this file (it's in the curated one), which the app joins up when merging.
    expect(parsed.problems.filter((p) => !p.includes('subtronics'))).toEqual([]);
    const f = parsed.snapshot!.festivals[0];
    expect(f.source).toEqual({ name: 'EDMTrain', url: 'https://edmtrain.com/tampa-fl/harbor-fest-123' });
    expect(f.weekends).toHaveLength(2);
    expect(f.artistWeekends?.bravo).toBe(1);
    expect(f.artistDays?.echo).toEqual(['Saturday']);
  });

  it('adds to the built-in catalogue without touching curated festivals', () => {
    const events = [day('2026-11-13', ['Subtronics', 'Levity', 'Alpha']), day('2026-11-14', ['Delta', 'Echo'])];
    const curatedNow = {
      artists: BUILT_IN.snapshot.artists.map((a) => ({ id: a.id, name: a.name })),
      festivals: BUILT_IN.snapshot.festivals.map((f) => ({ id: f.id, name: f.name, location: f.location, start: f.startDate, end: f.endDate })),
    };
    const { file } = edmtrainCatalogue(events, curatedNow, TODAY);
    const built = buildCatalog(BUILT_IN.snapshot, parseCatalogFile(JSON.stringify(file)));
    expect(built.usedFile).toBe(true);
    expect(built.problems).toEqual([]);
    expect(built.catalog.festival('harbor-fest-2026')?.source?.name).toBe('EDMTrain');
    expect(built.catalog.festival('edc-orlando-26')).toEqual(BUILT_IN.catalog.festival('edc-orlando-26'));
    expect(built.catalog.artist('levity')).toEqual(BUILT_IN.catalog.artist('levity'));
  });
});
