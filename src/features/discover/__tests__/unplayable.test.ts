import { describe, expect, it } from '@jest/globals';
import { forgetUnplayable, isUnplayable, markUnplayable } from '../unplayable';
import { clipMedia } from '../media';
import { MOCK_SNAPSHOT } from '../../../data/mock';

describe('clips with nothing to watch stay out of the feed', () => {
  it('remembers clips whose video failed, until forgotten', () => {
    expect(isUnplayable('c1')).toBe(false);
    markUnplayable('c1');
    expect(isUnplayable('c1')).toBe(true);
    forgetUnplayable();
    expect(isUnplayable('c1')).toBe(false);
  });

  it('a clip with no source has no media, so it is left out', () => {
    const real = MOCK_SNAPSHOT.clips.find((c) => c.source);
    expect(real && clipMedia(real)).toBeTruthy();
    expect(clipMedia({ ...MOCK_SNAPSHOT.clips[0], source: undefined })).toBeUndefined();
  });
});
