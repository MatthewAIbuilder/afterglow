import { describe, expect, it } from '@jest/globals';
import type { Clip, Festival } from '../../../data/models';
import { artistStory, hasStory, nextShow, nextShowLine, storyLines } from '../story';

const fest = (id: string, name: string, over: Partial<Festival> = {}): Festival =>
  ({ id, name, dates: 'x', location: 'Somewhere', lineup: ['sub'], days: ['Friday', 'Saturday'], stages: [{ id: 'main', name: 'Main Stage' }], ...over }) as Festival;
const today = new Date(2026, 9, 3);
const clip = (id: string): Clip => ({ id, artistId: 'sub', festivalId: 'x', title: id, durationSec: 30, bpm: 140 }) as Clip;

describe('the deeper artist page', () => {
  it('their next show is the soonest one that isn’t over', () => {
    const past = fest('past', 'Old Fest', { startDate: '2026-05-01', endDate: '2026-05-02' });
    const later = fest('later', 'Later Fest', { startDate: '2027-03-01', endDate: '2027-03-02' });
    const soon = fest('soon', 'Soon Fest', { startDate: '2026-12-04', endDate: '2026-12-05' });
    expect(nextShow([past, later, soon], 'sub', today)?.id).toBe('soon');
    expect(nextShow([past], 'sub', today)).toBeUndefined();
    expect(nextShowLine(soon, 'sub', today, () => 'Saturday')).toBe('Saturday · In 2 months');
    const withSet = { ...soon, sets: [{ artistId: 'sub', day: 'Saturday', stageId: 'main', start: '23:40', end: '01:00' }] } as Festival;
    expect(nextShowLine(withSet, 'sub', today)).toBe('Saturday 11:40 PM, Main Stage · In 2 months');
  });

  it('you and them: sets watched, liked and kept, your videos, and where you saw them live', () => {
    const cc = fest('cc', 'Cyclops Cove 4', { startDate: '2026-12-04', endDate: '2026-12-06' });
    const story = artistStory({
      artistId: 'sub',
      clips: [clip('a'), clip('b'), clip('c')],
      reactions: { a: { liked: true }, b: { saved: true, liked: true }, z: { liked: true } },
      seen: { a: 1, b: 2, z: 3 },
      memories: [
        { id: 'm1', capturedAt: new Date(2026, 11, 5, 23).toISOString(), artistId: 'sub', festivalId: 'cc' },
        { id: 'm2', capturedAt: '2024-07-20T23:00:00.000Z', artistId: 'sub', past: { name: 'Lost Lands', year: 2024 } },
        { id: 'm3', capturedAt: '2026-01-01T00:00:00.000Z', artistId: 'sub', festivalId: 'cc' },
        { id: 'm4', capturedAt: '2026-01-01T00:00:00.000Z', artistId: 'other' },
      ],
      festivalOf: (id) => (id === 'cc' ? cc : undefined),
    });
    expect(story).toMatchObject({ watched: 2, liked: 2, saved: 1, filmed: 3, seenLive: ['Cyclops Cove 4', 'Lost Lands 2024'], firstFilmed: '2024-07-20T23:00:00.000Z' });
    expect(storyLines(story)).toEqual(['Seen live at Cyclops Cove 4 and Lost Lands 2024', '3 videos of them in your Memories', 'Watched 2 sets · liked 2 · kept 1']);
    const none = artistStory({ artistId: 'sub', clips: [clip('a')], reactions: {}, seen: {}, memories: [], festivalOf: () => undefined });
    expect(hasStory(none)).toBe(false);
    expect(storyLines(none)).toEqual([]);
  });
});
