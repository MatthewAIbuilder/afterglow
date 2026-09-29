import { describe, expect, it } from '@jest/globals';
import { MOCK_CATALOG, MOCK_TASTE } from '../mock';
import { computeLayout } from '../../features/sound-map/layout';
import { computeTaste } from '../../features/taste/engine';
import { rankFeed } from '../../features/recommend/feed';
import { buildSchedule, rankLineup } from '../../features/plan/plan';
import { festivalLine, lineupClips } from '../../features/festivals/links';
import type { Reaction } from '../../state/reactions';

// What the app reads: the mock data, checked and indexed by the data layer.
const { artists: ARTISTS, clips: CLIPS, festivals: FESTIVALS } = MOCK_CATALOG;

/**
 * Golden outputs for the mock data. Recorded before the data layer was
 * restructured (Milestone 10), so any change in what the app computes from the
 * same data shows up here. Run with `npx jest --ci` to make sure nothing was
 * re-recorded by accident.
 */

const none: Reaction = { liked: false, saved: false, skipped: false };
const SCENARIOS: Record<string, Record<string, Reaction>> = {
  fresh: {},
  mixed: {
    c1: { ...none, liked: true },
    c3: { ...none, skipped: true },
    c5: { ...none, saved: true, watched: 'through' },
    c6: { ...none, watched: 'replayed' },
    c7: { ...none, watched: 'quick' },
  },
};
const round = (n: number) => Math.round(n * 1e6) / 1e6;
const roundAll = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, round(v)]));

describe('golden outputs from the mock data', () => {
  for (const [name, reactions] of Object.entries(SCENARIOS)) {
    it(`computes the same taste, feed, plans and map (${name})`, () => {
      const { taste, informed, summary } = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, reactions);
      const now = 1_800_000_000_000;
      const out = {
        taste: roundAll(taste),
        informed,
        summary,
        feed: FESTIVALS.map((f) =>
          rankFeed({ clips: lineupClips(f, CLIPS), artists: ARTISTS, taste, informed, reactions, seen: { c2: now - 1000 }, now }).map(
            (it) => `${it.clip.id}:${it.lane}:${it.reason.kind}`,
          ),
        ),
        plans: FESTIVALS.map((f) => {
          const picks = rankLineup({ festival: f, artists: ARTISTS, taste, informed, pinned: new Set(['levity']) });
          const schedule = f.sets?.length ? buildSchedule(f, picks) : null;
          return {
            picks: picks.map((p) => `${p.artist.id}:${p.tier}:${p.pinned}`),
            schedule: schedule?.days.map((d) => ({
              day: d.day,
              clashes: d.clashes,
              items: d.items.map((i) => JSON.stringify(i, (k, v) => (k === 'artist' ? v.id : typeof v === 'number' ? round(v) : v))),
            })),
          };
        }),
        lines: FESTIVALS.map((f) => ARTISTS.map((a) => festivalLine(f, a.id) ?? '-')),
        map: (() => {
          const layout = computeLayout(ARTISTS, taste);
          return JSON.parse(JSON.stringify(layout, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)));
        })(),
      };
      expect(out).toMatchSnapshot();
    });
  }

  it('keeps the mock catalogue itself unchanged', () => {
    expect({ artists: ARTISTS, clips: CLIPS, festivals: FESTIVALS, prior: MOCK_TASTE }).toMatchSnapshot();
  });
});
