import { describe, expect, it } from '@jest/globals';
import { applyLineup } from '../../../data/catalog';
import { parseCatalogFile } from '../../../data/file';
import type { Artist, Festival } from '../../../data/models';
import { decide, lineupToFile, MIN_SETS, pageLines, readPageSetTimes, setTimesReport } from '../pageSetTimes';

const artists: Artist[] = ['SUBTRONICS', 'LEVITY', 'EXCISION', 'John Summit', 'TAPE B', 'Sara Landry', 'Wax', 'ILLENIUM', 'Tiësto', 'SUBTRONICS B2B CRANKDAT'].map((name) => ({
  id: name.toLowerCase().replace(/ë/g, 'e').replace(/[^a-z0-9]+/g, '-'),
  name,
  sound: {},
}));
const festival: Festival = {
  id: 'nightfall-27',
  name: 'Nightfall 2027',
  dates: 'Aug 6 to 7',
  location: 'Riverside Park',
  lineup: ['subtronics', 'levity', 'excision', 'john-summit', 'tape-b', 'sara-landry', 'wax', 'illenium'],
  days: ['Friday', 'Saturday'],
  stages: [
    { id: 'main', name: 'Main Stage' },
    { id: 'bass', name: 'Bass Tent' },
  ],
  startDate: '2027-08-06',
  endDate: '2027-08-07',
};
const row = (time: string, who: string, stage: string) => `<tr><td>${time}</td><td>${who}</td><td>${stage}</td></tr>`;
const page = (body: string) => `<html><head><title>x</title><script>var sets = "9:00 PM Nobody";</script></head><body><h1>Set times</h1>${body}</body></html>`;
const good = page(
  `<h2>Friday</h2><table>${row('6:00 PM - 7:00 PM', 'WAX', 'Main Stage')}${row('7:00 PM - 8:30 PM', 'John Summit', 'Main Stage')}${row('8:30 PM - 10:00 PM', 'ILLENIUM', 'Main Stage')}${row('6:30 PM - 7:30 PM', 'TAPE B', 'Bass Tent')}${row('7:30 PM - 9:00 PM', 'LEVITY', 'Bass Tent')}</table>` +
    `<h2>Saturday, August 7</h2><table>${row('7:00 PM - 8:30 PM', 'Sara Landry', 'Main Stage')}${row('8:30 PM - 10:00 PM', 'EXCISION', 'Main Stage')}${row('8:00 PM - 9:30 PM', 'Subtronics B2B Crankdat', 'Bass Tent')}${row('9:30 PM - 11:00 PM', 'SUBTRONICS', 'Bass Tent')}</table>`,
);

describe('set times from an official page', () => {
  it('reads the page one block per line, with table cells joined, and nothing from scripts', () => {
    const lines = pageLines(page(`<p>Gates &amp; info</p><ul><li>SUBTRONICS</li><li>LEVITY</li></ul><table>${row('10:00 PM', 'WAX', 'Bass Tent')}</table>`)).split('\n');
    expect(lines).toEqual(['Set times', 'Gates & info', 'SUBTRONICS', 'LEVITY', '10:00 PM | WAX | Bass Tent']);
  });

  it('turns a timetable into set times for the festival, matched to artists on Afterglow, and publishes when it is clearly right', () => {
    const r = readPageSetTimes(good, festival, artists)!;
    expect(r.read).toBe(9);
    expect(r.kept).toBe(9);
    expect(r.unknown).toEqual([]);
    expect(r.coverage).toBe(1);
    expect(r.lineup.source).toBe('page');
    expect(r.lineup.days).toEqual(['Friday', 'Saturday']);
    expect(r.lineup.stages).toEqual(festival.stages);
    expect(r.lineup.sets).toContainEqual({ artistId: 'illenium', day: 'Friday', stageId: 'main', start: '20:30', end: '22:00' });
    expect(r.lineup.sets).toContainEqual({ artistId: 'subtronics-b2b-crankdat', day: 'Saturday', stageId: 'bass', start: '20:00', end: '21:30' });
    // The b2b act joins the lineup; nobody is invented.
    expect(r.lineup.artistIds).toEqual([...festival.lineup, 'subtronics-b2b-crankdat']);
    const d = decide(r);
    expect(d.publish).toBe(true);
    if (d.publish) expect(d.line).toBe('9 set times over 2 days and 2 stages, 100% of the lineup.');
  });

  it('says nothing for a page without set times', () => {
    expect(readPageSetTimes(page('<p>Lineup coming soon</p><ul><li>SUBTRONICS</li></ul>'), festival, artists)).toBeUndefined();
  });

  it('holds back a reading that is not clearly right, saying why', () => {
    // Too few.
    const few = readPageSetTimes(page(`<h2>Friday</h2><table>${row('6:00 PM - 7:00 PM', 'WAX', 'Main Stage')}${row('7:00 PM - 8:00 PM', 'LEVITY', 'Main Stage')}</table>`), festival, artists)!;
    const d1 = decide(few);
    expect(d1.publish).toBe(false);
    if (!d1.publish) expect(d1.reasons).toEqual(expect.arrayContaining([`Only 2 set times could be read (at least ${MIN_SETS} are needed).`, expect.stringMatching(/^Only 25% of the lineup/)]));
    // Mostly names Afterglow doesn't know: probably another festival's page, or acts to add first.
    const strangers = page(`<h2>Friday</h2><table>${['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((x, i) => row(`${i + 1}:00 PM - ${i + 2}:00 PM`, `DJ ${x}`, 'Main Stage')).join('')}${row('9:00 PM - 10:00 PM', 'WAX', 'Main Stage')}</table>`);
    const d2 = decide(readPageSetTimes(strangers, festival, artists)!);
    expect(d2.publish).toBe(false);
    if (!d2.publish) expect(d2.reasons.some((x) => x.startsWith("88% of the acts with set times aren't on Afterglow: DJ A, DJ B"))).toBe(true);
    // A day the festival doesn't have.
    const sunday = good.replace('<h2>Saturday, August 7</h2>', '<h2>Sunday</h2>');
    const d3 = decide(readPageSetTimes(sunday, festival, artists)!);
    expect(d3.publish).toBe(false);
    if (!d3.publish) expect(d3.reasons).toContain("The page names days the festival doesn't have: Sunday.");
  });

  it('set times entered by hand always win over the page, which otherwise adds to the lineup', () => {
    const r = readPageSetTimes(good, festival, artists)!;
    const applied = applyLineup(festival, r.lineup);
    expect(applied.sets).toHaveLength(9);
    expect(applied.lineup).toContain('subtronics-b2b-crankdat');
    expect(applied.lineup).toEqual(expect.arrayContaining(festival.lineup));
    const byHand: Festival = { ...festival, sets: [{ artistId: 'wax', day: 'Friday', stageId: 'main', start: '18:00', end: '19:00' }] };
    expect(applyLineup(byHand, r.lineup)).toBe(byHand);
    // A lineup published on purpose still replaces, as before.
    expect(applyLineup(byHand, { festivalId: festival.id, artistIds: ['wax'] }).lineup).toEqual(['wax']);
  });

  it('round-trips through the catalogue file', () => {
    const r = readPageSetTimes(good, festival, artists)!;
    const file = JSON.stringify({ version: 1, mode: 'add', artists: [], festivals: [], clips: [], lineups: [lineupToFile(r.lineup), { festival: 'x' }] });
    const parsed = parseCatalogFile(file);
    expect(parsed.snapshot?.lineups).toEqual([r.lineup]);
    expect(parsed.problems).toEqual(['Lineup "x" names no artists, so it was left out.']);
    const bad = JSON.stringify({ version: 1, artists: [], festivals: [], clips: [], lineups: [{ festival: 'f', artists: ['a'], sets: [{ artist: 'a', day: 'Friday', stage: 'main', start: '9pm', end: '22:00' }] }] });
    expect(parseCatalogFile(bad).problems[0]).toMatch(/^Lineup "f": a set needs/);
  });

  it('writes the heads-up: what went live, and what needs HQ', () => {
    const r = readPageSetTimes(good, festival, artists)!;
    const text = setTimesReport(
      [
        { name: 'Nightfall 2027', url: 'https://nightfall.test/times', decision: decide(r), change: 'new' },
        { name: 'Other Fest', url: 'https://other.test', decision: { publish: false, reasons: ['Only 3 set times could be read (at least 8 are needed).'] } },
      ],
      'https://afterglowmusic.app/admin',
    );
    expect(text).toContain('## Set times published');
    expect(text).toContain('- **Nightfall 2027**: 9 set times over 2 days and 2 stages, 100% of the lineup. [Official page](https://nightfall.test/times)');
    expect(text).toContain('## Set times found but not published');
    expect(text).toContain('### Other Fest');
    expect(text).toContain('- Only 3 set times could be read (at least 8 are needed).');
    expect(setTimesReport([], 'x')).toBe('');
  });
});
