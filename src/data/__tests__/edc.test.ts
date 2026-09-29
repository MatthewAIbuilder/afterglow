import { describe, expect, it } from '@jest/globals';
import { BUILT_IN } from '../bundled';
import { MOCK_TASTE } from '../mock';
import { EXPLORE_SHOWN, rankLineup } from '../../features/plan/plan';
import { artistsOnMap, computeLayout, MAP_MAX } from '../../features/sound-map/layout';
import { computeTaste } from '../../features/taste/engine';
import type { Reaction } from '../../state/reactions';

/** The first real festival, from the official EDC Orlando 2026 lineup poster, and how the app copes with a big lineup. */
describe('EDC Orlando 2026', () => {
  const { catalog, problems } = BUILT_IN;
  const edc = catalog.festival('edc-orlando-26')!;
  const none: Reaction = { liked: false, saved: false, skipped: false };

  it('is in the app with its full lineup and no mistakes', () => {
    expect(problems).toEqual([]);
    expect(edc).toMatchObject({ name: 'EDC Orlando 2026', dates: 'Nov 6 to 8', location: 'Tinker Field, Orlando' });
    expect(edc.lineup).toHaveLength(110);
    expect(new Set(edc.lineup).size).toBe(110);
    for (const id of edc.lineup) expect(catalog.artist(id)).toBeDefined();
    // LEVITY is the same artist as in the demo, not a copy.
    expect(edc.lineup).toContain('levity');
    expect(catalog.artists.filter((a) => a.name === 'LEVITY')).toHaveLength(1);
    // Set times aren't out yet: it's a lineup-phase festival.
    expect(catalog.phaseOf('edc-orlando-26')).toBe('lineup');
    expect(catalog.festivals[0].id).toBe('edc-orlando-26');
    // Dates and set notes from the poster.
    expect(edc).toMatchObject({ startDate: '2026-11-06', endDate: '2026-11-08' });
    expect(Object.values(edc.notes ?? {}).filter((n) => n === 'Sunset set')).toHaveLength(10);
    expect(edc.notes?.['san-holo']).toBe('Wholesome riddim set');
    expect(edc.notes?.['skull-machine']).toBe('Black Tiger Sex Machine x Kai Wachi');
  });

  it('keeps My Sound as it was for someone who hasn’t reacted to anything', () => {
    const { taste, informed } = computeTaste(MOCK_TASTE, catalog.artists, catalog.clips, {});
    expect(artistsOnMap(catalog.artists, taste, informed).map((a) => a.id).sort()).toEqual(Object.keys(MOCK_TASTE).sort());
  });

  it('brings similar-sounding EDC artists onto My Sound as you like things, up to the limit', () => {
    const likes = Object.fromEntries(catalog.clipsOf('levity').map((c) => [c.id, { ...none, liked: true }]));
    const { taste, informed } = computeTaste(MOCK_TASTE, catalog.artists, catalog.clips, likes);
    const onMap = artistsOnMap(catalog.artists, taste, informed);
    expect(onMap.length).toBeGreaterThan(Object.keys(MOCK_TASTE).length);
    expect(onMap.length).toBeLessThanOrEqual(MAP_MAX);
    // Close EDC sounds join (the map's limit may go to even closer artists from other festivals).
    const edcLineup = catalog.festival('edc-orlando-26')!.lineup;
    expect(onMap.filter((a) => edcLineup.includes(a.id) && !(a.id in MOCK_TASTE)).length).toBeGreaterThan(0);
    // Artists with no sound yet never join through similarity alone.
    const noSound = catalog.artists.filter((a) => Object.keys(a.sound).length === 0).map((a) => a.id);
    expect(noSound.length).toBeGreaterThan(0);
    for (const a of onMap) expect(noSound).not.toContain(a.id);
    // Best matches first, and the map lays out cleanly.
    for (let i = 1; i < onMap.length; i++) expect(taste[onMap[i - 1].id]).toBeGreaterThanOrEqual(taste[onMap[i].id]);
    const layout = computeLayout(onMap, taste);
    for (const b of layout.bubbles) expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
  });

  it('plans the festival with a short explore list', () => {
    const { taste, informed } = computeTaste(MOCK_TASTE, catalog.artists, catalog.clips, {});
    const picks = rankLineup({ festival: edc, artists: catalog.artists, taste, informed });
    expect(picks[0].artist.id).toBe('levity');
    const explore = picks.filter((p) => p.tier === 'explore');
    expect(explore.length).toBeGreaterThan(EXPLORE_SHOWN);
  });
});

describe('Austin City Limits 2026', () => {
  it('is in the app over its two weekends', () => {
    const acl = BUILT_IN.catalog.festival('acl-26')!;
    expect(acl.lineup).toHaveLength(138);
    expect(acl.weekends).toEqual([
      { start: '2026-10-02', end: '2026-10-04' },
      { start: '2026-10-09', end: '2026-10-11' },
    ]);
    expect(acl).toMatchObject({ startDate: '2026-10-02', endDate: '2026-10-11' });
    // Each act's day from the poster, with the weekend as a note.
    expect(acl.artistDays?.skrillex).toEqual(['Friday']);
    expect(acl.notes?.skrillex).toBe('Weekend 1 only');
    expect(acl.artistDays?.['mega-ran']).toEqual(['Saturday', 'Sunday']);
    expect(Object.keys(acl.artistDays ?? {})).toHaveLength(138);
    const cyclops = BUILT_IN.catalog.festival('cyclops-cove-4')!;
    expect(cyclops.artistDays?.subtronics).toEqual(['Saturday', 'Sunday']);
    expect(cyclops.notes).toBeUndefined();
  });
});
