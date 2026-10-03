import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { throwbackBadges, throwbackLook, pinLook, pastPinFestival } from '../../badges/badges';
import { communityClip, communityClips } from '../../community/clips';
import { crowdByNight } from '../../community/crowd';
import type { SharedMemory } from '../../social/models';
import { cleanMemories, tagMemory } from '../store';
import { THROWBACKS_FREE, throwbackShares, throwbackSharesLine } from '../throwbackLimit';
import { fakeSocial } from '../../social/__tests__/fakeSocial';
import { cleanPast, cleanPastName, pastChoices, pastEventsOf, pastKey, pastLabel, pastYears, seriesName } from '../past';

const festival = (id: string, name: string, location: string, lineup: string[] = []): Festival =>
  ({ id, name, dates: 'x', location, lineup, days: ['Friday'], stages: [] }) as Festival;
const edc = festival('edc-orlando-26', 'EDC Orlando 2026', 'Tinker Field, Orlando, Florida', ['subtronics']);

describe('past festivals', () => {
  it('names a festival without its year', () => {
    expect(seriesName('EDC Orlando 2026')).toBe('EDC Orlando');
    expect(seriesName('Lost Lands ’24')).toBe('Lost Lands');
    expect(seriesName('Cyclops Cove 4')).toBe('Cyclops Cove 4');
    expect(cleanPastName('  Sunset   Sessions 2023 ')).toBe('Sunset Sessions');
    expect(pastLabel({ name: 'EDC Orlando', year: 2024 })).toBe('EDC Orlando 2024');
    expect(pastKey({ name: 'EDC  Orlando', year: 2024 })).toBe(pastKey({ name: 'edc orlando', year: 2024 }));
  });

  it('offers the year it was filmed, then the ones before', () => {
    expect(pastYears(new Date(2024, 6, 14).toISOString(), new Date(2026, 9, 3))).toEqual([2024, 2023, 2022, 2021]);
    // Never a year still to come.
    expect(pastYears(new Date(2030, 0, 1).toISOString(), new Date(2026, 9, 3))[0]).toBe(2026);
  });

  it('searches yours first, then festivals on Afterglow, then well-known ones', () => {
    const mine = [{ name: 'Sunset Sessions', year: 2023 }];
    const none = pastChoices('', { festivals: [edc], mine });
    expect(none.map((c) => [c.name, c.from])).toEqual([
      ['Sunset Sessions', 'yours'],
      ['EDC Orlando', 'afterglow'],
    ]);
    const edcs = pastChoices('edc', { festivals: [edc], mine });
    expect(edcs[0]).toEqual({ name: 'EDC Orlando', city: 'Orlando', seriesId: 'edc-orlando-26', from: 'afterglow' });
    // The well-known EDC Orlando is the same festival: listed once.
    expect(edcs.filter((c) => c.name === 'EDC Orlando')).toHaveLength(1);
    expect(edcs.some((c) => c.name === 'EDC Las Vegas')).toBe(true);
    // By town too.
    expect(pastChoices('thornville', { festivals: [], mine: [] }).map((c) => c.name)).toEqual(['Lost Lands']);
    expect(pastChoices('zzzz', { festivals: [edc], mine })).toEqual([]);
  });

  it('reads past events back carefully', () => {
    const now = new Date(2026, 9, 3);
    expect(cleanPast({ name: 'Lost Lands', year: 2024, city: 'Thornville', seriesId: 'lost-lands-26' }, now)).toEqual({ name: 'Lost Lands', year: 2024, city: 'Thornville', seriesId: 'lost-lands-26' });
    expect(cleanPast({ name: '', year: 2024 }, now)).toBeUndefined();
    expect(cleanPast({ name: 'X', year: 1980 }, now)).toBeUndefined();
    expect(cleanPast({ name: 'X', year: 2031 }, now)).toBeUndefined();
    expect(cleanPast({ name: 'X', year: 2020.5 }, now)).toBeUndefined();
    expect(cleanPast({ name: 'X', year: 2020, seriesId: '../bad' }, now)).toEqual({ name: 'X', year: 2020 });
    expect(pastEventsOf([{ past: { name: 'A', year: 2022 } }, { past: { name: 'B', year: 2024 } }, { past: { name: 'a', year: 2022 } }, {}]).map(pastLabel)).toEqual(['B 2024', 'A 2022']);
  });

  it('is a festival on Afterglow or a past one, never both', () => {
    const m = { id: 'm1', file: 'm1.mov', capturedAt: '2024-11-09T23:15:00.000Z', addedAt: '2024-11-09T23:15:00.000Z' };
    const past = tagMemory([m], 'm1', { past: { name: 'Lost Lands', year: 2024 }, artistId: 'subtronics' });
    expect(past[0].past).toEqual({ name: 'Lost Lands', year: 2024 });
    const now = tagMemory(past, 'm1', { festivalId: 'edc-orlando-26', past: { name: 'Lost Lands', year: 2024 } });
    expect(now[0].past).toBeUndefined();
    expect(cleanMemories([{ ...m, past: { name: 'Lost Lands', year: 2024 } }])[0].past).toEqual({ name: 'Lost Lands', year: 2024 });
    expect(cleanMemories([{ ...m, festivalId: 'x', past: { name: 'Lost Lands', year: 2024 } }])[0].past).toBeUndefined();
  });
});

describe('throwbacks in Discover and on festival pages', () => {
  const shared = (id: string, over: Partial<SharedMemory> = {}): SharedMemory => ({
    id,
    uid: 'u1',
    handle: 'maya',
    videoUrl: `https://example.test/${id}.mp4`,
    artistId: 'subtronics',
    capturedAt: '2024-11-09T23:15:00.000Z',
    createdAt: `2026-10-0${id.length}T00:00:00.000Z`,
    ...over,
  });
  const artists = new Set(['subtronics']);

  it('a throwback is a clip with its year, belonging with the same festival this year', () => {
    const clip = communityClip(shared('s1', { past: { name: 'EDC Orlando', year: 2024, seriesId: 'edc-orlando-26' } }), artists)!;
    expect(clip.title).toBe('Throwback · EDC Orlando 2024');
    expect(clip.festivalId).toBe('edc-orlando-26');
    // A festival Afterglow doesn't know still makes a clip for your mix.
    expect(communityClip(shared('s2', { past: { name: 'Sunset Sessions', year: 2023 } }), artists)?.festivalId).toMatch(/^past:/);
    // With the festival in focus: its own videos and throwbacks from earlier years.
    const clips = communityClips([shared('s1', { past: { name: 'EDC Orlando', year: 2024, seriesId: 'edc-orlando-26' } }), shared('s22', { past: { name: 'Lost Lands', year: 2024 } }), shared('s333', { festivalId: 'edc-orlando-26' })], {
      artists,
      blocked: new Set(),
      hidden: new Set(),
      festival: edc,
    });
    expect(clips.map((c) => c.id).sort()).toEqual(['community:s1', 'community:s333']);
  });

  it('festival pages list throwbacks under their year, after this year’s nights', () => {
    const nights = crowdByNight([shared('s1', { past: { name: 'EDC Orlando', year: 2024, seriesId: 'edc-orlando-26' } }), shared('s22', { festivalId: 'edc-orlando-26', night: 'Friday' })], edc);
    expect(nights.map((n) => n.night)).toEqual(['Friday', 'In 2024']);
  });
});

describe('throwback badges', () => {
  it('one per festival and year, most recent year first, from the first video', () => {
    const badges = throwbackBadges([
      { id: 'a', capturedAt: '2023-07-01T22:00:00.000Z', past: { name: 'Lost Lands', year: 2023 } },
      { id: 'b', capturedAt: '2024-09-21T01:00:00.000Z', past: { name: 'Lost Lands', year: 2024 } },
      { id: 'c', capturedAt: '2024-09-20T23:00:00.000Z', past: { name: 'lost lands', year: 2024 } },
      { id: 'd', capturedAt: '2024-09-20T23:00:00.000Z' },
    ]);
    expect(badges.map((b) => [pastLabel(b.past), b.videos, b.firstId])).toEqual([
      ['Lost Lands 2024', 2, 'c'],
      ['Lost Lands 2023', 1, 'a'],
    ]);
  });

  it('look like the festival’s own pin, in rose gold, with THROWBACK on the ribbon', () => {
    const look = throwbackLook({ name: 'EDC Orlando', year: 2024, city: 'Orlando', seriesId: 'edc-orlando-26' });
    expect(look.finish).toBe('throwback');
    expect(look.ribbon).toBe('THROWBACK · 2024');
    // The same scene and colours as this year's EDC Orlando pin.
    const live = pinLook(edc);
    expect(look.theme).toBe(live.theme);
    expect(look.palette).toEqual(live.palette);
    expect(pastPinFestival({ name: 'Sunset Sessions', year: 2023 }).id).toBe(pastPinFestival({ name: 'Sunset Sessions', year: 2019 }).id);
  });
});

describe('throwback shares', () => {
  it('three free, as many as you like with Plus', () => {
    expect(THROWBACKS_FREE).toBe(3);
    expect(throwbackShares({ plus: false, used: 1 })).toEqual({ canShare: true, left: 2 });
    expect(throwbackShares({ plus: false, used: 3 })).toEqual({ canShare: false, left: 0 });
    expect(throwbackShares({ plus: false, used: 9 })).toEqual({ canShare: false, left: 0 });
    expect(throwbackShares({ plus: true, used: 9 })).toEqual({ canShare: true });
    expect(throwbackSharesLine({ canShare: true, left: 2 })).toBe('2 of 3 free throwback shares left.');
    expect(throwbackSharesLine({ canShare: true })).toBeUndefined();
  });

  it('the in-memory backend holds the line, and removing one gives its place back', async () => {
    const f = fakeSocial();
    await f.service.signUp('t@example.com', 'password123');
    await f.service.saveProfile({ handle: 'tara', displayName: 'Tara', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
    const share = (i: number) =>
      f.service.shareMemory({ memoryId: `m${i}`, videoUri: `file:///m${i}.mov`, capturedAt: '2024-07-01T22:00:00.000Z', artistId: 'subtronics', past: { name: 'Lost Lands', year: 2024 } });
    const first = await share(1);
    await share(2);
    await share(3);
    await expect(share(4)).rejects.toMatchObject({ kind: 'throwback-limit' });
    expect(await f.service.throwbackUsage()).toBe(3);
    await f.service.unshareMemory(first.id);
    expect(await f.service.throwbackUsage()).toBe(2);
    await expect(share(5)).resolves.toBeTruthy();
    // Ordinary videos aren't counted.
    await f.service.shareMemory({ memoryId: 'x', videoUri: 'file:///x.mov', capturedAt: '2026-12-05T22:00:00.000Z', festivalId: 'cyclops-cove-4', artistId: 'subtronics' });
    expect(await f.service.throwbackUsage()).toBe(3);
  });
});
