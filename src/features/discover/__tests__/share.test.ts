import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { clipShareText } from '../share';

const festival = { id: 'f', name: 'Solstice 2026', dates: 'Jun 19 to 21' } as Festival;
const link = 'https://www.youtube.com/watch?v=abc&t=1500s';

describe('sharing a clip', () => {
  it('says who, links to the moment, and where to see them live', () => {
    expect(clipShareText('ILLENIUM', 'Live at Lost Lands 2025', link, festival, 'Afterglow')).toBe(
      'ILLENIUM, Live at Lost Lands 2025\n\n' + link + '\n\nPlaying Solstice 2026, Jun 19 to 21\nFound on Afterglow',
    );
  });

  it('leaves out the festival when there is none', () => {
    expect(clipShareText('LEVITY', 'Live', link, undefined, 'Afterglow')).toBe(
      'LEVITY, Live\n\n' + link + '\n\nFound on Afterglow',
    );
  });
});
