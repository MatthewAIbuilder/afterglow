import { describe, expect, it } from '@jest/globals';
import bundled from '../../../catalogue/afterglow.json';
import example from '../../../docs/catalogue-example.json';
import { BUILT_IN } from '../bundled';
import { parseCatalogFile, parseSeconds, parseYouTubeLink, safeImageUrl } from '../file';
import { asPatch, buildCatalog, mergeSnapshots } from '../merge';
import { MOCK_CATALOG, MOCK_SNAPSHOT } from '../mock';
import { refreshCatalog, type TextStore } from '../remote';

describe('reading friendly values', () => {
  it('reads times as seconds', () => {
    expect(parseSeconds('25:00')).toBe(1500);
    expect(parseSeconds('1:02:30')).toBe(3750);
    expect(parseSeconds('90')).toBe(90);
    expect(parseSeconds(45)).toBe(45);
    expect(parseSeconds('25m')).toBeUndefined();
    expect(parseSeconds(-1)).toBeUndefined();
    expect(parseSeconds('1:2:3:4')).toBeUndefined();
  });

  it('finds the video in any kind of YouTube link', () => {
    const id = 'JssDaUK0_GQ';
    expect(parseYouTubeLink(`https://www.youtube.com/watch?v=${id}`)).toEqual({ videoId: id, vertical: false });
    expect(parseYouTubeLink(`https://www.youtube.com/watch?list=x&v=${id}&t=1500s`)).toEqual({ videoId: id, vertical: false });
    expect(parseYouTubeLink(`https://youtu.be/${id}?t=12`)).toEqual({ videoId: id, vertical: false });
    expect(parseYouTubeLink(`https://m.youtube.com/watch?v=${id}`)).toEqual({ videoId: id, vertical: false });
    expect(parseYouTubeLink(`https://www.youtube.com/shorts/${id}`)).toEqual({ videoId: id, vertical: true });
    expect(parseYouTubeLink(`https://www.youtube.com/live/${id}`)).toEqual({ videoId: id, vertical: false });
    expect(parseYouTubeLink(id)).toEqual({ videoId: id, vertical: false });
    expect(parseYouTubeLink('https://vimeo.com/123')).toBeUndefined();
    expect(parseYouTubeLink(`https://evil.example/watch?v=${id}`)).toBeUndefined();
  });

  it('accepts only secure image links', () => {
    expect(safeImageUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
    expect(safeImageUrl('http://example.com/a.jpg')).toBeUndefined();
    expect(safeImageUrl('javascript:alert(1)')).toBeUndefined();
  });
});

describe('catalogue files', () => {
  it('turns the example from the guide into app data with no problems', () => {
    const parsed = parseCatalogFile(example);
    expect(parsed.problems).toEqual([]);
    expect(parsed.mode).toBe('add');
    expect(parsed.updated).toBe('2026-09-29');
    const [clip] = parsed.snapshot!.clips;
    expect(clip.source).toEqual({ provider: 'youtube', videoId: 'JssDaUK0_GQ', start: 1500, end: 1545, channel: 'Lost Lands' });
    expect(clip.durationSec).toBe(45);
    expect(parsed.snapshot!.festivals[0].sets![1]).toEqual({ artistId: 'illenium', day: 'Friday', stageId: 'main', start: '23:30', end: '01:00' });

    const built = buildCatalog(MOCK_SNAPSHOT, parsed);
    expect(built.problems).toEqual([]);
    expect(built.usedFile).toBe(true);
    // Added first, so Discover opens on it; the demo festivals are still there.
    expect(built.catalog.festivals.map((f) => f.id)).toEqual(['nightfall-27', 'solstice-26', 'horizon-27']);
    expect(built.catalog.festivalsOf('illenium').map((f) => f.id)).toEqual(['nightfall-27', 'solstice-26']);
    expect(built.catalog.similarities).toEqual([{ artistId: 'aurora-drift', otherId: 'illenium', score: 0.7 }]);
  });

  it('keeps catalogue/afterglow.json free of mistakes', () => {
    // Whatever real data goes in, it must read cleanly and leave the app with festivals to show.
    expect(parseCatalogFile(bundled).problems).toEqual([]);
    expect(BUILT_IN.problems).toEqual([]);
    expect(BUILT_IN.catalog.festivals.length).toBeGreaterThan(0);
    expect(BUILT_IN.catalog.clips.length).toBeGreaterThan(0);
  });

  it('changes nothing with an empty file', () => {
    const built = buildCatalog(MOCK_SNAPSHOT, parseCatalogFile({ version: 1, mode: 'add', artists: [], festivals: [], clips: [] }));
    expect(built.problems).toEqual([]);
    expect(built.catalog.festivals).toEqual(MOCK_CATALOG.festivals);
    expect(built.catalog.clips).toEqual(MOCK_CATALOG.clips);
  });

  it('never throws, and says plainly why a file can’t be used', () => {
    for (const bad of ['{ not json', '[]', 'null', '42', JSON.stringify({ version: 2 }), undefined, null]) {
      const parsed = parseCatalogFile(bad);
      expect(parsed.snapshot).toBeUndefined();
      expect(parsed.problems.length).toBe(1);
    }
    expect(parseCatalogFile('{ not json').problems[0]).toMatch(/valid JSON/);
  });

  it('keeps the good records and explains the rest', () => {
    const parsed = parseCatalogFile({
      version: 1,
      artists: [
        { id: 'ok', name: 'OK', sound: { house: 1, jazz: 1 }, image: 'http://insecure.example/x.jpg' },
        { id: 'has spaces', name: 'Bad id' },
        'not an object',
      ],
      festivals: [
        {
          id: 'fest',
          name: 'Fest',
          dates: 'Jun 1',
          lineup: ['ok', 'not ok!'],
          days: ['Friday'],
          stages: [{ id: 'main', name: 'Main' }, { id: 'x' }],
          poster: 'ftp://x',
          sets: [
            { artist: 'ok', day: 'Friday', stage: 'main', start: '9:30', end: '10:30' },
            { artist: 'ok', day: 'Friday', stage: 'main', start: '25:00', end: '10:30' },
          ],
        },
        { id: 'nameless' },
      ],
      clips: [
        { id: 'v', artist: 'ok', festival: 'fest', title: 'Video', video: { link: 'https://youtu.be/JssDaUK0_GQ', from: '1:00', to: '1:30', channel: 'Fest' } },
        { id: 'long', artist: 'ok', festival: 'fest', title: 'Too long', video: { link: 'https://youtu.be/JssDaUK0_GQ', from: '0', to: '10:00', channel: 'Fest' }, seconds: 20 },
        { id: 'nolink', artist: 'ok', festival: 'fest', title: 'Bad link', video: { link: 'https://vimeo.com/1', from: '0', to: '30', channel: 'Fest' } },
        { id: 'stage', artist: 'ok', festival: 'fest', title: 'Stage', seconds: '0:20' },
      ],
      similar: [{ artist: 'ok', other: 'ok2', score: 5 }],
    });
    const s = parsed.snapshot!;
    expect(s.artists.map((a) => a.id)).toEqual(['ok']);
    expect(s.artists[0].sound).toEqual({ house: 1 });
    expect(s.artists[0].imageUrl).toBeUndefined();
    expect(s.festivals.map((f) => f.id)).toEqual(['fest']);
    expect(s.festivals[0].lineup).toEqual(['ok']);
    expect(s.festivals[0].posterImageUrl).toBeUndefined();
    expect(s.festivals[0].sets).toEqual([{ artistId: 'ok', day: 'Friday', stageId: 'main', start: '09:30', end: '10:30' }]);
    // A clip whose video can't be used keeps playing as a stage clip if it has a length.
    expect(s.clips.map((c) => [c.id, !!c.source, c.durationSec])).toEqual([
      ['v', true, 30],
      ['long', false, 20],
      ['stage', false, 20],
    ]);
    expect(s.similarities).toEqual([]);
    expect(parsed.problems.length).toBeGreaterThanOrEqual(10);
    for (const p of parsed.problems) expect(p).not.toMatch(/undefined|\[object/);
  });

  it('reads set notes and real dates, and checks them', () => {
    const parsed = parseCatalogFile({
      version: 1,
      artists: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      festivals: [
        { id: 'f', name: 'F', dates: 'Nov 6 to 8', start: '2026-11-06', end: '2026-11-08', lineup: [{ artist: 'a', note: 'Sunset set' }, 'b', { artist: 'b', note: 7 }, { note: 'x' }] },
        { id: 'g', name: 'G', dates: 'Feb', start: '2026-02-30', lineup: [] },
        { id: 'h', name: 'H', dates: 'Soon', start: '2026-05-02', end: '2026-05-01', lineup: [] },
      ],
      clips: [],
    });
    const [f, g, h] = parsed.snapshot!.festivals;
    expect(f).toMatchObject({ startDate: '2026-11-06', endDate: '2026-11-08', notes: { a: 'Sunset set' } });
    expect(f.lineup).toEqual(['a', 'b', 'b']);
    expect(g.startDate).toBeUndefined();
    expect(h.startDate).toBeUndefined();
    expect(parsed.problems.some((p) => /note for "b"/.test(p))).toBe(true);
    expect(parsed.problems.some((p) => /date like/.test(p))).toBe(true);
    expect(parsed.problems.some((p) => /ends before it starts/.test(p))).toBe(true);
    // A note for someone who isn't on the lineup is dropped when checked.
    const built = buildCatalog(MOCK_SNAPSHOT, {
      ...parsed,
      snapshot: { ...parsed.snapshot!, festivals: [{ ...f, lineup: ['a'], notes: { a: 'Sunset set', b: 'Closing set' } }] },
    });
    expect(built.catalog.festival('f')?.notes).toEqual({ a: 'Sunset set' });
  });

  it('reads the day each act plays from the lineup, and checks it', () => {
    const parsed = parseCatalogFile({
      version: 1,
      artists: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      festivals: [
        { id: 'f', name: 'F', dates: 'Oct', days: ['Friday', 'Saturday'], lineup: [{ artist: 'a', days: ['Friday'] }, { artist: 'b', days: ['Monday', 'Saturday'] }, { artist: 'a', days: 'Friday' }] },
      ],
      clips: [],
    });
    expect(parsed.problems.some((p) => /should be a list like \["Friday"\]/.test(p))).toBe(true);
    const built = buildCatalog(MOCK_SNAPSHOT, parsed);
    expect(built.catalog.festival('f')?.artistDays).toEqual({ a: ['Friday'], b: ['Saturday'] });
    expect(built.problems.some((p) => /a day was left out/.test(p))).toBe(true);
  });

  it('reads the weekends of a festival run over two, and checks them', () => {
    const weekend = (start: string, end: string) => ({ start, end });
    const parsed = parseCatalogFile({
      version: 1,
      festivals: [
        { id: 'acl', name: 'ACL', dates: 'Oct', lineup: [], weekends: [weekend('2026-10-02', '2026-10-04'), weekend('2026-10-09', '2026-10-11')] },
        { id: 'one', name: 'One', dates: 'Oct', lineup: [], weekends: [weekend('2026-10-02', '2026-10-04')] },
        { id: 'order', name: 'Order', dates: 'Oct', lineup: [], weekends: [weekend('2026-10-09', '2026-10-11'), weekend('2026-10-02', '2026-10-04')] },
        { id: 'bad', name: 'Bad', dates: 'Oct', lineup: [], weekends: [weekend('2026-10-02', 'soon'), weekend('2026-10-09', '2026-10-11')] },
      ],
    });
    const [acl, one, order, bad] = parsed.snapshot!.festivals;
    expect(acl).toMatchObject({ startDate: '2026-10-02', endDate: '2026-10-11' });
    expect(acl.weekends).toHaveLength(2);
    for (const f of [one, order, bad]) expect(f.weekends).toBeUndefined();
    expect(parsed.problems.filter((p) => /"weekends" should list/.test(p))).toHaveLength(3);
  });

  it('marks YouTube Shorts as vertical', () => {
    const parsed = parseCatalogFile({
      version: 1,
      clips: [{ id: 's', artist: 'a', festival: 'f', title: 'Short', video: { link: 'https://www.youtube.com/shorts/JssDaUK0_GQ', from: 0, to: 30, channel: 'A' } }],
    });
    expect(parsed.snapshot!.clips[0].source?.vertical).toBe(true);
  });
});

describe('putting a file on top of the demo data', () => {
  const extra = parseCatalogFile(example).snapshot!;

  it('adds new records first and lets the file correct existing ones', () => {
    const fixed = { ...extra, artists: [...extra.artists, { id: 'levity', name: 'LEVITY (corrected)', sound: { dubstep: 1 } }] };
    const merged = mergeSnapshots(MOCK_SNAPSHOT, fixed);
    expect(merged.artists.filter((a) => a.id === 'levity')).toEqual([{ id: 'levity', name: 'LEVITY (corrected)', sound: { dubstep: 1 } }]);
    expect(merged.artists.length).toBe(MOCK_SNAPSHOT.artists.length + 1);
    expect(merged.clips.length).toBe(MOCK_SNAPSHOT.clips.length + 2);
  });

  it('can replace the demo data entirely', () => {
    const built = buildCatalog(MOCK_SNAPSHOT, { ...parseCatalogFile(example), mode: 'replace' });
    expect(built.catalog.festivals.map((f) => f.id)).toEqual(['nightfall-27']);
    // Artists the file only mentions by id are dropped, with a note.
    expect(built.catalog.artists.map((a) => a.id)).toEqual(['aurora-drift']);
    expect(built.problems.length).toBeGreaterThan(0);
  });

  it('never leaves the app with nothing to show', () => {
    const empty = buildCatalog(MOCK_SNAPSHOT, { ...parseCatalogFile({ version: 1 }), mode: 'replace' });
    expect(empty.usedFile).toBe(false);
    expect(empty.catalog.festivals.length).toBe(MOCK_SNAPSHOT.festivals.length);
    expect(buildCatalog(MOCK_SNAPSHOT, parseCatalogFile('oops')).usedFile).toBe(false);
  });
});

describe('a hosted catalogue file', () => {
  const good = JSON.stringify(example);
  const memory = (initial: string | null = null) => {
    let text = initial;
    const store: TextStore = { get: async () => text, set: async (t) => void (text = t) };
    return { store, read: () => text };
  };
  const run = async (opts: { fetched?: string | Error; saved?: string | null; url?: string }) => {
    const mem = memory(opts.saved ?? null);
    const got: { from: string; festivals: string[] }[] = [];
    const problems: string[] = [];
    await refreshCatalog({
      url: opts.url ?? 'https://example.com/afterglow.json',
      base: MOCK_SNAPSHOT,
      fetchText: async () => {
        if (opts.fetched instanceof Error) throw opts.fetched;
        return opts.fetched ?? '';
      },
      store: mem.store,
      onCatalog: (b, from) => got.push({ from, festivals: b.catalog.festivals.map((f) => f.id) }),
      onProblems: (p) => problems.push(...p),
    });
    return { got, saved: mem.read(), problems };
  };

  it('uses a good file and remembers it', async () => {
    const r = await run({ fetched: good });
    expect(r.got).toEqual([{ from: 'online', festivals: ['nightfall-27', 'solstice-26', 'horizon-27'] }]);
    expect(r.saved).toBe(good);
  });

  it('shows the saved copy first, and works offline', async () => {
    const r = await run({ fetched: new Error('offline'), saved: good });
    expect(r.got.map((g) => g.from)).toEqual(['saved']);
    expect(r.saved).toBe(good);
  });

  it('does nothing twice when the file hasn’t changed', async () => {
    const r = await run({ fetched: good, saved: good });
    expect(r.got.map((g) => g.from)).toEqual(['saved']);
  });

  it('never lets a broken file replace good data', async () => {
    const r = await run({ fetched: '{ broken', saved: good });
    expect(r.got.map((g) => g.from)).toEqual(['saved']);
    expect(r.saved).toBe(good);
    expect(r.problems.some((p) => /valid JSON/.test(p))).toBe(true);
  });

  it('refuses insecure links and oversized files', async () => {
    const insecure = await run({ fetched: good, url: 'http://example.com/afterglow.json' });
    expect(insecure.got).toEqual([]);
    expect(insecure.saved).toBeNull();
    const huge = await run({ fetched: ' '.repeat(2_000_001) });
    expect(huge.got).toEqual([]);
  });
});

describe('updates written in part (asPatch)', () => {
  const f = MOCK_SNAPSHOT.festivals[0];
  const ordinary = { version: 1, artists: [], clips: [], festivals: [{ id: f.id, name: f.name, dates: f.dates, lineup: f.lineup, days: f.days, stages: f.stages }] };

  it('marks nothing for an ordinary file of whole festivals', () => {
    expect(parseCatalogFile(ordinary).festivalParts).toBeUndefined();
  });

  it('changes only the parts an update writes; a missing part keeps the catalogue’s own', () => {
    const withLinks = { ...MOCK_SNAPSHOT, festivals: MOCK_SNAPSHOT.festivals.map((x) => (x.id === f.id ? { ...f, links: { tickets: 'https://t.example/' } } : x)) };
    const parsed = parseCatalogFile({ version: 1, artists: [], clips: [], festivals: [{ id: f.id, name: 'Ignored', dates: 'Ignored', days: ['Monday'] }] });
    expect(parsed.festivalParts?.[f.id]).toEqual({ given: ['days'] });
    const out = asPatch(parsed, withLinks).snapshot!.festivals[0];
    expect(out.days).toEqual(['Monday']);
    expect(out.lineup).toEqual(f.lineup);
    expect(out.sets).toEqual(f.sets);
    expect(out.stages).toEqual(f.stages);
    expect(out.name).toBe(f.name);
    expect(out.links).toEqual({ tickets: 'https://t.example/' });
  });

  it('joins additions on: new acts, days, stages, and a set replacing that act’s set that day', () => {
    const set = f.sets?.[0];
    const add = {
      lineup: [{ artist: 'someone-new', days: ['Friday'] }],
      days: [f.days[0], 'Monday'],
      stages: [{ id: 'new-tent', name: 'New Tent' }],
      sets: [...(set ? [{ artist: set.artistId, day: set.day, stage: 'new-tent', start: '01:00', end: '02:00' }] : [])],
    };
    const parsed = parseCatalogFile({ version: 1, artists: [{ id: 'someone-new', name: 'Someone New' }], clips: [], festivals: [{ id: f.id, name: f.name, dates: f.dates, add }] });
    expect(parsed.problems).toEqual([]);
    const out = asPatch(parsed, MOCK_SNAPSHOT).snapshot!.festivals[0];
    expect(out.lineup).toEqual([...f.lineup, 'someone-new']);
    expect(out.artistDays?.['someone-new']).toEqual(['Friday']);
    expect(out.days).toEqual([...f.days, 'Monday']);
    expect(out.stages.map((x) => x.id)).toEqual([...f.stages.map((x) => x.id), 'new-tent']);
    if (set) {
      expect(out.sets?.length).toBe(f.sets!.length);
      expect(out.sets?.[0]).toEqual({ ...set, stageId: 'new-tent', start: '01:00', end: '02:00' });
    }
  });

  it('keeps reading older, whole updates as before', () => {
    const whole = parseCatalogFile({ version: 1, artists: [], clips: [], festivals: [{ id: f.id, name: f.name, dates: f.dates, lineup: [f.lineup[0]], days: f.days, stages: f.stages.map((x) => ({ id: x.id, name: x.name })) }] });
    const out = asPatch(whole, MOCK_SNAPSHOT).snapshot!.festivals[0];
    expect(out.lineup).toEqual([f.lineup[0]]);
    expect(out.sets).toEqual(f.sets);
  });
});
