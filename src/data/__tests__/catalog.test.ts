import { describe, expect, it } from '@jest/globals';
import { applyLineup, createCatalog } from '../catalog';
import { MOCK_CATALOG, MOCK_SNAPSHOT, mockSource } from '../mock';
import { SOUND_LABEL, SOUND_TAGS, type CatalogSnapshot, type Clip, type Festival } from '../models';
import { validateSnapshot, validSource } from '../validate';
import { similarityWith, soundSimilarity } from '../../features/taste/similarity';

const horizon = MOCK_SNAPSHOT.festivals.find((f) => f.id === 'horizon-27')!;

describe('mock catalogue', () => {
  it('passes validation with nothing dropped', () => {
    const { snapshot, problems } = validateSnapshot(MOCK_SNAPSHOT);
    expect(problems).toEqual([]);
    expect(snapshot).toEqual(MOCK_SNAPSHOT);
  });

  it('loads through its source like any other catalogue', async () => {
    const loaded = await mockSource.load();
    expect(createCatalog(validateSnapshot(loaded).snapshot).clips.map((c) => c.id)).toEqual(MOCK_CATALOG.clips.map((c) => c.id));
  });

  it('keeps every sound tag labelled', () => {
    expect([...SOUND_TAGS].sort()).toEqual(Object.keys(SOUND_LABEL).sort());
  });
});

describe('catalogue lookups', () => {
  const c = MOCK_CATALOG;

  it('finds records by id', () => {
    expect(c.artist('illenium')?.name).toBe('ILLENIUM');
    expect(c.festival('horizon-27')?.name).toBe('Horizon 2027');
    expect(c.clip('c9')?.artistId).toBe('levity');
    expect(c.artist('nobody')).toBeUndefined();
  });

  it('links artists to their clips and festivals, in catalogue order', () => {
    expect(c.clipsOf('illenium').map((x) => x.id)).toEqual(['c1', 'c8']);
    expect(c.festivalsOf('john-summit').map((f) => f.id)).toEqual(['solstice-26', 'horizon-27']);
    expect(c.festivalsOf('nobody')).toEqual([]);
  });

  it('describes each festival’s lineup and phase', () => {
    expect(c.phaseOf('solstice-26')).toBe('timetable');
    expect(c.phaseOf('horizon-27')).toBe('lineup');
    expect(c.lineupOf('horizon-27')).toEqual({ festivalId: 'horizon-27', artistIds: horizon.lineup });
    expect(c.lineupOf('solstice-26')?.sets?.length).toBe(7);
  });
});

describe('lineups published separately', () => {
  it('replaces a festival’s lineup, and moves it to a timetable when set times arrive', () => {
    const snapshot: CatalogSnapshot = {
      ...MOCK_SNAPSHOT,
      lineups: [
        {
          festivalId: 'horizon-27',
          artistIds: ['levity', 'subtronics'],
          stages: [{ id: 'main', name: 'Main Stage' }],
          sets: [{ artistId: 'levity', day: 'Friday', stageId: 'main', start: '22:00', end: '23:00' }],
        },
      ],
    };
    const catalog = createCatalog(validateSnapshot(snapshot).snapshot);
    expect(catalog.festival('horizon-27')?.lineup).toEqual(['levity', 'subtronics']);
    expect(catalog.phaseOf('horizon-27')).toBe('timetable');
    expect(catalog.festivalsOf('john-summit').map((f) => f.id)).toEqual(['solstice-26']);
    // The original record is untouched.
    expect(horizon.lineup).toContain('john-summit');
  });

  it('leaves a festival as it is when no lineup is published for it', () => {
    expect(applyLineup(horizon, undefined)).toBe(horizon);
  });
});

describe('validation', () => {
  const bad: CatalogSnapshot = {
    artists: [
      ...MOCK_SNAPSHOT.artists,
      { id: 'illenium', name: 'Duplicate', sound: {} },
      { id: 'odd', name: 'Odd', sound: { techno: 3, jazz: 0.5 } as never },
    ],
    festivals: [
      ...MOCK_SNAPSHOT.festivals.filter((f) => f.id !== 'horizon-27'),
      {
        ...horizon,
        lineup: [...horizon.lineup, 'ghost', 'levity'],
        stages: [{ id: 'main', name: 'Main' }],
        sets: [
          { artistId: 'levity', day: 'Friday', stageId: 'main', start: '22:00', end: '23:00' },
          { artistId: 'illenium', day: 'Friday', stageId: 'main', start: '22:00', end: '23:00' }, // not on this lineup
          { artistId: 'tape-b', day: 'Monday', stageId: 'main', start: '22:00', end: '23:00' }, // no such day
          { artistId: 'subtronics', day: 'Friday', stageId: 'main', start: '25:00', end: '23:00' }, // not a time
        ],
      } satisfies Festival,
    ],
    clips: [
      ...MOCK_SNAPSHOT.clips,
      { id: 'x1', artistId: 'ghost', festivalId: 'solstice-26', title: '', durationSec: 30, bpm: 128 },
      {
        id: 'x2',
        artistId: 'levity',
        festivalId: 'solstice-26',
        title: '',
        durationSec: 30,
        bpm: 128,
        source: { provider: 'youtube', videoId: 'not-a-real-id', start: 10, end: 40, channel: 'Lost Lands' },
      } satisfies Clip,
    ],
    similarities: [
      { artistId: 'illenium', otherId: 'levity', score: 0.8 },
      { artistId: 'illenium', otherId: 'ghost', score: 0.5 },
      { artistId: 'illenium', otherId: 'illenium', score: 1 },
      { artistId: 'illenium', otherId: 'tape-b', score: 7 },
    ],
  };
  const { snapshot, problems } = validateSnapshot(bad);

  it('drops what points at nothing, and says so', () => {
    expect(problems.length).toBeGreaterThan(0);
    expect(snapshot.artists.filter((a) => a.id === 'illenium')).toHaveLength(1);
    const h = snapshot.festivals.find((f) => f.id === 'horizon-27')!;
    expect(h.lineup).toEqual(horizon.lineup); // ghost and the repeated levity dropped
    expect(h.sets?.map((s) => s.artistId)).toEqual(['levity']);
    expect(snapshot.clips.find((c) => c.id === 'x1')).toBeUndefined();
    expect(snapshot.similarities).toEqual([{ artistId: 'illenium', otherId: 'levity', score: 0.8 }]);
  });

  it('keeps a clip with a broken video link, as a stage clip', () => {
    const x2 = snapshot.clips.find((c) => c.id === 'x2')!;
    expect(x2).toBeDefined();
    expect(x2.source).toBeUndefined();
    // The input isn't changed.
    expect(bad.clips.find((c) => c.id === 'x2')!.source).toBeDefined();
  });

  it('keeps only known sound tags within range', () => {
    expect(snapshot.artists.find((a) => a.id === 'odd')!.sound).toEqual({});
  });

  it('checks footage links', () => {
    for (const c of MOCK_SNAPSHOT.clips) expect(validSource(c.source)).toBe(true);
    expect(validSource({ provider: 'youtube', videoId: 'JssDaUK0_GQ', start: 50, end: 40, channel: 'x' })).toBe(false);
    expect(validSource({ provider: 'vimeo', videoId: 'JssDaUK0_GQ', start: 0, end: 40, channel: 'x' } as never)).toBe(false);
  });
});

describe('artist similarity', () => {
  const [illenium, , levity, tapeB] = MOCK_SNAPSHOT.artists;

  it('is sound similarity when a catalogue provides nothing', () => {
    expect(similarityWith()).toBe(soundSimilarity);
    expect(similarityWith([])).toBe(soundSimilarity);
  });

  it('prefers provided scores, in both directions, and falls back for other pairs', () => {
    const sim = similarityWith([{ artistId: 'illenium', otherId: 'levity', score: 0.9 }]);
    expect(sim(illenium, levity)).toBe(0.9);
    expect(sim(levity, illenium)).toBe(0.9);
    expect(sim(illenium, tapeB)).toBeCloseTo(soundSimilarity(illenium, tapeB));
  });

  it('keeps provided scores between 0 and 1', () => {
    const sim = similarityWith([{ artistId: 'illenium', otherId: 'levity', score: 4 }]);
    expect(sim(illenium, levity)).toBe(1);
  });
});
