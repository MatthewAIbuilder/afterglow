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
});
