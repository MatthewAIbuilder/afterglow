import { describe, expect, it } from '@jest/globals';
import { ORG_STARTERS } from '../../../config/organizers';
import type { Artist, CatalogSnapshot } from '../../../data/models';
import { pinLook, themeOf } from '../../badges/badges';
import {
  activePromotions,
  actArtistId,
  artistIndex,
  cleanEvent,
  cleanInstagram,
  cleanOrg,
  cleanSoundcloud,
  datesText,
  eventFestivalId,
  eventOf,
  eventToFestival,
  newEventId,
  nightsOf,
  type Org,
  orgActs,
  orgFromStarter,
  orgOfAccount,
  orgStats,
  orgToDoc,
  promotionUntil,
  slugOf,
  splitEvents,
  withOrgs,
  withOrgWords,
} from '../organizers';

const artists: Artist[] = [
  { id: 'subtronics', name: 'Subtronics', sound: { dubstep: 1 }, imageUrl: 'https://img/sub.jpg' },
  { id: 'levity', name: 'LEVITY', sound: {} , soundGuessed: true },
];
const base: CatalogSnapshot = { artists, festivals: [{ id: 'edc-orlando-26', name: 'EDC Orlando', dates: 'Nov 6 to 8', location: 'Orlando', lineup: ['subtronics'], days: ['Friday'], stages: [] }], clips: [] };

const org = (over: Partial<Org> = {}): Org => ({
  ...orgFromStarter(ORG_STARTERS[0]),
  events: [
    {
      id: 'transmutation-11-07',
      name: 'Transmutation',
      date: '2026-11-07',
      doors: '23:00',
      venue: 'The Vault',
      city: 'Orlando, FL',
      afterOf: 'edc-orlando-26',
      published: true,
      lineup: [{ name: 'Subtronics', start: '01:00', end: '02:30' }, { name: 'Night Chemist' }, { name: 'levity' }],
    },
    { id: 'draft-12-12', name: 'Secret draft', date: '2026-12-12', venue: '', city: '', published: false, lineup: [{ name: 'Someone' }] },
  ],
  artists: { 'night-chemist': { name: 'Night Chemist', bio: 'Deep, dark and hypnotic.', instagram: 'nightchemist', photo: 'https://img/nc.jpg', sounds: ['techno', 'house'] }, subtronics: { name: 'Subtronics', bio: 'Headliner.', photo: 'https://img/other.jpg' } },
  ...over,
});

describe('organizers', () => {
  it('starts Underground Alchemy from its starter, with its mark and no made-up events', () => {
    const o = orgFromStarter(ORG_STARTERS[0]);
    expect(o).toMatchObject({ id: 'underground-alchemy', name: 'Underground Alchemy', website: 'https://undergroundalchemy.net', instagram: 'underground.alchemy', mark: 'alchemy', events: [], artists: {}, promoted: {} });
    // Its test login lands in the support inbox.
    expect(ORG_STARTERS[0].loginEmail).toBe('afterglowmusic.support+alchemy@gmail.com');
  });

  it('checks a stored page: bad events, links and fields are left out', () => {
    const o = cleanOrg('underground-alchemy', {
      name: '  Underground   Alchemy ',
      website: 'http://not-https.example',
      instagram: '@Underground.Alchemy',
      events: [{ id: 'ok-1', name: 'Fine', date: '2026-11-07', venue: 'V', city: 'C', lineup: [{ name: 'A' }, { name: 'a' }, { name: '' }], published: true, tickets: 'javascript:alert(1)' }, { id: 'Bad Id', name: 'x', date: '2026-11-07' }, { id: 'no-date', name: 'x', date: 'soon' }],
      artists: { 'ok-artist': { name: 'Ok', soundcloud: 'https://soundcloud.com/ok', sounds: ['techno', 'nope'] }, 'BAD KEY': { name: 'x' } },
      promoted: { 'ok-1': '2026-11-07', 'ok-2': 'later' },
    });
    expect(o?.name).toBe('Underground Alchemy');
    expect(o?.website).toBeUndefined();
    expect(o?.instagram).toBe('underground.alchemy');
    expect(o?.events.map((e) => e.id)).toEqual(['ok-1']);
    expect(o?.events[0].lineup).toEqual([{ name: 'A' }]);
    expect(o?.events[0].tickets).toBeUndefined();
    expect(Object.keys(o!.artists)).toEqual(['ok-artist']);
    expect(o?.artists['ok-artist'].sounds).toEqual(['techno']);
    expect(o?.promoted).toEqual({ 'ok-1': '2026-11-07' });
    expect(cleanOrg('x', { name: 'Too short id' })).toBeNull();
  });

  it('never saves promotions from the page (only HQ gives them)', () => {
    const doc = orgToDoc(org({ promoted: { 'transmutation-11-07': '2026-11-07' }, uids: ['uidA'] }));
    expect(doc).not.toHaveProperty('promoted');
    expect(doc).not.toHaveProperty('uids');
    expect(cleanOrg('underground-alchemy', { name: 'UA', uids: ['uidA', 'uidA', 'bad uid!', 3] })?.uids).toEqual(['uidA']);
    expect(orgOfAccount([org({ uids: ['uidA'] })], 'uidA')?.id).toBe('underground-alchemy');
    expect(orgOfAccount([org()], 'uidA')).toBeUndefined();
    expect(doc).not.toHaveProperty('id');
  });

  it('reads links people paste', () => {
    expect(cleanInstagram('https://www.instagram.com/underground.alchemy?igsh=abc')).toBe('underground.alchemy');
    expect(cleanInstagram('not a name!')).toBeUndefined();
    expect(cleanSoundcloud('https://m.soundcloud.com/someone')).toBe('https://soundcloud.com/someone');
    expect(cleanSoundcloud('https://example.com/someone')).toBeUndefined();
  });

  it('makes ids and dates', () => {
    expect(slugOf('Transmutation: Nov 14 & more')).toBe('transmutation-nov-14-and-more');
    const o = org();
    expect(newEventId(o, 'Transmutation', '2026-11-07')).toBe('transmutation-11-07-2');
    expect(datesText({ date: '2026-11-07' })).toBe('Nov 7');
    expect(datesText({ date: '2026-11-30', endDate: '2026-12-01' })).toBe('Nov 30 to Dec 1');
    expect(nightsOf({ date: '2026-11-06', endDate: '2026-11-08' })).toEqual(['2026-11-06', '2026-11-07', '2026-11-08']);
    expect(eventOf(eventFestivalId('underground-alchemy', 'transmutation-11-07'))).toEqual({ orgId: 'underground-alchemy', eventId: 'transmutation-11-07' });
    expect(eventOf('edc-orlando-26')).toBeUndefined();
    expect(cleanEvent({ id: 'x1', name: 'Two nights', date: '2026-11-07', endDate: '2026-11-06', lineup: [] })?.endDate).toBeUndefined();
  });

  it('matches acts to artists on Afterglow, by pick or by name, and makes new ones for the rest', () => {
    const index = artistIndex(artists);
    expect(actArtistId({ name: 'SUBTRONICS' }, index, 'underground-alchemy')).toEqual({ id: 'subtronics', isNew: false });
    expect(actArtistId({ name: 'Night Chemist' }, index, 'underground-alchemy')).toEqual({ id: 'night-chemist', isNew: true });
    // A new name whose id is taken by someone else gets the organizer's id on the end.
    const clash = artistIndex([...artists, { id: 'levity-live', name: 'Levity (a different act)', sound: {} }]);
    expect(actArtistId({ name: 'Levity Live' }, clash, 'underground-alchemy').id).toBe('levity-live-underground-alchemy');
    expect(orgActs(org(), index).map((a) => a.id)).toEqual(['subtronics', 'night-chemist', 'levity', 'someone']);
    expect(orgActs(org(), index, true).map((a) => a.id)).toEqual(['subtronics', 'night-chemist', 'levity']);
  });

  it('turns an event into a festival: one night, its venue as the stage, set times, tickets and the organizer', () => {
    const { festival } = eventToFestival(org(), org().events[0], artistIndex(artists));
    expect(festival).toMatchObject({
      id: 'underground-alchemy--transmutation-11-07',
      name: 'Transmutation',
      dates: 'Nov 7',
      location: 'The Vault, Orlando, FL',
      lineup: ['subtronics', 'night-chemist', 'levity'],
      days: ['Saturday'],
      stages: [{ id: 'main', name: 'The Vault' }],
      startDate: '2026-11-07',
      endDate: '2026-11-07',
      organizer: 'underground-alchemy',
      afterOf: 'edc-orlando-26',
      sets: [{ artistId: 'subtronics', day: 'Saturday', stageId: 'main', start: '01:00', end: '02:30' }],
      links: { website: 'https://undergroundalchemy.net' },
    });
  });

  it('adds published events after the catalogue, with the organizer’s words on its artists', () => {
    const merged = withOrgs(base, [org()]);
    expect(merged.festivals.map((f) => f.id)).toEqual(['edc-orlando-26', 'underground-alchemy--transmutation-11-07']);
    const sub = merged.artists.find((a) => a.id === 'subtronics')!;
    // Afterglow's photo stays; the words show, credited.
    expect(sub.imageUrl).toBe('https://img/sub.jpg');
    expect(sub.org).toEqual({ id: 'underground-alchemy', name: 'Underground Alchemy', bio: 'Headliner.' });
    const nc = merged.artists.find((a) => a.id === 'night-chemist')!;
    expect(nc).toMatchObject({ name: 'Night Chemist', imageUrl: 'https://img/nc.jpg', sound: { techno: 1, house: 0.6 }, org: { instagram: 'nightchemist' } });
    // Drafts never show.
    expect(merged.artists.some((a) => a.id === 'someone')).toBe(false);
    expect(withOrgs(base, [])).toBe(base);
    // A festival already there is never covered.
    const taken = { ...base, festivals: [...base.festivals, { ...base.festivals[0], id: 'underground-alchemy--transmutation-11-07' }] };
    expect(withOrgs(taken, [org()]).festivals).toHaveLength(2);
  });

  it('lays words only where Afterglow has nothing, for sounds a guess counts as nothing', () => {
    const lev = withOrgWords(artists[1], { id: 'o', name: 'O' }, { name: 'LEVITY', sounds: ['dubstep'] });
    expect(lev.sound).toEqual({ dubstep: 1 });
    expect(lev.soundGuessed).toBeUndefined();
    expect(withOrgWords(artists[0], { id: 'o', name: 'O' }, { name: 'S', sounds: ['house'] }).sound).toEqual({ dubstep: 1 });
  });

  it('promotes only what HQ promoted, published and still to come', () => {
    const o = org({ promoted: { 'transmutation-11-07': '2026-11-07', 'draft-12-12': '2026-12-12' } });
    expect(activePromotions([o], '2026-11-01').map((p) => p.festivalId)).toEqual(['underground-alchemy--transmutation-11-07']);
    expect(activePromotions([o], '2026-11-08')).toEqual([]);
    expect(promotionUntil('2026-11-01', 7, { date: '2026-11-20' })).toBe('2026-11-07');
    expect(promotionUntil('2026-11-01', 30, { date: '2026-11-07' })).toBe('2026-11-07');
  });

  it('splits events into coming up and past', () => {
    const { upcoming, past } = splitEvents(org(), '2026-11-08', true);
    expect(upcoming.map((e) => e.id)).toEqual(['draft-12-12']);
    expect(past.map((e) => e.id)).toEqual(['transmutation-11-07']);
    expect(splitEvents(org(), '2026-11-01').upcoming.map((e) => e.id)).toEqual(['transmutation-11-07']);
  });

  it('adds up the numbers over a range', () => {
    const now = new Date('2026-11-10T12:00:00Z');
    const s = orgStats(
      [
        { day: '2026-11-10', counts: { page: 3, 'e_transmutation-11-07': 5, tickets: 2, promo: 40 } },
        { day: '2026-11-09', counts: { page: 1 } },
        { day: '2026-10-01', counts: { page: 100 } },
      ],
      now,
      7,
    );
    expect(s).toMatchObject({ page: 4, events: 5, tickets: 2, promo: 40, byEvent: { 'transmutation-11-07': 5 } });
    expect(s.byDay).toHaveLength(7);
    expect(s.byDay[6]).toEqual({ day: '2026-11-10', n: 10 });
    expect(s.byDay[5]).toEqual({ day: '2026-11-09', n: 1 });
  });

  it('gives the organizer’s badge and events its mark', () => {
    expect(themeOf({ id: 'underground-alchemy', name: 'Underground Alchemy', location: '' })).toBe('alchemy');
    const { festival } = eventToFestival(org(), org().events[0], artistIndex(artists));
    expect(pinLook(festival).theme).toBe('alchemy');
    expect(pinLook(festival).rimText).toBe('TRANSMUTATION · ORLANDO');
  });
});
