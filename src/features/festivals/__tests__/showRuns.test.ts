import { describe, expect, it } from '@jest/globals';
import type { Show } from '../../../data/models';
import { showRun } from '../showRuns';

const show = (id: string, date: string, name?: string, venue = 'Armature Works', location = 'Tampa, FL'): Show => ({ id, date, name, venue, location, link: 'https://edmtrain.com/x', artistIds: ['a'] });

describe('showRun', () => {
  const fri = show('edm-1', '2026-12-11', 'We Belong Here - Tampa Bay');
  const sat = show('edm-2', '2026-12-12', 'We Belong Here - Tampa Bay');
  const sun = show('edm-3', '2026-12-13', 'we belong here – tampa bay');

  it('joins the days of one event, from any of them', () => {
    expect(showRun([sun, fri, sat], sat).map((s) => s.id)).toEqual(['edm-1', 'edm-2', 'edm-3']);
    expect(showRun([sun, fri, sat], fri).map((s) => s.id)).toEqual(['edm-1', 'edm-2', 'edm-3']);
  });

  it('stops at a gap, another venue or another name', () => {
    const later = show('edm-4', '2026-12-15', 'We Belong Here - Tampa Bay');
    const elsewhere = show('edm-5', '2026-12-14', 'We Belong Here - Tampa Bay', 'Other Place');
    expect(showRun([fri, sat, sun, later, elsewhere], sun).map((s) => s.id)).toEqual(['edm-1', 'edm-2', 'edm-3']);
    expect(showRun([fri, sat, later], later).map((s) => s.id)).toEqual(['edm-4']);
  });

  it('never joins a club’s nights, which have no name of their own', () => {
    const a = show('edm-6', '2026-12-11', undefined, 'Echostage', 'Washington, DC');
    const b = show('edm-7', '2026-12-12', undefined, 'Echostage', 'Washington, DC');
    expect(showRun([a, b], a)).toEqual([a]);
  });
});
