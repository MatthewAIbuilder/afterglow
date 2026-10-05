import { describe, expect, it } from '@jest/globals';
import { MOCK_SNAPSHOT } from '../../../data/mock';
import { parseCatalogFile } from '../../../data/file';
import { applyPatches, asPatch, buildCatalog } from '../../../data/merge';
import type { Festival } from '../../../data/models';
import { buildDraft, datesText, draftLine, festivalToFile, websiteUpdate, weekdaysBetween } from '../draft';
import { claudeBrief, fileSummary, fileSummaryLine, looksLikeCatalogFile, plusUntil, sizeLabel } from '../drops';
import { actAndStage, dayHeading, readSetList, readTimes, withEnds } from '../setlist';

const TIMETABLE = `FRIDAY
Main Stage
9:00 PM - 10:30 PM  ILLENIUM
10:30 - 12:00 SUBTRONICS
Bass Tent:
22:00–23:30 LEVITY
11:30-1:00 AM TAPE B b2b Pirate
SATURDAY DEC 5
10pm KNOCK2 @ Main Stage
11:15 Zeds Dead (Bass Tent)`;

describe('reading set times from text', () => {
  it('reads days, stages and sets in every common way of writing them', () => {
    const r = readSetList(TIMETABLE);
    expect(r.days).toEqual(['Friday', 'Saturday']);
    expect(r.stages).toEqual(['Main Stage', 'Bass Tent']);
    expect(r.sets.map((s) => [s.name, s.day, s.stage, s.start, s.end ?? null])).toEqual([
      ['ILLENIUM', 'Friday', 'Main Stage', '21:00', '22:30'],
      ['SUBTRONICS', 'Friday', 'Main Stage', '22:30', '00:00'],
      ['LEVITY', 'Friday', 'Bass Tent', '22:00', '23:30'],
      ['TAPE B b2b Pirate', 'Friday', 'Bass Tent', '23:30', '01:00'],
      ['KNOCK2', 'Saturday', 'Main Stage', '22:00', null],
      ['Zeds Dead', 'Saturday', 'Bass Tent', '23:15', null],
    ]);
    expect(r.sets[1].guessed).toBe(true);
    expect(r.unread).toEqual([]);
  });

  it('works out missing ends from the next set on the stage', () => {
    const ends = withEnds(readSetList('Friday\nMain Stage\n10:00 PM A\n11:15 PM B').sets);
    expect(ends.map((s) => [s.name, s.end, s.endGuessed])).toEqual([
      ['A', '23:15', true],
      ['B', '00:15', true],
    ]);
  });

  it('reads a plain lineup, with days, bullets and dots', () => {
    const r = readSetList('LINEUP\nFriday\n- SUBTRONICS\n• LEVITY\nSaturday\nDimension • Sullivan King • Wooli\nTBA');
    expect(r.acts).toEqual([
      { name: 'SUBTRONICS', days: ['Friday'] },
      { name: 'LEVITY', days: ['Friday'] },
      { name: 'Dimension', days: ['Saturday'] },
      { name: 'Sullivan King', days: ['Saturday'] },
      { name: 'Wooli', days: ['Saturday'] },
    ]);
    expect(r.sets).toEqual([]);
  });

  it('never mistakes numbers in names for times', () => {
    expect(readTimes('Stage 2 Act')).toBeUndefined();
    expect(readTimes('2026 lineup')).toBeUndefined();
    expect(readTimes('KNOCK2')).toBeUndefined();
    expect(readTimes('Stage 2 10:30 PM KNOCK2')).toMatchObject({ start: 22 * 60 + 30 });
    expect(dayHeading('Sat Dec 5')).toBe('Saturday');
    expect(dayHeading('Saturday Night Live')).toBeUndefined();
    expect(dayHeading('Dec 30', ['Dec 30', 'Dec 31'])).toBe('Dec 30');
    expect(actAndStage('LEVITY - Bass Tent')).toEqual({ name: 'LEVITY', stage: 'Bass Tent' });
    expect(actAndStage('Above & Beyond')).toEqual({ name: 'Above & Beyond' });
  });
});

const festival: Festival = MOCK_SNAPSHOT.festivals[0];

describe('a draft update for a festival', () => {
  it('keeps everything an existing festival has and adds what the text says', () => {
    const names = festival.lineup.slice(0, 2).map((id) => MOCK_SNAPSHOT.artists.find((a) => a.id === id)!.name);
    const text = `${festival.days[0]}\n${festival.stages[0].name}\n9:00 PM ${names[0]}\n10:00 PM Brand New Act`;
    const d = buildDraft(readSetList(text), { kind: 'existing', festival }, MOCK_SNAPSHOT.artists, { today: '2026-10-03' });
    expect(d.festivalId).toBe(festival.id);
    expect(d.matched).toEqual([names[0]]);
    expect(d.added).toEqual(['Brand New Act']);
    const parsed = parseCatalogFile(d.file);
    expect(parsed.problems).toEqual([]);
    // The update carries only what the text adds: the new act and the two sets, not the festival whole.
    const written = d.file.festivals[0];
    expect(written.lineup).toBeUndefined();
    expect(written.sets).toBeUndefined();
    // The new act, and the known act now listed under that day.
    expect(parsed.festivalParts?.[festival.id]?.add?.lineup).toEqual([festival.lineup[0], 'brand-new-act']);
    expect(parsed.festivalParts?.[festival.id]?.add?.sets?.length).toBe(2);
    const built = buildCatalog(MOCK_SNAPSHOT, asPatch(parsed, MOCK_SNAPSHOT));
    expect(built.usedFile).toBe(true);
    const f = built.catalog.festival(festival.id)!;
    expect(f.lineup.slice(0, festival.lineup.length)).toEqual(festival.lineup);
    expect(f.lineup).toContain('brand-new-act');
    expect(f.sets?.find((s) => s.artistId === 'brand-new-act')).toMatchObject({ day: festival.days[0], stageId: festival.stages[0].id, start: '22:00', end: '23:00' });
    expect(f.sets?.filter((s) => s.artistId === festival.lineup[0] && s.day === festival.days[0])).toHaveLength(1);
    expect(f.stages).toEqual(festival.stages);
    expect(draftLine(d)).toBe('2 acts (1 already on Afterglow, 1 new) · 2 set times over ' + `${d.days.length} ${d.days.length === 1 ? 'day' : 'days'}`);
  });

  it('makes a new festival from its name and dates', () => {
    const d = buildDraft(readSetList('SUBTRONICS\nNew Person'), { kind: 'new', name: 'Lost Lands', start: '2027-09-17', end: '2027-09-19', location: 'Legend Valley' }, MOCK_SNAPSHOT.artists, {
      today: '2026-10-03',
      festivalIds: ['lost-lands-2027'],
    });
    const f = parseCatalogFile(d.file).snapshot!.festivals[0];
    expect(f).toMatchObject({ id: 'lost-lands-2027-2', name: 'Lost Lands', dates: 'Sep 17 to 19', location: 'Legend Valley', startDate: '2027-09-17', endDate: '2027-09-19', days: ['Friday', 'Saturday', 'Sunday'] });
    expect(datesText('2026-12-31', '2027-01-01')).toBe('Dec 31 to Jan 1');
    expect(weekdaysBetween('2026-12-04', '2026-12-06')).toEqual(['Friday', 'Saturday', 'Sunday']);
  });

  it('replaces the lineup when asked, keeping set times of acts still on it', () => {
    const name = MOCK_SNAPSHOT.artists.find((a) => a.id === festival.lineup[0])!.name;
    const d = buildDraft(readSetList(name), { kind: 'existing', festival }, MOCK_SNAPSHOT.artists, { lineup: 'replace', today: '2026-10-03' });
    const parsed = parseCatalogFile(d.file);
    const f = parsed.snapshot!.festivals[0];
    expect(f.lineup).toEqual([festival.lineup[0]]);
    expect((f.sets ?? []).every((s) => s.artistId === festival.lineup[0])).toBe(true);
    // Applied, the lineup and its sets are exactly that; the rest of the festival stays the catalogue's.
    const out = buildCatalog(MOCK_SNAPSHOT, asPatch(parsed, MOCK_SNAPSHOT)).catalog.festival(festival.id)!;
    expect(out.lineup).toEqual([festival.lineup[0]]);
    expect((out.sets ?? []).every((s) => s.artistId === festival.lineup[0])).toBe(true);
    expect(out.stages).toEqual(festival.stages);
  });

  it('writes a festival back without losing anything', () => {
    const back = parseCatalogFile({ version: 1, artists: [], clips: [], festivals: [festivalToFile(festival)] }).snapshot!.festivals[0];
    expect(back).toEqual(festival);
  });
});

describe('published updates', () => {
  it('apply on top of the catalogue, oldest first, skipping one that can’t be used', () => {
    const base = buildCatalog(MOCK_SNAPSHOT, undefined);
    const d = buildDraft(readSetList('Brand New Act'), { kind: 'existing', festival }, MOCK_SNAPSHOT.artists, { today: '2026-10-03' });
    const out = applyPatches(base, [{ file: 'not json' }, { file: JSON.stringify(d.file) }], parseCatalogFile);
    expect(out.catalog.festival(festival.id)?.lineup).toContain('brand-new-act');
    expect(out.catalog.artist('brand-new-act')?.name).toBe('Brand New Act');
    expect(out.problems.length).toBeGreaterThan(0);
    expect(applyPatches(base, [], parseCatalogFile).catalog).toBe(base.catalog);
  });

  it('only ever add, and never mask an artist’s own record or a festival’s later dates', () => {
    const base = buildCatalog(MOCK_SNAPSHOT, undefined);
    const known = MOCK_SNAPSHOT.artists[0];
    // A "replace" file is laid over as an addition: everyone else stays.
    const replace = { mode: 'replace', festivals: [{ ...festivalToFile(festival), name: 'Renamed', dates: 'Jan 1 to 2', lineup: [known.id], sets: [] }], artists: [{ id: known.id, name: 'Bare' }] };
    const out = applyPatches(base, [{ file: JSON.stringify(replace) }], parseCatalogFile);
    expect(out.catalog.festivals.length).toBe(base.catalog.festivals.length);
    // The festival takes its lineup from the update, not its name or dates; the artist keeps their own record.
    expect(out.catalog.festival(festival.id)?.lineup[0]).toBe(known.id);
    expect(out.catalog.festival(festival.id)?.name).toBe(festival.name);
    expect(out.catalog.artist(known.id)?.name).toBe(known.name);
  });

  it('carry only what they change, so later catalogue fixes show and taking one down undoes only it', () => {
    const withTickets: Festival = { ...festival, links: { tickets: 'https://tickets.example/x' } };
    const snapshot = { ...MOCK_SNAPSHOT, festivals: MOCK_SNAPSHOT.festivals.map((f) => (f.id === festival.id ? withTickets : f)) };
    const site = websiteUpdate(withTickets, 'https://festival.example', '2026-10-05')!;
    expect(Object.keys((site as { festivals: object[] }).festivals[0]).sort()).toEqual(['dates', 'id', 'name', 'website']);
    const draft = buildDraft(readSetList('Brand New Act'), { kind: 'existing', festival: withTickets }, MOCK_SNAPSHOT.artists, { today: '2026-10-05' });
    const patches = [{ file: JSON.stringify(site) }, { file: JSON.stringify(draft.file) }];
    // The catalogue fixes a set time and drops an act after both were published: both fixes still show.
    const fixedSets = (festival.sets ?? []).map((s, i) => (i === 0 ? { ...s, start: '12:00' } : s));
    const dropped = festival.lineup[festival.lineup.length - 1];
    const fixed = {
      ...snapshot,
      festivals: snapshot.festivals.map((f) =>
        f.id === festival.id ? { ...withTickets, lineup: f.lineup.filter((a) => a !== dropped), sets: fixedSets.filter((s) => s.artistId !== dropped) } : f,
      ),
    };
    const out = applyPatches(buildCatalog(fixed, undefined), patches, parseCatalogFile).catalog.festival(festival.id)!;
    expect(out.links).toEqual({ tickets: 'https://tickets.example/x', website: 'https://festival.example/' });
    expect(out.lineup).not.toContain(dropped);
    expect(out.lineup).toContain('brand-new-act');
    if (fixedSets[0] && fixedSets[0].artistId !== dropped) expect(out.sets?.[0].start).toBe('12:00');
    // Taking the website down leaves the lineup update; taking the lineup down leaves the website.
    const noSite = applyPatches(buildCatalog(snapshot, undefined), [patches[1]], parseCatalogFile).catalog.festival(festival.id)!;
    expect(noSite.links).toEqual({ tickets: 'https://tickets.example/x' });
    expect(noSite.lineup).toContain('brand-new-act');
    const noLineup = applyPatches(buildCatalog(snapshot, undefined), [patches[0]], parseCatalogFile).catalog.festival(festival.id)!;
    expect(noLineup.lineup).toEqual(festival.lineup);
    expect(noLineup.links?.website).toBe('https://festival.example/');
  });

  it('leave out a partial update for a festival no longer on Afterglow', () => {
    const gone = { version: 1, artists: [], clips: [], festivals: [{ id: 'gone-fest', name: 'Gone', dates: 'Jan 1', website: 'https://gone.example' }] };
    const out = applyPatches(buildCatalog(MOCK_SNAPSHOT, undefined), [{ file: JSON.stringify(gone) }], parseCatalogFile);
    expect(out.catalog.festival('gone-fest')).toBeUndefined();
  });
});

describe('the inbox', () => {
  it('hands an upload to a Claude Code session with links it can open', () => {
    const brief = claudeBrief(
      { id: 'drop-1', by: 'hq', festivalId: 'edc-orlando-26', note: 'Weekend set times', files: [{ name: 'times.png', type: 'image/png', size: 2_200_000, path: 'drops/drop-1/1-times.png', url: 'https://files.example/times.png' }], status: 'waiting', createdAt: '2026-10-03T10:00:00Z' },
      'EDC Orlando 2026',
    );
    expect(brief).toContain('Festival: EDC Orlando 2026 (id edc-orlando-26)');
    expect(brief).toContain('1. times.png (image/png, 2.1 MB): https://files.example/times.png');
    expect(brief).toContain('(Upload drop-1)');
    expect(sizeLabel(340_000)).toBe('332 KB');
  });

  it('knows a pasted catalogue update from a set list, and sums it up', () => {
    const d = buildDraft(readSetList('Brand New Act'), { kind: 'existing', festival }, MOCK_SNAPSHOT.artists, { today: '2026-10-03' });
    const text = JSON.stringify(d.file, null, 2);
    expect(looksLikeCatalogFile(text)).toBe(true);
    expect(looksLikeCatalogFile('Friday\n10pm A')).toBe(false);
    const s = fileSummary(parseCatalogFile(text), { artist: (id) => MOCK_SNAPSHOT.artists.find((a) => a.id === id) });
    // The update carries only the new act, so that's what it sums up.
    expect(fileSummaryLine(s)).toBe(`${festival.name}: 1 act, 1 new to Afterglow`);
    expect(plusUntil(0, new Date(2026, 9, 3))).toBeUndefined();
    expect(plusUntil(1, new Date(2026, 9, 3))).toBe(new Date(2026, 10, 3).toISOString());
  });
});
