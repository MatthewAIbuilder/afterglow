import { describe, expect, it } from '@jest/globals';
import { BUILT_IN } from '../../bundled';
import { parseCatalogFile } from '../../file';
import { buildCatalog } from '../../merge';
import {
  CLIP_BUDGET_SHARE,
  FIRST_CLIP_SHARE,
  MAX_CLIPS_PER_ARTIST,
  RETRY_MISSES_DAYS,
  RETRY_MORE_DAYS,
  SEARCH_RESULTS,
  cleanAsked,
  clipBudget,
  clipPlan,
  clipTitle,
  isoSeconds,
  pickLiveSet,
  pickLiveSets,
  sameSet,
  searchIds,
  searchUrl,
  setClip,
  setWords,
  shapesUrl,
  uprightOf,
  videoShapes,
} from '../youtube';

// A videos.list answer shaped like YouTube's.
const video = (id: string, title: string, channel: string, duration: string, over: Record<string, unknown> = {}) => ({
  id,
  snippet: { title, channelTitle: channel, liveBroadcastContent: 'none' },
  contentDetails: { duration },
  status: { embeddable: true, privacyStatus: 'public' },
  ...over,
});
const ids = ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd', 'eeeeeeeeeee', 'fffffffffff', 'ggggggggggg'];

describe('YouTube live sets', () => {
  it('reads search answers and durations', () => {
    expect(searchIds({ items: [{ id: { videoId: ids[0] } }, { id: { channelId: 'x' } }, { id: { videoId: 'short' } }] })).toEqual([ids[0]]);
    expect(searchIds({ error: { code: 403 } })).toEqual([]);
    expect(isoSeconds('PT1H2M3S')).toBe(3723);
    expect(isoSeconds('PT45M')).toBe(2700);
    expect(isoSeconds('P0D')).toBe(0);
    expect(isoSeconds('nope')).toBeUndefined();
    expect(searchUrl('RÜFÜS DU SOL', 'k')).toContain('q=R%C3%9CF%C3%9CS%20DU%20SOL%20live%20set');
  });

  it('keeps a real set that names the artist, preferring their own and festival channels', () => {
    const details = {
      items: [
        video(ids[0], 'SUBTRONICS reacts to his own set', 'Some Channel', 'PT20M'), // a reaction
        video(ids[1], 'Subtronics live at Lost Lands 2025 (Full Set)', 'Random Uploads', 'PT1H10M'),
        video(ids[2], 'Subtronics - Lost Lands 2025', 'Excision', 'PT1H5M'), // no set words
        video(ids[3], 'Subtronics LIVE @ Lost Lands 2025', 'Lost Lands', 'PT1H'), // festival channel
        video(ids[4], 'Subtronics live set', 'Fan', 'PT3M'), // too short
        video(ids[5], 'Subtronics live set', 'Fan', 'PT1H', { status: { embeddable: false, privacyStatus: 'public' } }),
        video(ids[6], 'Excision live set', 'Excision', 'PT1H'), // not the artist
      ],
    };
    const set = pickLiveSet('SUBTRONICS', details);
    expect(set).toMatchObject({ videoId: ids[3], channel: 'Lost Lands', seconds: 3600 });
    // Without the festival channel, the best of the rest (any channel).
    expect(pickLiveSet('SUBTRONICS', { items: [details.items[0], details.items[1], details.items[4]] })?.videoId).toBe(ids[1]);
    expect(pickLiveSet('SUBTRONICS', { items: [details.items[0], details.items[4], details.items[6]] })).toBeUndefined();
    expect(pickLiveSet('X', details)).toBeUndefined();
    // A video reported as wrong is never picked: the next best is.
    expect(pickLiveSet('SUBTRONICS', details, new Set([ids[3]]))?.videoId).toBe(ids[1]);
  });

  it('makes a one-minute clip a third of the way in, titled without the artist name', () => {
    expect(clipTitle('SUBTRONICS', 'Subtronics LIVE @ Lost Lands 2025')).toBe('LIVE @ Lost Lands 2025');
    expect(clipTitle('SUBTRONICS', 'SUBTRONICS - Live at EDC Las Vegas 2025 | Full Set')).toBe('Live at EDC Las Vegas 2025 Full Set');
    expect(clipTitle('SUBTRONICS', 'Subtronics')).toBe('Live set');
    expect(clipTitle('SUBTRONICS', 'Subtronics live at Lost Lands')).toBe('Live at Lost Lands');
    const clip = setClip({ videoId: ids[3], title: 'Subtronics LIVE @ Lost Lands 2025', channel: 'Lost Lands', seconds: 3600, score: 3 }, { id: 'subtronics', name: 'SUBTRONICS' }, 'cyclops-cove-4');
    expect(clip).toEqual({
      id: `yt-${ids[3]}`,
      artist: 'subtronics',
      festival: 'cyclops-cove-4',
      title: 'LIVE @ Lost Lands 2025',
      video: { link: `https://www.youtube.com/watch?v=${ids[3]}`, from: '20:00', to: '21:00', channel: 'Lost Lands' },
    });
    // The app reads it with no problems and it plays in Discover.
    const built = buildCatalog(BUILT_IN.snapshot, parseCatalogFile({ version: 1, artists: [], festivals: [], clips: [clip] }));
    expect(built.problems).toEqual([]);
    expect(built.catalog.clipsOf('subtronics').map((c) => c.id)).toContain(`yt-${ids[3]}`);
  });

  it('learns which videos were filmed upright, and gives those the tall player in Discover', () => {
    const upright = { player: { embedWidth: '405', embedHeight: '720' } };
    const wide = { player: { embedWidth: '1280', embedHeight: '720' } };
    expect(uprightOf(upright)).toBe(true);
    expect(uprightOf(wide)).toBe(false);
    // Square-ish, or no size given: not upright, or unknown.
    expect(uprightOf({ player: { embedWidth: '700', embedHeight: '720' } })).toBe(false);
    expect(uprightOf({ player: {} })).toBeUndefined();
    expect(videoShapes({ items: [{ id: ids[0], ...upright }, { id: ids[1], ...wide }, { id: ids[2] }] })).toEqual({ [ids[0]]: true, [ids[1]]: false });
    expect(shapesUrl([ids[0]], 'k')).toContain('part=player&maxHeight=720');

    const set = pickLiveSet('MACY TODD', { items: [video(ids[4], 'MACY TODD Live Full Set NYC', 'Jeremy Dann', 'PT45M', upright)] });
    expect(set?.upright).toBe(true);
    const clip = setClip(set!, { id: 'macy-todd', name: 'MACY TODD' }, 'acl-26');
    expect(clip.video).toMatchObject({ vertical: true });
    const built = buildCatalog(BUILT_IN.snapshot, parseCatalogFile({ version: 1, clips: [{ ...clip, artist: 'subtronics', festival: 'cyclops-cove-4' }] }));
    expect(built.problems).toEqual([]);
    const source = built.catalog.clipsOf('subtronics').find((c) => c.id === clip.id)?.source;
    expect(source && 'vertical' in source && source.vertical).toBe(true);
  });

  it('plans tonight: artists without a clip, skipping recent misses, up to the budget', () => {
    const wanted = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'a', name: 'A' },
      { id: 'c', name: 'C' },
      { id: 'd', name: 'D' },
      { id: 'e', name: 'E' },
    ];
    const plan = clipPlan(wanted, (id) => (id === 'b' ? 1 : 0), { c: '2026-09-20', d: '2026-08-01' }, '2026-09-30', 2);
    expect(plan.map((a) => a.id)).toEqual(['a', 'd']);
  });
});

describe('More sets per artist', () => {
  const vid = (n: number) => `v${String(n).padStart(10, '0')}`;

  it('asks for more results per search, and changes the words once an artist has clips', () => {
    expect(searchUrl('SUBTRONICS', 'k')).toContain(`maxResults=${SEARCH_RESULTS}`);
    expect(SEARCH_RESULTS).toBeLessThanOrEqual(50); // YouTube's most per answer, for the same 100 units
    expect(searchUrl('SUBTRONICS', 'k', 0)).toContain('q=SUBTRONICS%20live%20set');
    expect(searchUrl('SUBTRONICS', 'k', 1)).toContain('q=SUBTRONICS%20full%20set');
    expect(searchUrl('SUBTRONICS', 'k', 2)).toContain('q=SUBTRONICS%20festival%20set');
    expect(searchUrl('SUBTRONICS', 'k', 3)).toContain('q=SUBTRONICS%20live%20set');
  });

  it('tells sets apart by their titles', () => {
    expect(setWords('SUBTRONICS', 'Subtronics LIVE @ Lost Lands 2025 (Full Set)')).toEqual(['lost', 'lands', '2025']);
    expect(setWords('RÜFÜS DU SOL', 'RÜFÜS DU SOL - Live from Joshua Tree')).toEqual(['joshua', 'tree']);
    const w = (t: string) => setWords('SUBTRONICS', t);
    expect(sameSet(w('Live at Lost Lands 2025'), w('Subtronics Full Set | Lost Lands 2025'))).toBe(true);
    expect(sameSet(w('Live at EDC Orlando 2025'), w('EDC Orlando 2025 Kinetic Field'))).toBe(true); // one says all the other does
    expect(sameSet(w('Live at EDC Orlando 2025'), w('Live at EDC Las Vegas 2025'))).toBe(false);
    expect(sameSet(w('Live at Lost Lands 2025'), w('Live at Lost Lands 2024'))).toBe(false);
    expect(sameSet(w('Live set'), w('Full set'))).toBe(true); // nothing to tell them apart
    expect(sameSet(w('Live set'), w('Live at Red Rocks'))).toBe(false);
  });

  it('takes up to two different sets from one search, never one the artist already has', () => {
    const details = {
      items: [
        video(vid(1), 'Subtronics LIVE @ Lost Lands 2025', 'Lost Lands', 'PT1H'),
        video(vid(2), 'Subtronics Full Set | Lost Lands 2025', 'Fan uploads', 'PT1H'), // the same set again
        video(vid(3), 'Subtronics live at EDC Las Vegas 2024', 'Insomniac', 'PT1H'),
        video(vid(4), 'Subtronics live at Red Rocks 2025', 'Random', 'PT50M'),
        video(vid(5), 'Subtronics reaction video live', 'Random', 'PT50M'), // not a set
        video(vid(6), 'Subtronics live set', 'Fan', 'PT4M'), // too short
      ],
    };
    expect(pickLiveSets('SUBTRONICS', details).map((s) => s.videoId)).toEqual([vid(1), vid(3)]);
    expect(pickLiveSets('SUBTRONICS', details, { max: 3 }).map((s) => s.videoId)).toEqual([vid(1), vid(3), vid(4)]);
    // Lost Lands 2025 is already a clip: the next ones (a year not yet had a step ahead).
    expect(pickLiveSets('SUBTRONICS', details, { taken: ['Live at Lost Lands 2025'] }).map((s) => s.videoId)).toEqual([vid(3), vid(4)]);
    // Used or reported videos are never picked.
    expect(pickLiveSets('SUBTRONICS', details, { blocked: new Set([vid(1), vid(3)]) }).map((s) => s.videoId)).toEqual([vid(2), vid(4)]);
    // Nothing new: nothing.
    expect(pickLiveSets('SUBTRONICS', details, { taken: ['Lost Lands 2025', 'EDC Las Vegas 2024', 'Red Rocks 2025'] })).toEqual([]);
    expect(pickLiveSet('SUBTRONICS', details)?.videoId).toBe(vid(1));
  });

  it('plans first clips first, then more sets for those with the fewest, waiting after a search with nothing new', () => {
    const A = (id: string) => ({ id, name: id.toUpperCase() });
    const counts: Record<string, number> = { b: 3, c: 1, d: 2, e: 4, f: 1, g: 1, x: 1 };
    const wanted = [A('a'), A('b'), A('c'), A('d'), A('e'), A('f'), A('g'), A('h'), A('a')];
    const plan = clipPlan(wanted, (id) => counts[id] ?? 0, { h: '2026-09-20' }, '2026-10-06', 10, {
      moreAsked: { g: '2026-10-01', f: '2026-09-01' },
      later: [A('x'), A('c')],
    });
    // a has no clip; h found nothing 16 days ago and waits. Then fewest first: c, f (asked 35 days ago), d, b;
    // g was asked 5 days ago and waits; e is at the cap; x isn't on an upcoming lineup, so it comes after them all.
    expect(plan).toEqual([
      { id: 'a', name: 'A', have: 0 },
      { id: 'c', name: 'C', have: 1 },
      { id: 'f', name: 'F', have: 1 },
      { id: 'd', name: 'D', have: 2 },
      { id: 'b', name: 'B', have: 3 },
      { id: 'x', name: 'X', have: 1 },
    ]);
    expect(clipPlan(wanted, (id) => counts[id] ?? 0, {}, '2026-10-06', 3).map((a) => a.id)).toEqual(['a', 'h', 'c']);
    expect(clipPlan(wanted, (id) => counts[id] ?? 0, {}, '2026-10-06', 0)).toEqual([]);
    // After RETRY_MORE_DAYS, g is asked again.
    expect(clipPlan([A('g')], () => 1, {}, '2026-10-22', 5, { moreAsked: { g: '2026-10-01' } }).map((a) => a.id)).toEqual(['g']);
    expect(clipPlan([A('g')], () => 1, {}, '2026-10-21', 5, { moreAsked: { g: '2026-10-01' } })).toEqual([]);
    expect(RETRY_MORE_DAYS).toBeLessThan(RETRY_MISSES_DAYS);
    expect(MAX_CLIPS_PER_ARTIST).toBe(4);
  });

  it('remembers only well-formed, recent days', () => {
    const raw = { a: '2026-10-01', b: '2026-08-01', c: 'soon', d: 7, e: '2026-12-01' };
    expect(cleanAsked(raw, '2026-10-06', 30)).toEqual({ a: '2026-10-01' });
    expect(cleanAsked(raw, '2026-10-06', 3)).toEqual({});
    expect(cleanAsked(['2026-10-01'], '2026-10-06', 30)).toEqual({});
    expect(cleanAsked(undefined, '2026-10-06', 30)).toEqual({});
  });

  it('keeps the file within its budget', () => {
    const set = { videoId: vid(1), title: 'Subtronics live at Lost Lands 2025', channel: 'Lost Lands', seconds: 3600, score: 3 };
    const clip = setClip(set, { id: 'subtronics', name: 'SUBTRONICS' }, 'cyclops-cove-4');
    const cost = JSON.stringify(clip).length + 1;
    expect(cost).toBeLessThan(400);
    const budget = clipBudget(850_000 - 2 * cost, 1_000_000);
    expect(budget.fits(clip, CLIP_BUDGET_SHARE)).toBe(true);
    budget.add(clip);
    expect(budget.fits(clip, CLIP_BUDGET_SHARE)).toBe(true);
    budget.add(clip);
    expect(budget.chars).toBe(850_000);
    // Extra sets stop at 85%; a first clip may still go in, up to 95%.
    expect(budget.fits(clip, CLIP_BUDGET_SHARE)).toBe(false);
    expect(budget.fits(clip, FIRST_CLIP_SHARE)).toBe(true);
    expect(clipBudget(950_000, 1_000_000).fits(clip, FIRST_CLIP_SHARE)).toBe(false);
  });

  it('several clips of one artist make a file the app reads', () => {
    const clips = [1, 2, 3, 4].map((n) =>
      setClip(
        { videoId: vid(n), title: `Subtronics live at Lost Lands 202${n}`, channel: 'Lost Lands', seconds: 3600, score: 3 },
        { id: 'subtronics', name: 'SUBTRONICS' },
        'cyclops-cove-4',
      ),
    );
    const built = buildCatalog(BUILT_IN.snapshot, parseCatalogFile({ version: 1, clips, clipMisses: {}, clipMoreAsked: { x: '2026-10-01' } }));
    expect(built.problems).toEqual([]);
    expect(built.catalog.clipsOf('subtronics').filter((c) => c.id.startsWith('yt-v'))).toHaveLength(4);
  });
});
