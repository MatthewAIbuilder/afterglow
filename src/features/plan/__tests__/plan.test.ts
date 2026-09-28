import { describe, expect, it } from '@jest/globals';
import { ARTISTS } from '../../../data/mock/artists';
import { CLIPS } from '../../../data/mock/clips';
import { FESTIVALS } from '../../../data/mock/festivals';
import { MOCK_TASTE } from '../../../data/mock/tasteProfile';
import type { Artist, Festival, SetTime, TasteProfile } from '../../../data/types';
import { computeTaste } from '../../taste/engine';
import { buildSchedule, rankLineup, type ScheduleItem } from '../plan';

const artist = (id: string, sound: Artist['sound'] = { dubstep: 1 }): Artist => ({ id, name: id.toUpperCase(), sound });

const ARTS = [
  artist('ace', { 'melodic-bass': 1 }),
  artist('bolt', { riddim: 1, dubstep: 0.6 }),
  artist('crest', { dubstep: 1, riddim: 0.5 }),
  artist('dune', { trap: 1 }),
  artist('echo', { techno: 1 }),
  artist('fade', { house: 1 }),
  artist('ghost', { dubstep: 1 }),
];

const TASTE: TasteProfile = { ace: 0.97, bolt: 0.95, crest: 0.91, dune: 0.8, echo: 0.6, fade: 0.2 };

const fest = (sets?: SetTime[], lineup = ARTS.map((a) => a.id)): Festival => ({
  id: 'test',
  name: 'Test',
  dates: '',
  location: '',
  lineup,
  days: ['Friday', 'Saturday'],
  stages: [],
  sets,
});

const set = (artistId: string, day: string, start: string, end: string): SetTime => ({
  artistId,
  day,
  stageId: 's',
  start,
  end,
});

const ids = (items: { artist: Artist }[]) => items.map((p) => p.artist.id);

describe('must-see ranking (before set times)', () => {
  it('ranks the lineup by match, not billing order', () => {
    const picks = rankLineup({
      festival: fest(undefined, ['dune', 'ace', 'echo', 'bolt']),
      artists: ARTS,
      taste: TASTE,
    });
    expect(ids(picks)).toEqual(['ace', 'bolt', 'dune', 'echo']);
  });

  it('sorts artists into must-see, strong match and explore by their match', () => {
    const picks = rankLineup({ festival: fest(), artists: ARTS, taste: TASTE });
    const tier = Object.fromEntries(picks.map((p) => [p.artist.id, p.tier]));
    expect(tier).toMatchObject({
      ace: 'must-see',
      bolt: 'must-see',
      crest: 'must-see',
      dune: 'strong',
      echo: 'explore',
    });
  });

  it('leaves out artists you clearly do not like', () => {
    const picks = rankLineup({ festival: fest(), artists: ARTS, taste: TASTE });
    expect(ids(picks)).not.toContain('fade');
  });

  it('works when no set times are published', () => {
    const picks = rankLineup({ festival: fest(undefined), artists: ARTS, taste: TASTE });
    expect(picks.length).toBeGreaterThan(0);
    expect(picks[0]).toMatchObject({ tier: 'must-see', set: undefined });
  });

  it('treats an artist with no taste signal as something to explore, not a confident pick', () => {
    const informed = { ace: true, bolt: true, crest: true, dune: true, echo: true, fade: true, ghost: false };
    // A default guess can be high; it still should not be presented as a must-see.
    const picks = rankLineup({ festival: fest(), artists: ARTS, taste: { ...TASTE, ghost: 0.95 }, informed });
    const ghost = picks.find((p) => p.artist.id === 'ghost');
    expect(ghost).toMatchObject({ tier: 'explore', known: false });
    expect(ids(picks.filter((p) => p.tier === 'explore'))).toEqual(['echo', 'ghost']);
  });

  it('keeps an artist on the must-see list even when their set time is not out yet', () => {
    const picks = rankLineup({
      festival: fest([set('bolt', 'Friday', '22:00', '23:00')]),
      artists: ARTS,
      taste: TASTE,
    });
    const schedule = buildSchedule(fest([set('bolt', 'Friday', '22:00', '23:00')]), picks);
    expect(picks.find((p) => p.artist.id === 'ace')?.tier).toBe('must-see');
    expect(ids(schedule.unscheduled)).toContain('ace');
  });
});

describe('manual must-sees', () => {
  it('moves an artist into must-see without changing their match', () => {
    const taste = { ...TASTE };
    const picks = rankLineup({ festival: fest(), artists: ARTS, taste, pinned: new Set(['echo']) });
    const echo = picks.find((p) => p.artist.id === 'echo');
    expect(echo).toMatchObject({ tier: 'must-see', pinned: true, match: 0.6 });
    expect(taste).toEqual(TASTE);
  });

  it('never feeds the taste engine', () => {
    const before = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, {}).taste;
    rankLineup({ festival: FESTIVALS[0], artists: ARTISTS, taste: before, pinned: new Set(['john-summit']) });
    expect(computeTaste(MOCK_TASTE, ARTISTS, CLIPS, {}).taste).toEqual(before);
    expect(before['john-summit']).toBe(MOCK_TASTE['john-summit']);
  });

  it('wins a clash against a higher match', () => {
    const f = fest([set('ace', 'Friday', '22:00', '23:30'), set('dune', 'Friday', '22:30', '23:30')]);
    const picks = rankLineup({ festival: f, artists: ARTS, taste: TASTE, pinned: new Set(['dune']) });
    const clash = buildSchedule(f, picks).days[0].items[0];
    expect(clash.kind === 'clash' && clash.verdict).toMatchObject({ kind: 'pinned', pick: { artist: { id: 'dune' } } });
  });
});

describe('schedule (after set times)', () => {
  const schedule = (sets: SetTime[], pinned?: Set<string>) => {
    const f = fest(sets);
    return buildSchedule(f, rankLineup({ festival: f, artists: ARTS, taste: TASTE, pinned }));
  };
  const itemIds = (items: ScheduleItem[]) =>
    items.map((i) => (i.kind === 'clash' ? i.picks.map((p) => p.artist.id).join('+') : i.pick.artist.id));

  it('groups sets by festival day in time order, with after-midnight sets at the end of the night', () => {
    const s = schedule([
      set('bolt', 'Friday', '00:30', '01:30'),
      set('ace', 'Friday', '21:00', '22:00'),
      set('crest', 'Saturday', '22:00', '23:00'),
    ]);
    expect(s.days.map((d) => d.day)).toEqual(['Friday', 'Saturday']);
    expect(itemIds(s.days[0].items)).toEqual(['ace', 'bolt']);
    expect(itemIds(s.days[1].items)).toEqual(['crest']);
  });

  it('detects overlapping sets, including ones that cross midnight', () => {
    const s = schedule([set('ace', 'Friday', '23:40', '01:10'), set('bolt', 'Friday', '00:15', '01:30')]);
    expect(s.days[0].clashes).toBe(1);
    expect(itemIds(s.days[0].items)).toEqual(['ace+bolt']);
  });

  it('does not call back-to-back sets or different days a clash', () => {
    const s = schedule([
      set('ace', 'Friday', '21:00', '22:00'),
      set('bolt', 'Friday', '22:00', '23:00'),
      set('crest', 'Saturday', '21:30', '22:30'),
    ]);
    expect(s.days.map((d) => d.clashes)).toEqual([0, 0]);
  });

  it('recommends the stronger match when the difference is clear', () => {
    const s = schedule([set('ace', 'Friday', '22:00', '23:30'), set('dune', 'Friday', '22:30', '23:30')]);
    const clash = s.days[0].items[0];
    expect(clash.kind).toBe('clash');
    if (clash.kind !== 'clash') return;
    expect(clash.verdict.kind).toBe('clear');
    if (clash.verdict.kind !== 'clear') return;
    expect(clash.verdict.pick.artist.id).toBe('ace');
    expect(clash.verdict.other.artist.id).toBe('dune');
    expect(clash.verdict.lead).toBeCloseTo(0.17);
  });

  it('treats near-equal matches as a close call instead of picking a winner', () => {
    const s = schedule([set('ace', 'Friday', '22:00', '23:30'), set('bolt', 'Friday', '22:30', '23:30')]);
    const clash = s.days[0].items[0];
    expect(clash.kind === 'clash' && clash.verdict.kind).toBe('close');
  });

  it('points out the part of a clashing set you can still catch', () => {
    const s = schedule([set('ace', 'Friday', '23:00', '00:30'), set('dune', 'Friday', '22:00', '23:15')]);
    const clash = s.days[0].items[0];
    expect(clash.kind === 'clash' && clash.verdict.catch).toMatchObject({
      pick: { artist: { id: 'dune' } },
      minutes: 60,
      when: 'before',
    });
  });

  it('suggests exploring when nothing on your plan is playing', () => {
    const s = schedule([set('ace', 'Friday', '22:00', '23:00'), set('echo', 'Friday', '20:00', '21:30')]);
    const [first] = s.days[0].items;
    expect(first).toMatchObject({ kind: 'discover', pick: { artist: { id: 'echo' } }, reason: { kind: 'new-sound' } });
  });

  it('offers an explore pick as an alternative, not a clash, when it overlaps your plan', () => {
    const s = schedule([set('dune', 'Friday', '22:00', '23:00'), set('echo', 'Friday', '22:15', '23:30')]);
    expect(s.days[0].clashes).toBe(0);
    expect(s.days[0].items).toHaveLength(1);
    expect(s.days[0].items[0]).toMatchObject({ kind: 'set', alternatives: [{ artist: { id: 'echo' } }] });
  });
});

describe('mock festivals', () => {
  const taste = computeTaste(MOCK_TASTE, ARTISTS, CLIPS, {});
  const plan = (f: Festival) =>
    rankLineup({ festival: f, artists: ARTISTS, taste: taste.taste, informed: taste.informed });

  it('Horizon has no set times and still gets a must-see list', () => {
    const horizon = FESTIVALS.find((f) => f.id === 'horizon-27')!;
    expect(horizon.sets?.length ?? 0).toBe(0);
    expect(ids(plan(horizon).filter((p) => p.tier === 'must-see'))).toEqual(['subtronics', 'levity']);
  });

  it('Solstice shows a close call on Friday and a clear pick on Saturday', () => {
    const solstice = FESTIVALS.find((f) => f.id === 'solstice-26')!;
    const days = buildSchedule(solstice, plan(solstice)).days;
    const verdict = (d: number) => days[d].items.find((i) => i.kind === 'clash');
    expect(verdict(0)?.kind === 'clash' && verdict(0)?.verdict.kind).toBe('close');
    const sat = verdict(1);
    expect(sat?.kind === 'clash' && sat.verdict.kind === 'clear' && sat.verdict.pick.artist.id).toBe('levity');
  });
});
