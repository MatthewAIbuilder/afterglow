import { describe, expect, it } from '@jest/globals';
import { MOCK_CATALOG } from '../../../data/mock';
import type { Clip, Festival } from '../../../data/types';
import { defaultFocus, festivalLine, ticketLine, festivalsOf, focusForClip, lineupClips, lineupReach, nextFocus, otherFestivalsWithClips, playsAt } from '../links';

const { artists: ARTISTS, clips: CLIPS, festivals: FESTIVALS, festival: festivalById } = MOCK_CATALOG;

const solstice = festivalById('solstice-26')!;
const horizon = festivalById('horizon-27')!;
const clipOf = (artistId: string) => CLIPS.find((c) => c.artistId === artistId)!;

describe('festival and artist relationships', () => {
  it('knows who plays where', () => {
    expect(playsAt(solstice, 'illenium')).toBe(true);
    expect(playsAt(horizon, 'illenium')).toBe(false);
    expect(festivalsOf(FESTIVALS, 'john-summit').map((f) => f.id)).toEqual(['solstice-26', 'horizon-27']);
    expect(festivalsOf(FESTIVALS, 'excision').map((f) => f.id)).toEqual(['solstice-26']);
  });

  it('every lineup artist exists and every clip artist plays somewhere', () => {
    const ids = new Set(ARTISTS.map((a) => a.id));
    for (const f of FESTIVALS) for (const id of f.lineup) expect(ids.has(id)).toBe(true);
    for (const c of CLIPS) expect(festivalsOf(FESTIVALS, c.artistId).length).toBeGreaterThan(0);
  });

  it('every set time belongs to someone on that lineup, on a real day and stage', () => {
    for (const f of FESTIVALS)
      for (const s of f.sets ?? []) {
        expect(f.lineup).toContain(s.artistId);
        expect(f.days).toContain(s.day);
        expect(f.stages.map((st) => st.id)).toContain(s.stageId);
      }
  });

  it('shows only lineup artists when Discover focuses on a festival', () => {
    const shown = lineupClips(horizon, CLIPS);
    expect(shown.length).toBeGreaterThan(0);
    for (const c of shown) expect(horizon.lineup).toContain(c.artistId);
    expect(shown.some((c) => c.artistId === 'illenium')).toBe(false);
    expect(lineupReach(horizon, CLIPS)).toEqual({ clips: shown.length, artists: 5 });
    expect(lineupReach(solstice, CLIPS)).toEqual({ clips: CLIPS.length, artists: 7 });
  });

  it('opens Discover on the first festival that has something to show', () => {
    expect(defaultFocus(FESTIVALS, CLIPS)?.id).toBe('solstice-26');
    const empty: Festival = { ...horizon, id: 'empty', lineup: ['nobody'] };
    expect(defaultFocus([empty, horizon], CLIPS)?.id).toBe('horizon-27');
    // The festival with the most clips wins, even if it isn't first.
    expect(defaultFocus([horizon, solstice], CLIPS)?.id).toBe('solstice-26');
    expect(defaultFocus([empty], CLIPS)?.id).toBe('empty');
  });

  it('keeps the focus when a requested clip plays there, and moves it when it does not', () => {
    expect(focusForClip(clipOf('john-summit'), horizon, FESTIVALS)?.id).toBe('horizon-27');
    expect(focusForClip(clipOf('illenium'), horizon, FESTIVALS)?.id).toBe('solstice-26');
    const stray: Clip = { ...clipOf('illenium'), artistId: 'nobody' };
    expect(focusForClip(stray, horizon, FESTIVALS)).toBeUndefined();
  });

  it('describes an artist’s place at a festival in both phases', () => {
    expect(festivalLine(solstice, 'illenium')).toBe('Friday 11:40 PM, Main Stage');
    expect(festivalLine(horizon, 'levity')).toBe('On the lineup, set time to come');
    expect(festivalLine(horizon, 'illenium')).toBeUndefined();
    // In a feed that mixes festivals, the line says which one.
    expect(festivalLine(solstice, 'illenium', true)).toBe('Solstice 2026 · Friday 11:40 PM, Main Stage');
    expect(festivalLine(horizon, 'levity', true)).toBe('Horizon 2027 · Set time to come');
    expect(festivalLine(horizon, 'illenium', true)).toBeUndefined();
  });

  it('the ticket under a Discover clip: whose show, then when, in both phases', () => {
    const today = new Date(2026, 9, 7);
    expect(ticketLine(solstice, 'illenium', true, today)).toEqual({ title: 'You’ll see them at Solstice 2026', detail: 'Friday 11:40 PM, Main Stage' });
    expect(ticketLine(horizon, 'levity', false, today)).toEqual({ title: 'Playing Horizon 2027', detail: 'Mar 12 to 14 · set time to come' });
    expect(ticketLine(horizon, 'illenium', true, today)).toBeUndefined();
    // Once it's over it says so, even if you went.
    const past: Festival = { ...horizon, startDate: '2026-03-12', endDate: '2026-03-14' };
    expect(ticketLine(past, 'levity', true, today)?.title).toBe('Played Horizon 2027');
    const soon: Festival = { ...horizon, startDate: '2026-11-12', endDate: '2026-11-14' };
    expect(ticketLine(soon, 'levity', true, today)?.title).toBe('You’ll see them at Horizon 2027');
  });

  it('moves Discover between festivals: a festival page wins, then a requested clip, otherwise it stays', () => {
    expect(nextFocus(solstice, {}, FESTIVALS)).toBe(solstice);
    expect(nextFocus(solstice, { festival: horizon }, FESTIVALS)).toBe(horizon);
    expect(nextFocus(solstice, { festival: horizon, clip: clipOf('illenium') }, FESTIVALS)).toBe(horizon);
    expect(nextFocus(horizon, { clip: clipOf('illenium') }, FESTIVALS)).toBe(solstice);
    expect(nextFocus(horizon, { clip: clipOf('levity') }, FESTIVALS)).toBe(horizon);
    const stray: Clip = { ...clipOf('illenium'), artistId: 'nobody' };
    expect(nextFocus(horizon, { clip: stray }, FESTIVALS)).toBe(horizon);
  });

  it('every artist in the feed of a festival can be followed to that festival and its plan', () => {
    for (const f of FESTIVALS)
      for (const c of lineupClips(f, CLIPS)) {
        expect(festivalLine(f, c.artistId)).toBeDefined();
        expect(festivalsOf(FESTIVALS, c.artistId)).toContain(f);
      }
  });

  it('suggests other festivals to discover next, most clips first', () => {
    expect(otherFestivalsWithClips(FESTIVALS, CLIPS, 'horizon-27').map((f) => f.id)).toEqual(['solstice-26']);
    expect(otherFestivalsWithClips(FESTIVALS, CLIPS, 'solstice-26').map((f) => f.id)).toEqual(['horizon-27']);
    const empty: Festival = { ...horizon, id: 'empty', lineup: ['nobody'] };
    expect(otherFestivalsWithClips([empty, ...FESTIVALS], CLIPS, undefined, 5).map((f) => f.id)).toEqual(['solstice-26', 'horizon-27']);
  });

  it('counts a lineup’s clips the same way everywhere, an artist listed twice once', () => {
    const twice: Festival = { ...horizon, id: 'twice', lineup: [...horizon.lineup, ...horizon.lineup] };
    expect(lineupClips(twice, CLIPS)).toEqual(lineupClips(horizon, CLIPS));
    // Ties go to the first given, so a doubled lineup must not count for more.
    expect(defaultFocus([horizon, twice], CLIPS)?.id).toBe('horizon-27');
    expect(otherFestivalsWithClips([horizon, twice], CLIPS, undefined, 2).map((f) => f.id)).toEqual(['horizon-27', 'twice']);
  });
});
