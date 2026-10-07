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
  handleFor,
  orgProfileInput,
  searchOrgs,
  foundEvents,
  withHosted,
  orgDjs,
  importedCandidates,
  orgListings,
  draftFrom,
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
  it('lays imported events an organizer claimed or copied over the catalogue, never changing them', () => {
    const edm: CatalogSnapshot = {
      ...base,
      festivals: [...base.festivals, { id: 'alchemy-fest-26', name: 'Alchemy Fest 2026', dates: 'Nov 20 to 21', startDate: '2026-11-20', endDate: '2026-11-21', location: 'The Vault, Orlando, FL', place: { lat: 28.5, lon: -81.4 }, lineup: ['subtronics'], days: ['Friday', 'Saturday'], stages: [], source: { name: 'EDMTrain', url: 'https://edmtrain.com/x' } }],
      shows: [
        { id: 'edm-111', date: '2026-10-24', name: 'Underground Alchemy presents', venue: 'The Vault', location: 'Orlando, FL', link: 'https://edmtrain.com/e/111', artistIds: ['subtronics'] },
        { id: 'edm-222', date: '2026-10-25', venue: 'Elsewhere', location: 'Tampa, FL', link: 'https://edmtrain.com/e/222', artistIds: ['subtronics'] },
      ],
    };
    const look = { festival: (id: string) => edm.festivals.find((f) => f.id === id), show: (id: string) => edm.shows!.find((x) => x.id === id) };
    const o = org({ events: [{ ...org().events[0] }], claims: [] });
    // Suggestions: its name and its venues; typed words; never the ones already claimed.
    expect(importedCandidates(o, edm.festivals, edm.shows!, '', '2026-10-06').map((c) => c.id)).toEqual(['edm-111', 'alchemy-fest-26']);
    expect(importedCandidates(o, edm.festivals, edm.shows!, 'tampa', '2026-10-06').map((c) => c.id)).toEqual(['edm-222']);
    expect(importedCandidates({ ...o, claims: ['edm-111'] }, edm.festivals, edm.shows!, '', '2026-10-06').map((c) => c.id)).toEqual(['alchemy-fest-26']);

    // Claimed: marked as theirs, as imported.
    const claimed = withOrgs(edm, [{ ...o, claims: ['alchemy-fest-26', 'edm-111'] }]);
    expect(claimed.festivals.find((f) => f.id === 'alchemy-fest-26')).toMatchObject({ name: 'Alchemy Fest 2026', organizer: 'underground-alchemy', source: { name: 'EDMTrain' } });
    expect(claimed.shows!.find((x) => x.id === 'edm-111')?.organizer).toBe('underground-alchemy');
    expect(claimed.shows!.find((x) => x.id === 'edm-222')?.organizer).toBeUndefined();
    expect(edm.festivals.find((f) => f.id === 'alchemy-fest-26')?.organizer).toBeUndefined();
    expect(orgListings({ ...o, claims: ['alchemy-fest-26', 'edm-111'] }, look, '2026-10-06').upcoming.map((l) => l.href)).toEqual(['/show/edm-111', '/festival/underground-alchemy--transmutation-11-07', '/festival/alchemy-fest-26']);

    // Copied and published: its version takes the festival's place (same id and spot on the map); a copied show's festival page replaces the show.
    const fest = draftFrom(o, 'alchemy-fest-26', look, (id) => edm.artists.find((a) => a.id === id)?.name)!;
    expect(fest).toMatchObject({ name: 'Alchemy Fest 2026', date: '2026-11-20', endDate: '2026-11-21', venue: 'The Vault', city: 'Orlando, FL', lineup: [{ name: 'Subtronics', artistId: 'subtronics' }], from: 'alchemy-fest-26', fromKind: 'festival', published: false });
    const show = draftFrom(o, 'edm-111', look, (id) => edm.artists.find((a) => a.id === id)?.name)!;
    expect(show).toMatchObject({ name: 'Underground Alchemy presents', venue: 'The Vault', city: 'Orlando, FL', tickets: 'https://edmtrain.com/e/111', fromKind: 'show' });
    const copied = withOrgs(edm, [{ ...o, claims: ['alchemy-fest-26', 'edm-111'], events: [...o.events, { ...fest, name: 'Alchemy Fest (ours)', doors: '21:00', published: true }, { ...show, published: true }] }]);
    const replaced = copied.festivals.find((f) => f.id === 'alchemy-fest-26')!;
    expect(replaced).toMatchObject({ name: 'Alchemy Fest (ours)', organizer: 'underground-alchemy', place: { lat: 28.5, lon: -81.4 } });
    expect(replaced.source).toBeUndefined();
    expect(copied.festivals.filter((f) => f.id === 'alchemy-fest-26')).toHaveLength(1);
    expect(copied.shows!.map((x) => x.id)).toEqual(['edm-222']);
    expect(copied.festivals.some((f) => f.id === `underground-alchemy--${show.id}`)).toBe(true);
    // A draft copy changes nothing.
    expect(withOrgs(edm, [{ ...o, events: [{ ...fest }] }]).festivals.find((f) => f.id === 'alchemy-fest-26')?.name).toBe('Alchemy Fest 2026');
  });
  it('gives the organizer’s accounts its name and @handle, and lists its DJs with how often they play', () => {
    expect(handleFor('Underground Alchemy')).toBe('undergroundalchemy');
    expect(orgProfileInput({ name: 'Underground Alchemy', tagline: 'After parties', handle: 'undergroundalchemy' }, '')).toEqual({ handle: 'undergroundalchemy', displayName: 'Underground Alchemy', bio: 'After parties', showFestivals: false, showSound: false, showArtists: false });
    const look = { festival: (id: string) => ({ ...base.festivals.find((f) => f.id === id)!, startDate: '2026-11-06' }), show: () => undefined };
    const o = org({ claims: ['edc-orlando-26'] });
    const all = withOrgs(base, [o]).artists;
    const djs = orgDjs(o, look, all, '2026-10-06');
    expect(djs[0]).toMatchObject({ artistId: 'subtronics', events: 2, upcoming: 2, next: '2026-11-06', sound: 'dubstep' });
    expect(djs.map((d) => d.artistId)).toEqual(expect.arrayContaining(['night-chemist', 'levity']));
    expect(djs.some((d) => d.artistId === 'someone')).toBe(false);
  });

  it('finds organizers by name, @handle or Instagram, and the events they host', () => {
    const ua: Org = { ...orgFromStarter(ORG_STARTERS[0]), handle: 'undergroundalchemy' };
    const other: Org = { ...orgFromStarter(ORG_STARTERS[0]), id: 'other', name: 'Bass Nation', instagram: 'bassnation', handle: undefined };
    const orgs = [other, ua];
    expect(searchOrgs(orgs, 'alchemy')).toEqual([ua]);
    expect(searchOrgs(orgs, 'UNDERGROUND')).toEqual([ua]);
    expect(searchOrgs(orgs, '@undergroundalch')).toEqual([ua]);
    expect(searchOrgs(orgs, 'underground.alchemy')).toEqual([ua]);
    expect(searchOrgs(orgs, 'bass')).toEqual([other]);
    expect(searchOrgs(orgs, 'a')).toEqual([]);
    expect(searchOrgs(orgs, 'nothing like it')).toEqual([]);
    const festivals = [{ id: 'a' }, { id: 'b', organizer: ua.id }, { id: 'c', organizer: 'other' }];
    expect(withHosted([festivals[0]], festivals, [ua]).map((f) => f.id)).toEqual(['a', 'b']);
    expect(withHosted([festivals[1]], festivals, [ua]).map((f) => f.id)).toEqual(['b']);
    expect(withHosted([festivals[0]], festivals, []).map((f) => f.id)).toEqual(['a']);
    expect(withHosted([festivals[0]], festivals, [ua], 1).map((f) => f.id)).toEqual(['a']);
  });

  it('adds the events found on its ticket pages once, as listed, with no lineup', () => {
    const found = ORG_STARTERS[0].pastEvents!;
    const org = orgFromStarter(ORG_STARTERS[0]);
    const events = foundEvents(org, found);
    expect(events).toHaveLength(found.length);
    expect(new Set(events.map((e) => e.id)).size).toBe(found.length);
    expect(events[0]).toEqual({ id: expect.any(String), name: 'Underground Alchemy Presents: A Halloween Forest Rave', date: '2024-10-26', venue: '1401 C CO RD 13', city: 'Orlando, FL', tickets: 'https://posh.vip/e/halloween-forest-rave-2', lineup: [], published: true });
    // Already there (by name and night, or by its page): not again.
    expect(foundEvents({ events }, found)).toEqual([]);
    expect(foundEvents({ events: [{ ...events[1], name: 'Journey (renamed)' }] }, found).map((e) => e.name)).not.toContain('Journey');
    expect(foundEvents(org, undefined)).toEqual([]);
  });
});
