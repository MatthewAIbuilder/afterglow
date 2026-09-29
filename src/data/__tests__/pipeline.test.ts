import { describe, expect, it } from '@jest/globals';
import example from '../../../docs/catalogue-example.json';
import { parseCatalogFile } from '../file';
import { buildCatalog } from '../merge';
import { MOCK_SNAPSHOT, MOCK_TASTE } from '../mock';
import { defaultFocus, festivalLine, lineupClips } from '../../features/festivals/links';
import { buildSchedule, rankLineup } from '../../features/plan/plan';
import { rankFeed } from '../../features/recommend/feed';
import { computeLayout } from '../../features/sound-map/layout';
import { computeTaste } from '../../features/taste/engine';
import { similarityWith } from '../../features/taste/similarity';

/** Data from a catalogue file goes through every part of the app's logic, the same way the demo data does. */
describe('a catalogue file, end to end', () => {
  const { catalog } = buildCatalog(MOCK_SNAPSHOT, parseCatalogFile(example));
  const similarity = similarityWith(catalog.similarities);
  const { taste, informed } = computeTaste(MOCK_TASTE, catalog.artists, catalog.clips, { 'nightfall-illenium-1': { liked: true, saved: false, skipped: false } }, similarity);
  const nightfall = catalog.festival('nightfall-27')!;

  it('learns about a new artist through the provided similarity', () => {
    // No prior for the new artist; liking an ILLENIUM clip reaches them through "similar".
    expect(informed['aurora-drift']).toBe(true);
    expect(taste['aurora-drift']).toBeGreaterThan(0.5);
  });

  it('opens Discover on the new festival and ranks its lineup', () => {
    expect(defaultFocus(catalog.festivals, catalog.clips)?.id).toBe('nightfall-27');
    const feed = rankFeed({ clips: lineupClips(nightfall, catalog.clips), artists: catalog.artists, taste, informed, reactions: {}, seen: {}, now: 0, similarity });
    // Every clip of an artist on the lineup, the file's own and the demo ones, and nobody else.
    expect(feed.map((it) => it.clip.id)).toEqual(expect.arrayContaining(['nightfall-aurora-1', 'nightfall-illenium-1', 'c1', 'c4']));
    for (const it of feed) expect(nightfall.lineup).toContain(it.clip.artistId);
    expect(festivalLine(nightfall, 'aurora-drift')).toBe('Friday 9:00 PM, The Grove');
  });

  it('builds a plan and a schedule for it', () => {
    const picks = rankLineup({ festival: nightfall, artists: catalog.artists, taste, informed });
    expect(picks.map((p) => p.artist.id)).toEqual(expect.arrayContaining(['illenium', 'aurora-drift']));
    const schedule = buildSchedule(nightfall, picks);
    expect(schedule.days.map((d) => d.day)).toEqual(['Friday', 'Saturday']);
  });

  it('places the new artist on My Sound', () => {
    const layout = computeLayout(catalog.artists, taste);
    expect(layout.bubbles.some((b) => b.artist.id === 'aurora-drift')).toBe(true);
    for (const b of layout.bubbles) expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
  });
});
