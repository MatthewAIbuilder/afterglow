import { describe, expect, it } from '@jest/globals';
import { ARTISTS } from '../../../data/artists';
import { CLIPS } from '../../../data/clips';
import { MOCK_TASTE } from '../../../data/tasteProfile';
import { computeTaste } from '../engine';

const clipOf = (artistId: string) => CLIPS.find((c) => c.artistId === artistId)!.id;
const none = { liked: false, saved: false, skipped: false };

describe('taste engine', () => {
  it('starts from the prior when you have not reacted to anything', () => {
    const { taste } = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, {});
    for (const [id, v] of Object.entries(MOCK_TASTE)) expect(taste[id]).toBeCloseTo(v);
  });

  it('raises the match of an artist you like and lowers one you skip', () => {
    const { taste } = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, {
      [clipOf('john-summit')]: { ...none, liked: true },
      [clipOf('sara-landry')]: { ...none, skipped: true },
    });
    expect(taste['john-summit']).toBeGreaterThan(MOCK_TASTE['john-summit']);
    expect(taste['sara-landry']).toBeLessThan(MOCK_TASTE['sara-landry']);
  });

  it('spills a like over to artists with a similar sound, not to unrelated ones', () => {
    const { taste } = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, { [clipOf('excision')]: { ...none, liked: true } });
    expect(taste.levity).toBeGreaterThan(MOCK_TASTE.levity);
    expect(taste['john-summit']).toBeCloseTo(MOCK_TASTE['john-summit']);
  });

  it('marks artists with no prior and no signal as uninformed', () => {
    const { informed } = computeTaste({}, ARTISTS, CLIPS, { [clipOf('excision')]: { ...none, liked: true } });
    expect(informed.excision).toBe(true);
    expect(informed.levity).toBe(true); // via spill-over
    expect(informed['john-summit']).toBe(false);
  });

  it('nudges an artist up when you watch a clip through, less than a like', () => {
    const id = clipOf('john-summit');
    const watched = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, { [id]: { ...none, watched: 'through' } });
    const liked = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, { [id]: { ...none, liked: true } });
    expect(watched.taste['john-summit']).toBeGreaterThan(MOCK_TASTE['john-summit']);
    expect(watched.taste['john-summit']).toBeLessThan(liked.taste['john-summit']);
    expect(watched.summary.watched).toBe(1);
  });

  it('nudges an artist down on a quick swipe, less than a skip', () => {
    const id = clipOf('sara-landry');
    const quick = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, { [id]: { ...none, watched: 'quick' } });
    const skipped = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, { [id]: { ...none, skipped: true } });
    expect(quick.taste['sara-landry']).toBeLessThan(MOCK_TASTE['sara-landry']);
    expect(quick.taste['sara-landry']).toBeGreaterThan(skipped.taste['sara-landry']);
  });

  it('lets what you tap win over how you watched', () => {
    const id = clipOf('sara-landry');
    const likedThenSwiped = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, { [id]: { ...none, liked: true, watched: 'quick' } });
    const liked = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, { [id]: { ...none, liked: true } });
    expect(likedThenSwiped.taste['sara-landry']).toBeCloseTo(liked.taste['sara-landry']);

    const skippedAfterWatching = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, { [id]: { ...none, skipped: true, watched: 'through' } });
    const skipped = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, { [id]: { ...none, skipped: true } });
    expect(skippedAfterWatching.taste['sara-landry']).toBeCloseTo(skipped.taste['sara-landry']);
  });
});
