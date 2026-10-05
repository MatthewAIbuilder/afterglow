import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { monthLine } from '../calendar';
import { DEFAULT_KM, RADII, festivalStates, parseReach, radiusLabel, reachWords, stateFromText, stateNear, statesWithFestivals, withinReach } from '../reach';

const fest = (id: string, location: string, place?: { lat: number; lon: number }) => ({ id, name: id, dates: '', location, place, lineup: [], days: [], stages: [] }) as unknown as Festival;
const placeOf = (f: Festival) => f.place;

const orlando = { lat: 28.54, lon: -81.38 };
const edc = fest('edc', 'Tinker Field, Orlando', { lat: 28.537, lon: -81.404 });
const kissimmee = fest('kissimmee', 'Lakefront, Kissimmee, FL', { lat: 28.29, lon: -81.41 });
const miami = fest('miami', 'Bayfront Park, Miami, Florida', { lat: 25.77, lon: -80.19 });
const acl = fest('acl', 'Austin, Texas', { lat: 30.267, lon: -97.771 });
const form = fest('form', 'Arcosanti, Mayer, AZ 86333');
const nowhere = fest('nowhere', 'Somewhere');
const all = [edc, kissimmee, miami, acl, form, nowhere];
const ids = (fs: Festival[]) => fs.map((f) => f.id);

describe('how far the calendar looks', () => {
  it('reads a state from the end of a location', () => {
    expect(stateFromText('Arcosanti, Mayer, AZ')).toBe('AZ');
    expect(stateFromText('Arcosanti, Mayer, AZ 86333')).toBe('AZ');
    expect(stateFromText('Austin, Texas')).toBe('TX');
    expect(stateFromText('Echostage, Washington, DC')).toBe('DC');
    expect(stateFromText('Tinker Field, Orlando')).toBeUndefined();
    expect(stateFromText('Amsterdam, Netherlands')).toBeUndefined();
  });

  it('borrows a state from a festival close by, and lists states busiest first', () => {
    const states = festivalStates(all, placeOf);
    expect(states.get('edc')).toBe('FL');
    expect(states.get('form')).toBe('AZ');
    expect(states.has('nowhere')).toBe(false);
    expect(statesWithFestivals(states).map((s) => `${s.name} ${s.count}`)).toEqual(['Florida 3', 'Arizona 1', 'Texas 1']);
    expect(stateNear(orlando, all, states, placeOf)).toBe('FL');
    expect(stateNear({ lat: 47.6, lon: -122.3 }, all, states, placeOf)).toBeUndefined();
  });

  it('keeps what’s within reach, and always what you’re going to', () => {
    const states = festivalStates(all, placeOf);
    const ctx = { here: orlando, placeOf, states, going: [] as string[] };
    expect(ids(withinReach(all, { kind: 'near', km: DEFAULT_KM }, ctx))).toEqual(['edc', 'kissimmee']);
    expect(ids(withinReach(all, { kind: 'near', km: DEFAULT_KM }, { ...ctx, going: ['acl'] }))).toEqual(['edc', 'kissimmee', 'acl']);
    expect(ids(withinReach(all, { kind: 'near', km: RADII.mi[3] }, ctx))).toEqual(['edc', 'kissimmee', 'miami']);
    expect(ids(withinReach(all, { kind: 'state', code: 'TX' }, ctx))).toEqual(['acl']);
    expect(withinReach(all, { kind: 'all' }, ctx)).toHaveLength(all.length);
    // Without your location, near you leaves nothing out.
    expect(withinReach(all, { kind: 'near', km: DEFAULT_KM }, { ...ctx, here: undefined })).toHaveLength(all.length);
  });

  it('says how far in words', () => {
    expect(radiusLabel(DEFAULT_KM, 'mi')).toBe('100 mi');
    expect(radiusLabel(RADII.km[1], 'km')).toBe('150 km');
    expect(reachWords({ kind: 'near', km: DEFAULT_KM }, 'mi', true)).toBe('within 100 mi');
    expect(reachWords({ kind: 'near', km: DEFAULT_KM }, 'mi', false)).toBe('');
    expect(reachWords({ kind: 'state', code: 'FL' }, 'mi', true)).toBe('in Florida');
    expect(monthLine(2, { year: 2026, month: 10 }, 'within 100 mi')).toBe('2 festivals within 100 mi in November');
    expect(monthLine(0, { year: 2026, month: 10 }, 'in Florida')).toBe('No festivals in Florida in November yet');
  });

  it('checks a saved reach', () => {
    expect(parseReach({ kind: 'near', km: 160 })).toEqual({ kind: 'near', km: 160 });
    expect(parseReach({ kind: 'state', code: 'FL' })).toEqual({ kind: 'state', code: 'FL' });
    expect(parseReach({ kind: 'state', code: 'XX' })).toBeUndefined();
    expect(parseReach({ kind: 'near', km: -1 })).toBeUndefined();
    expect(parseReach('all')).toBeUndefined();
  });
});
