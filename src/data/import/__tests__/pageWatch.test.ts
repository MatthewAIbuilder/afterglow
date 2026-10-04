import { describe, expect, it } from '@jest/globals';
import { hasSetTimes, namesOn, pageFacts, pageText, watchNotes, watchReport } from '../pageWatch';

const artists = [
  { id: 'subtronics', name: 'Subtronics' },
  { id: 'tiesto', name: 'Tiësto' },
  { id: 'levity', name: 'LEVITY' },
  { id: 'wax', name: 'Wax' },
  { id: 'john-summit', name: 'John Summit' },
];
const page = (body: string, picture = 'https://edc.com/poster.jpg') =>
  `<html><head><meta property="og:image" content="${picture}"><script>var x = "Levity";</script></head><body>${body}</body></html>`;

describe('watching a festival page', () => {
  it('reads only the words people see', () => {
    expect(pageText(page('<h1>EDC&nbsp;Orlando</h1><p>Lineup &amp; more</p>'))).toBe('EDC Orlando Lineup & more');
  });

  it('spots artists Afterglow knows that aren’t on the lineup yet, as whole words', () => {
    const text = pageText(page('<li>SUBTRONICS</li><li>TIESTO</li><li>John Summitt</li><p>wax on</p>'));
    expect(namesOn(text, artists, new Set(['subtronics']))).toEqual(['Tiësto']);
  });

  it('flags set times only when the page says so and lists times', () => {
    expect(hasSetTimes('Set times: 9:00 PM 10:30 PM 11pm 12:00 AM 1:30 AM 2am')).toBe(true);
    expect(hasSetTimes('Gates at 4pm. Schedule coming soon.')).toBe(false);
    expect(hasSetTimes('9:00 PM 10:30 PM 11pm 12:00 AM 1:30 AM 2am')).toBe(false);
  });

  it('says what changed since the last look, and nothing on the first', () => {
    const before = pageFacts(page('<li>Subtronics</li>'), 'https://orlando.edc.com/', artists, new Set());
    expect(watchNotes(undefined, before)).toEqual([]);
    const now = pageFacts(page('<h2>Set times</h2><li>Subtronics 9:00 PM</li><li>Levity 10pm</li><li>John Summit 11pm</li><p>12am 1am 2am</p>', 'https://edc.com/poster-2.jpg'), 'https://orlando.edc.com/', artists, new Set());
    expect(watchNotes(before, now)).toEqual([
      'New names on the page, not on the lineup yet: John Summit, LEVITY.',
      'Set times may be out: the page now mentions set times and lists times.',
      'Its share picture changed (often a new lineup poster): https://edc.com/poster-2.jpg',
    ]);
    // A new address starts over.
    expect(watchNotes(before, { ...now, url: 'https://edc.com/orlando' })).toEqual([]);
  });

  it('writes the heads-up', () => {
    const body = watchReport([{ id: 'edc', name: 'EDC Orlando 2026', url: 'https://orlando.edc.com/', notes: ['Set times may be out.'] }], 'https://afterglowmusic.app/admin');
    expect(body).toContain('### EDC Orlando 2026');
    expect(body).toContain('- Set times may be out.');
    expect(body).toContain('[Afterglow HQ](https://afterglowmusic.app/admin)');
  });
});
