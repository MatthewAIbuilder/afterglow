import { describe, expect, it } from '@jest/globals';
import { findsByCode } from '../../organizers/organizers';
import { orgDayFromDoc, orgRequestFromDoc, stickerFromDoc } from '../firebase/mapping';

describe('organizers from their documents', () => {
  it('reads a count (one per organizer, day and kind)', () => {
    expect(orgDayFromDoc({ orgId: 'underground-alchemy', day: '2026-11-14', key: 'e_transmutation-11-14', n: 12 })).toEqual({ day: '2026-11-14', counts: { 'e_transmutation-11-14': 12 } });
    expect(orgDayFromDoc({ orgId: 'o', day: '2026-11-14', key: 'f_uagift0001', n: 3 })).toEqual({ day: '2026-11-14', counts: { f_uagift0001: 3 } });
    expect(orgDayFromDoc({ orgId: 'o', day: '2026-11-14', key: 'hack', n: 3 })).toBeNull();
    expect(orgDayFromDoc({ orgId: 'o', day: 'soon', key: 'page', n: 3 })).toBeNull();
    expect(orgDayFromDoc({ orgId: 'o', day: '2026-11-14', key: 'page', n: 'many' })).toBeNull();
    expect(findsByCode([orgDayFromDoc({ day: '2026-11-14', key: 'f_uagift0001', n: 3 })!, orgDayFromDoc({ day: '2026-11-15', key: 'f_uagift0001', n: 1 })!, orgDayFromDoc({ day: '2026-11-15', key: 'page', n: 9 })!])).toEqual({ uagift0001: 4 });
  });

  it('reads a request, leaving out what isn’t one', () => {
    expect(orgRequestFromDoc('q1', { orgId: 'underground-alchemy', by: 'uidOrg', kind: 'promotion', eventId: 'transmutation-11-14', days: 7, text: 'Please', status: 'approved', reply: 'Done', createdAt: '2026-10-06T12:00:00.000Z' })).toMatchObject({
      id: 'q1',
      kind: 'promotion',
      eventId: 'transmutation-11-14',
      days: 7,
      status: 'approved',
      reply: 'Done',
    });
    expect(orgRequestFromDoc('q2', { orgId: 'o', by: 'u', kind: 'free-money', text: 'x', createdAt: '2026-10-06T12:00:00.000Z' })).toBeNull();
    expect(orgRequestFromDoc('q3', { orgId: 'o', by: 'u', kind: 'design', text: 'x', status: 'weird', createdAt: '2026-10-06T12:00:00.000Z' })?.status).toBe('open');
  });

  it('reads an organizer’s gift', () => {
    expect(stickerFromDoc('uagift0001', { name: 'Thank you', creature: 'flask', orgId: 'underground-alchemy', gift: true, note: 'See you soon' })).toMatchObject({ orgId: 'underground-alchemy', gift: true, note: 'See you soon' });
  });
});
