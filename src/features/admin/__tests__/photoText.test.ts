import { describe, expect, it } from '@jest/globals';
import { inColumns, linesFromWords, type PhotoLine, tidyPhotoText } from '../photoText';
import grid from './fixtures/timetable-grid-words.json';
import { readSetList } from '../setlist';

const at = (text: string, x0: number, y0: number, w = 200): PhotoLine => ({ text, x0, x1: x0 + w, y0, y1: y0 + 20 });

describe('reading a timetable photo', () => {
  it('puts a grid back together column by column, under the headings across the page', () => {
    // Two stages side by side; recognition would read them across.
    const lines = [
      at('FRIDAY', 50, 10, 700),
      at('Cosmic Meadow', 50, 60),
      at('Circuit Grounds', 450, 60),
      at('SUBTRONICS', 50, 100),
      at('LEVITY', 450, 100),
      at('11:00 PM', 50, 125),
      at('10:30 PM', 450, 125),
      at('SATURDAY', 50, 300, 700),
      at('Cosmic Meadow', 50, 340),
      at('ILLENIUM', 50, 380),
      at('9:00 PM', 50, 405),
    ];
    expect(inColumns(lines, 800)).toEqual(['FRIDAY', 'Cosmic Meadow', 'SUBTRONICS', '11:00 PM', 'Circuit Grounds', 'LEVITY', '10:30 PM', 'SATURDAY', 'Cosmic Meadow', 'ILLENIUM', '9:00 PM']);
  });

  it('mends misread times and joins an act with the time on its own line', () => {
    const text = tidyPhotoText(['FRIDAY', 'Cosmic Meadow', 'SUBTRONICS', '1l:OO PM', '|', '10.30 PM', 'LEVITY', '9:00 PM ILLENIUM']);
    expect(text).toBe(['FRIDAY', 'Cosmic Meadow', '11:00 PM SUBTRONICS', '10:30 PM LEVITY', '9:00 PM ILLENIUM'].join('\n'));
    // A stage heading is never taken for an act.
    expect(tidyPhotoText(['Bass Tent', '10:00 PM', 'EXCISION'])).toBe('Bass Tent\n10:00 PM EXCISION');
  });

  it('what comes out reads as set times', () => {
    const lines = inColumns(
      [at('FRIDAY', 0, 0, 700), at('Cosmic Meadow', 0, 50), at('Circuit Grounds', 400, 50), at('SUBTRONICS', 0, 90), at('LEVITY', 400, 90), at('11:0O PM', 0, 115), at('10:30 PM', 400, 115)],
      800,
    );
    const list = readSetList(tidyPhotoText(lines), { stages: ['Cosmic Meadow', 'Circuit Grounds'] });
    expect(list.sets.map((s) => [s.day, s.stage, s.start, s.name])).toEqual([
      ['Friday', 'Cosmic Meadow', '23:00', 'SUBTRONICS'],
      ['Friday', 'Circuit Grounds', '22:30', 'LEVITY'],
    ]);
  });

  it('reads a real recognition of a three-stage grid (what tesseract found in a test picture)', () => {
    const text = tidyPhotoText(inColumns(linesFromWords(grid.lines), grid.width));
    const list = readSetList(text);
    expect(list.unread).toEqual([]);
    expect(list.sets.map((s) => `${s.day} · ${s.stage} · ${s.start}–${s.end} ${s.name}`)).toEqual([
      'Friday · COSMIC MEADOW · 21:00–22:30 ILLENIUM',
      'Friday · COSMIC MEADOW · 22:30–00:00 SUBTRONICS',
      'Friday · CIRCUIT GROUNDS · 20:45–22:00 LEVITY',
      'Friday · CIRCUIT GROUNDS · 22:00–23:30 JOHN SUMMIT',
      'Friday · BASS POD · 23:00–00:30 EXCISION',
    ]);
  });
});
