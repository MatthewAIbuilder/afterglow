import { describe, expect, it } from '@jest/globals';
import { BUILT_IN } from '../../bundled';
import { parseCatalogFile } from '../../file';
import { buildCatalog } from '../../merge';
import { clipPlan, clipTitle, isoSeconds, pickLiveSet, searchIds, searchUrl, setClip } from '../youtube';

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

  it('plans tonight: artists without a clip, skipping recent misses, up to the budget', () => {
    const wanted = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'a', name: 'A' },
      { id: 'c', name: 'C' },
      { id: 'd', name: 'D' },
      { id: 'e', name: 'E' },
    ];
    const plan = clipPlan(wanted, (id) => id === 'b', { c: '2026-09-20', d: '2026-08-01' }, '2026-09-30', 2);
    expect(plan.map((a) => a.id)).toEqual(['a', 'd']);
  });
});
