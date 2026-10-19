import { describe, expect, it } from '@jest/globals';
import type { Clip, Festival } from '../../../data/models';
import { chooseArtists, chooseFestival, cssSize, DEVICES, frameHtml, LOVES, pngSize, SCALE, seedStorage, shotFile, shotList, STARS } from '../shots';

const lineup = (n: number, prefix = 'a') => Array.from({ length: n }, (_, i) => `${prefix}${i}`);
const fest = (id: string, extra: Partial<Festival> = {}): Festival => ({
  id,
  name: id.toUpperCase(),
  dates: '',
  location: '',
  lineup: lineup(25),
  days: [],
  stages: [],
  ...extra,
});
const clip = (id: string, artistId: string): Clip => ({ id, artistId, festivalId: 'x', title: 't', durationSec: 30, bpm: 128 });
const today = new Date(2026, 9, 5, 12);

describe('App Store screenshots', () => {
  it('uses exactly the sizes App Store Connect asks for, at three pixels a point', () => {
    for (const d of DEVICES) {
      const css = cssSize(d);
      expect(css.width * SCALE).toBe(d.width);
      expect(css.height * SCALE).toBe(d.height);
    }
    expect(DEVICES.map((d) => `${d.width}x${d.height}`)).toEqual(['1320x2868', '1284x2778', '1206x2622']);
  });

  it('picks the soonest real festival still to come with a proper lineup, never a demo one', () => {
    const list = [
      fest('demo', { startDate: '2026-10-20', endDate: '2026-10-21' }),
      fest('on-now', { startDate: '2026-10-02', endDate: '2026-10-11' }),
      fest('small', { startDate: '2026-10-10', endDate: '2026-10-11', lineup: lineup(5) }),
      fest('later', { startDate: '2026-12-04', endDate: '2026-12-06' }),
      fest('soon', { startDate: '2026-11-06', endDate: '2026-11-08' }),
      fest('over', { startDate: '2026-06-01', endDate: '2026-06-02' }),
    ];
    expect(chooseFestival(list, new Set(['demo']), today)?.id).toBe('soon');
    expect(chooseFestival(list, new Set(['demo']), today, 'later')?.id).toBe('later');
    expect(chooseFestival(list, new Set(['demo']), today, 'nope')).toBeUndefined();
    // Nothing ahead: the one on now.
    expect(chooseFestival([list[1]], new Set(), today)?.id).toBe('on-now');
  });

  it('chooses artists with clips first, then the best known, skipping takeovers and b2b sets', () => {
    const f = fest('f', { lineup: ['x-b2b-y', 'brand-takeover', 'quiet', 'known', 'filmed'] });
    const other = fest('g', { lineup: ['known'] });
    expect(chooseArtists(f, [clip('c1', 'filmed')], [f, other])).toEqual(['filmed', 'known', 'quiet']);
  });

  it('seeds going, ratings, stars, likes and a little care, with every tip already seen', () => {
    const f = fest('f');
    const artists = lineup(10);
    const clips = [clip('c1', 'a0'), clip('c2', 'a1'), clip('c3', 'a9'), clip('c4', 'zz')];
    const seed = seedStorage({ festival: f, artists, clips, whatsNewKey: 'k', now: 1_000_000_000 });
    expect(JSON.parse(seed['going.v1'])).toEqual(['f']);
    expect(seed['welcomed.v1']).toBe('true');
    expect(seed['whatsNew.v1']).toBe('k');
    const ratings = JSON.parse(seed['artistRatings.v1']);
    expect(Object.values(ratings).filter((r) => r === 'love')).toHaveLength(LOVES);
    expect(ratings.a9).toBe('like');
    expect(JSON.parse(seed['mustSees.v2'])).toEqual({ f: artists.slice(0, STARS) });
    // Only clips of loved artists on the lineup are liked.
    expect(Object.keys(JSON.parse(seed['reactions.v1']))).toEqual(['c1', 'c2']);
    const care = JSON.parse(seed['care.v1']);
    expect(care.timers).toEqual([]);
    expect(care.log.every((e: { kind: string }) => e.kind === 'water' || e.kind === 'checkin')).toBe(true);
  });

  it('shows the timetable only once set times are out', () => {
    expect(shotList(fest('f')).map((s) => s.id)).toEqual(['discover', 'for-you', 'my-sound', 'sounds', 'get-ready', 'festivals', 'festival-map', 'crew', 'care']);
    const timed = fest('f', { sets: [{ artistId: 'a0', day: 'Fri', stageId: 's', start: '22:00', end: '23:00' } as never] });
    expect(shotList(timed).map((s) => s.id)).toContain('timetable');
    for (const s of shotList(timed)) {
      expect(s.headline.length).toBeLessThanOrEqual(30);
      expect(s.sub.length).toBeLessThanOrEqual(110);
    }
    expect(shotFile(DEVICES[0], 0, shotList(timed)[0])).toBe('6.9-01-discover.png');
  });

  it('reads a PNG size from its header', () => {
    const header = new Uint8Array(24);
    header.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    header.set([0, 0, 0x05, 0x28], 16);
    header.set([0, 0, 0x0b, 0x34], 20);
    expect(pngSize(header)).toEqual({ width: 1320, height: 2868 });
    expect(pngSize(new Uint8Array(30))).toBeUndefined();
  });

  it('frames the screen under the headline, escaping text', () => {
    const html = frameHtml({ headline: 'Rock & <roll>', sub: 'Sub', image: 'data:x', width: 440, height: 956 });
    expect(html).toContain('Rock &amp; &lt;roll&gt;');
    expect(html).toContain('width=device-width');
    expect(html).toContain('src="data:x"');
  });
});
