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
    expect(onMap.map((a) => a.id)).toEqual(expect.arrayContaining(['jkyl-and-hyde', 'wooli']));
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
