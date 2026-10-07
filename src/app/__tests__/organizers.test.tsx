import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert, type AlertButton, Share } from 'react-native';
import { ORG_STARTERS } from '../../config/organizers';
import { orgFromStarter, type Org } from '../../features/organizers/organizers';
import { forgetOrgViews } from '../../features/organizers/useOrgView';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGuestView } from '../../state/adminView';
import { forgetLivePatches } from '../../state/livePatches';
import { renderApp, showTab } from './appRoutes';

/** Event organizers: HQ sets one up, its team runs its studio, and everyone sees its events, page, promotions and gifts. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 14) => {
  for (let i = 0; i < rounds; i++) await settle();
};
const s = () => mockSocial.service;
const SUPPORT = 'afterglowmusic.support@gmail.com';
const TEST_LOGIN = ORG_STARTERS[0].loginEmail;
const ORG = 'underground-alchemy';
const EVENT = `${ORG}--transmutation-11-14`;
/** Every alert taps the button with this label (or does nothing). */
const answerAlerts = (label?: string) => jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons?: AlertButton[]) => void buttons?.find((b) => b.text === label)?.onPress?.());

/** Underground Alchemy as HQ set it up, with one published event (Saturday Nov 14) and the test login. */
function seed(over: Partial<Org> = {}) {
  const org: Org = {
    ...orgFromStarter(ORG_STARTERS[0]),
    about: 'After parties till sunrise.',
    events: [{ id: 'transmutation-11-14', name: 'Transmutation', date: '2026-11-14', doors: '23:00', venue: 'The Vault', city: 'Orlando, FL', tickets: 'https://tickets.example/transmutation', published: true, lineup: [{ name: 'Subtronics' }, { name: 'Night Chemist' }] }],
    artists: { 'night-chemist': { name: 'Night Chemist', bio: 'Deep, dark and hypnotic.' } },
    ...over,
  };
  mockSocial.orgs.set(ORG, org);
  mockSocial.orgMembers.set(TEST_LOGIN, ORG);
  return org;
}

async function organizer(url = '/studio') {
  mockSocial.verified.add(TEST_LOGIN);
  await s().signUp(TEST_LOGIN, 'password123');
  const app = await renderApp(url);
  await flush();
  return app;
}

beforeEach(async () => {
  jest.restoreAllMocks();
  jest.useFakeTimers({ now: new Date(2026, 9, 6, 12) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetGuestView();
  forgetLivePatches();
  forgetOrgViews();
});

describe('organizers', () => {
  it('HQ sets up Underground Alchemy with its test login, and opens its studio', async () => {
    mockSocial.verified.add(SUPPORT);
    await s().signUp(SUPPORT, 'password123');
    const app = await renderApp('/');
    await flush();
    await showTab(app, 'Organizers');
    await flush();
    await fireEvent.press(app.getByText('Set up Underground Alchemy'));
    await flush();
    expect(mockSocial.orgs.get(ORG)).toMatchObject({ name: 'Underground Alchemy', website: 'https://undergroundalchemy.net', instagram: 'underground.alchemy', mark: 'alchemy', events: [] });
    expect(mockSocial.orgMembers.get(TEST_LOGIN)).toBe(ORG);
    expect(app.getByText(TEST_LOGIN)).toBeTruthy();

    // Handing over: the organizer's own email in, the test one out.
    await fireEvent.changeText(app.getByLabelText('Email to add'), 'Stefan@Example.com');
    await fireEvent.press(app.getByText('Add email'));
    await flush();
    expect(mockSocial.orgMembers.get('stefan@example.com')).toBe(ORG);
    answerAlerts('Remove');
    await fireEvent.press(app.getByLabelText(`Remove ${TEST_LOGIN}`));
    await flush();
    expect(mockSocial.orgMembers.has(TEST_LOGIN)).toBe(false);

    await fireEvent.press(app.getByText('Open its studio'));
    await flush();
    expect(app.getByText('Afterglow HQ, working on Underground Alchemy')).toBeTruthy();
    await app.unmount();
  });

  it('the organizer adds an event with a lineup, publishes it, and everyone sees it hosted by them', async () => {
    seed({ events: [] });
    const app = await organizer();
    expect(app.getByText('Organizer studio')).toBeTruthy();
    // Signed in with the organizer's email, the account links itself (its profile then shows the organizer).
    expect(mockSocial.orgs.get(ORG)!.uids).toEqual([mockSocial.currentUser()!.uid]);
    await showTab(app, 'Events');
    await fireEvent.press(app.getByText('Add an event'));
    await fireEvent.changeText(app.getByLabelText('Name'), 'Transmutation');
    await fireEvent.changeText(app.getByLabelText('Night'), '2026-11-14');
    await fireEvent.changeText(app.getByLabelText('Doors'), '23:00');
    await fireEvent.changeText(app.getByLabelText('Venue'), 'The Vault');
    await fireEvent.changeText(app.getByLabelText('City'), 'Orlando, FL');
    await fireEvent.changeText(app.getByLabelText('Tickets link'), 'https://tickets.example/t');
    await fireEvent.changeText(app.getByLabelText('Add an artist'), 'Subtron');
    await fireEvent.press(app.getByLabelText('Add SUBTRONICS, on Afterglow'));
    await fireEvent.changeText(app.getByLabelText('Add an artist'), 'Night Chemist');
    await fireEvent.press(app.getByLabelText('Add Night Chemist as a new artist'));
    await fireEvent.changeText(app.getByLabelText('SUBTRONICS starts'), '01:00');
    await fireEvent.changeText(app.getByLabelText('SUBTRONICS ends'), '02:30');
    answerAlerts('Publish');
    await fireEvent.press(app.getByText('Publish'));
    await flush();
    const saved = mockSocial.orgs.get(ORG)!;
    expect(saved.events).toEqual([
      expect.objectContaining({ id: 'transmutation-11-14', name: 'Transmutation', published: true, doors: '23:00', lineup: [{ name: 'SUBTRONICS', artistId: 'subtronics', start: '01:00', end: '02:30' }, { name: 'Night Chemist' }] }),
    ]);

    // It's a festival page now, hosted by them, with tickets; the view is counted for their numbers.
    await act(async () => router.push(`/festival/${EVENT}`));
    await flush();
    expect(app.getAllByText('Transmutation').length).toBeGreaterThan(0);
    expect(app.getByText('Hosted by')).toBeTruthy();
    expect(app.getByText('Doors 11:00 PM')).toBeTruthy();
    expect(app.getByLabelText('Get tickets for Transmutation from Underground Alchemy')).toBeTruthy();
    expect([...mockSocial.orgViews.keys()].some((k) => k.endsWith('_e_transmutation-11-14'))).toBe(true);
    await app.unmount();
  });

  it('drafts stay in the studio; a non-organizer and an unconfirmed email can’t open it', async () => {
    seed();
    await s().signUp('someone@example.com', 'password123');
    const app = await renderApp('/studio');
    await flush();
    expect(app.getByText('This account isn’t an organizer yet')).toBeTruthy();
    await app.unmount();
    await s().signOut();

    await s().signUp(TEST_LOGIN, 'password123');
    const unconfirmed = await renderApp('/studio');
    await flush();
    expect(unconfirmed.getByText('Confirm your email to open the studio')).toBeTruthy();
    await unconfirmed.unmount();
    // The database refuses it too.
    await expect(s().saveOrg({ ...seed(), name: 'Taken over' })).rejects.toThrow();
  });

  it('its page shows the logo, events, badge and creature; its artists carry its words', async () => {
    seed();
    const app = await renderApp(`/org/${ORG}`);
    await flush();
    expect(app.getAllByLabelText('Underground Alchemy').length).toBeGreaterThan(0);
    expect(app.getByText('After parties till sunrise.')).toBeTruthy();
    expect(app.getByText('Transmutation')).toBeTruthy();
    expect(app.getByText('Their badge')).toBeTruthy();
    expect(app.getByText('The Alchemist')).toBeTruthy();
    expect(app.queryByText('Open the organizer studio')).toBeNull();

    await act(async () => router.push('/artist/night-chemist'));
    await flush();
    expect(app.getByText('Deep, dark and hypnotic.')).toBeTruthy();
    expect(app.getByText('From Underground Alchemy')).toBeTruthy();
    await app.unmount();
  });

  it('anyone finds it by name in Search, Festivals and Find people, with its logo on its account', async () => {
    seed();
    const u = await s().signUp('ugrnd@example.com', 'password123');
    await s().saveProfile({ handle: 'undergroundalchemy', displayName: 'Underground Alchemy', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
    mockSocial.orgs.set(ORG, { ...mockSocial.orgs.get(ORG)!, uids: [u.uid], handle: 'undergroundalchemy' });
    await s().signOut();
    await s().signUp('fan@example.com', 'password123');
    await s().saveProfile({ handle: 'fan', displayName: 'Fan', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });

    const app = await renderApp('/search');
    await flush();
    // Any word of its name finds it (people search only by the start of a name).
    await fireEvent.changeText(app.getByLabelText('Search Afterglow'), 'alchemy');
    await settle(400);
    await flush();
    expect(app.getByText('Organizers')).toBeTruthy();
    await fireEvent.changeText(app.getByLabelText('Search Afterglow'), 'underground');
    await settle(400);
    await flush();
    // Its account, in People, wears its logo instead of a photo.
    expect(app.getByLabelText(/^Underground Alchemy, @undergroundalchemy/)).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Underground Alchemy, event organizer. Open their page'));
    await flush();
    expect(app.getByText('After parties till sunrise.')).toBeTruthy();

    // On the Festivals tab its name finds it and the events it hosts.
    await act(async () => router.push('/festivals'));
    await flush();
    await fireEvent.changeText(app.getByLabelText('Find an artist, festival or show'), 'underground');
    await flush();
    expect(app.getByLabelText('Underground Alchemy, event organizer. Open their page')).toBeTruthy();
    expect(app.getAllByText('Transmutation').length).toBeGreaterThan(0);

    // And in Find people.
    await act(async () => router.push('/people'));
    await flush();
    await fireEvent.changeText(app.getByLabelText('Search people'), 'undergr');
    await settle(400);
    await flush();
    expect(app.getAllByLabelText('Underground Alchemy, event organizer. Open their page').length).toBeGreaterThan(0);
    expect(app.getAllByLabelText('Underground Alchemy').length).toBeGreaterThan(0);
    await app.unmount();
  });

  it('videos its account posts carry its logo, faintly; everyone else’s don’t', async () => {
    seed();
    const u = await s().signUp('ugrnd@example.com', 'password123');
    await s().saveProfile({ handle: 'undergroundalchemy', displayName: 'Underground Alchemy', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
    mockSocial.orgs.set(ORG, { ...mockSocial.orgs.get(ORG)!, uids: [u.uid], handle: 'undergroundalchemy' });
    const ours = await s().shareMemory({ memoryId: 'm1', videoUri: 'file:///m1.mov', festivalId: EVENT, capturedAt: '2026-11-15T01:30:00.000Z', durationSec: 30, width: 1080, height: 1920 });
    await s().signOut();
    await s().signUp('fan@example.com', 'password123');
    await s().saveProfile({ handle: 'fan', displayName: 'Fan', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
    const theirs = await s().shareMemory({ memoryId: 'm2', videoUri: 'file:///m2.mov', festivalId: EVENT, capturedAt: '2026-11-15T02:00:00.000Z', durationSec: 30, width: 1080, height: 1920 });

    const app = await renderApp(`/shared/${ours.id}`);
    await flush();
    expect(app.getByTestId('org-watermark', { includeHiddenElements: true })).toBeTruthy();
    await act(async () => router.push(`/shared/${theirs.id}`));
    await flush();
    expect(app.queryAllByTestId('org-watermark', { includeHiddenElements: true })).toHaveLength(1);
    await app.unmount();
  });

  it('a promotion asked in the studio and approved in HQ shows, labelled, on everyone’s Festivals tab', async () => {
    seed();
    const app = await organizer();
    await showTab(app, 'Promote');
    await fireEvent.press(app.getByText('Send request'));
    await flush();
    const [req] = [...mockSocial.orgRequests.values()];
    expect(req).toMatchObject({ orgId: ORG, kind: 'promotion', eventId: 'transmutation-11-14', days: 7, status: 'open' });
    // An organizer can't promote itself.
    await expect(s().setPromotion(ORG, 'transmutation-11-14', '2026-11-14')).rejects.toThrow();
    await app.unmount();
    await s().signOut();

    mockSocial.verified.add(SUPPORT);
    await s().signUp(SUPPORT, 'password123');
    const hq = await renderApp('/');
    await flush();
    await showTab(hq, 'Organizers');
    await flush();
    answerAlerts('Promote');
    await fireEvent.press(hq.getByText('Approve'));
    await flush();
    expect(mockSocial.orgs.get(ORG)!.promoted).toEqual({ 'transmutation-11-14': '2026-10-12' });
    expect(mockSocial.orgRequests.get(req.id)).toMatchObject({ status: 'approved', reply: 'Promoted until 2026-10-12.' });
    await hq.unmount();
    await s().signOut();

    const fan = await renderApp('/festivals');
    await flush();
    expect(fan.getByText('Promoted')).toBeTruthy();
    expect(fan.getByLabelText(/^Promoted: Transmutation by Underground Alchemy/)).toBeTruthy();
    await fan.unmount();
  });

  it('a gift made in the studio is shared as a link, and opening it says who it’s from', async () => {
    seed();
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    const app = await organizer();
    await showTab(app, 'Collectibles');
    await fireEvent.press(app.getByText('Gifts'));
    await flush();
    await fireEvent.changeText(app.getByLabelText('Name'), 'Thank you for Transmutation');
    await fireEvent.changeText(app.getByLabelText('A few words'), 'See you at the next one.');
    await fireEvent.press(app.getByText('Make the gift and share its link'));
    await flush();
    const gift = [...mockSocial.stickers.values()].find((x) => x.gift)!;
    expect(gift).toMatchObject({ name: 'Thank you for Transmutation', creature: 'flask', orgId: ORG, note: 'See you at the next one.' });
    expect(share).toHaveBeenCalled();
    expect(JSON.stringify(share.mock.calls[0][0])).toContain(`/find/${gift.code}`);
    await app.unmount();
    await s().signOut();

    await s().signUp('fan@example.com', 'password123');
    const fan = await renderApp(`/find/${gift.code}?c=flask&n=Thank%20you`);
    await flush();
    expect(fan.getByText('A gift from Underground Alchemy')).toBeTruthy();
    expect(fan.getByText('“See you at the next one.”')).toBeTruthy();
    await fan.unmount();
    // The find counts for the organizer: a number, never who.
    await s().signOut();
    await s().signIn(TEST_LOGIN, 'password123');
    expect(await s().orgFinds(ORG)).toEqual({ [gift.code]: 1 });
  });
  it('HQ links an account from Accounts: its profile shows the organizer, and its studio opens with no email to confirm', async () => {
    const u = await s().signUp('ugrnd@example.com', 'password123');
    await s().saveProfile({ handle: 'ugrnd', displayName: 'Ugrnd', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
    await s().signOut();

    mockSocial.verified.add(SUPPORT);
    await s().signUp(SUPPORT, 'password123');
    const hq = await renderApp('/');
    await flush();
    await showTab(hq, 'Accounts');
    await fireEvent.changeText(hq.getByLabelText('Find someone by name or @handle'), 'ugrnd');
    await settle(400);
    await flush();
    await fireEvent.press(hq.getByLabelText(/^Ugrnd, @ugrnd\./));
    await fireEvent.press(hq.getByLabelText('Runs Underground Alchemy'));
    answerAlerts();
    await fireEvent.press(hq.getByText('Save privileges'));
    await flush();
    // Not set up yet: its page is made from its starter, with this account running it.
    expect(mockSocial.orgs.get(ORG)).toMatchObject({ name: 'Underground Alchemy', uids: [u.uid] });
    await hq.unmount();
    await s().signOut();

    await s().signIn('ugrnd@example.com', 'password123');
    // It opens on its studio, not the app (like HQ for the support account), with no email to confirm.
    const app = await renderApp('/');
    await flush();
    expect(app.getByRole('tab', { name: /^Events/ })).toBeTruthy();
    expect(app.queryByText('Confirm your email to open the studio')).toBeNull();
    expect(app.queryByLabelText('Back')).toBeNull();
    // Its profile takes the organizer's name and the @handle HQ chose.
    expect(mockSocial.profiles.get(u.uid)).toMatchObject({ displayName: 'Underground Alchemy', handle: 'undergroundalchemy' });

    // It can still look at the app, with a way back: no My Sound, and Discover is only what's posted at its events.
    await fireEvent.press(app.getByLabelText('View the app as everyone sees it'));
    await flush();
    expect(app.getByText('From your events')).toBeTruthy();
    expect(app.queryByRole('tab', { name: /^My Sound/ })).toBeNull();
    // The camera sits in the middle of its bar.
    expect(app.getByLabelText('Film a video')).toBeTruthy();
    await act(async () => router.push('/profile'));
    await flush();
    // Its profile is the organizer's: its logo, its DJs and videos instead of a fan's sound.
    expect(app.getByText('You run')).toBeTruthy();
    expect(app.getAllByLabelText('Underground Alchemy').length).toBeGreaterThan(0);
    expect(app.getByRole('tab', { name: /^DJs/ })).toBeTruthy();
    expect(app.queryByText('Your artists')).toBeNull();
    // Festivals shows only its own events, unless it asks for every festival.
    await act(async () => router.push('/festivals'));
    await flush();
    expect(app.getByText('Your events')).toBeTruthy();
    await fireEvent.press(app.getByText('See all festivals'));
    await flush();
    expect(app.getByText('Festivals & shows')).toBeTruthy();
    await fireEvent.press(app.getByText('← Only your events'));
    await flush();
    expect(app.getByText('Add or edit events')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Back to your studio'));
    await flush();
    expect(app.getByRole('tab', { name: /^Events/ })).toBeTruthy();

    // Messages: written in the studio, answered in HQ.
    await showTab(app, 'Messages');
    await fireEvent.changeText(app.getByLabelText('Your message'), 'Can we get a sticker for our Halloween night?');
    await fireEvent.press(app.getByText('Send'));
    await flush();
    const [msg] = [...mockSocial.orgRequests.values()];
    expect(msg).toMatchObject({ kind: 'other', text: 'Can we get a sticker for our Halloween night?', status: 'open' });
    expect(app.getByText('Can we get a sticker for our Halloween night?')).toBeTruthy();
    // It can edit its page, but never link anyone else.
    await expect(s().saveOrg({ ...mockSocial.orgs.get(ORG)!, about: 'Hello.' })).resolves.toBeUndefined();
    await expect(s().setOrgAccount(ORG, 'someone-else', true)).rejects.toThrow();
    await app.unmount();

    // Everyone else sees it on their profile too.
    await s().signOut();
    await s().signUp('fan@example.com', 'password123');
    await s().saveProfile({ handle: 'fan', displayName: 'Fan', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
    const fan = await renderApp('/u/undergroundalchemy');
    await flush();
    expect(fan.getByText('Runs')).toBeTruthy();
    expect(fan.getByText('See their events')).toBeTruthy();
    expect(fan.getByText('Their DJs')).toBeTruthy();
    // Who follows it, and whom it follows, are its own to see.
    expect(fan.queryByLabelText(/followers/i)).toBeNull();
    await act(async () => router.push({ pathname: '/follows/[handle]', params: { handle: 'undergroundalchemy' } }));
    await flush();
    expect(fan.getByText('@undergroundalchemy keeps who follows them private.')).toBeTruthy();
    await act(async () => router.push('/u/undergroundalchemy'));
    await flush();
    // Fans follow it.
    await fireEvent.press(fan.getByLabelText(/^Follow /));
    await flush();
    expect([...mockSocial.follows.values()].some((f) => f.to === u.uid)).toBe(true);
    await fan.unmount();
  });
  it('the organizer claims its events from EDMTrain, and copies one to edit on Afterglow without changing the import', async () => {
    seed();
    // What the nightly EDMTrain import gives (here, as an update the app reads).
    const file = {
      version: 1,
      festivals: [{ id: 'alchemy-fest-26', name: 'Alchemy Fest 2026', dates: 'Nov 20 to 21', start: '2026-11-20', end: '2026-11-21', location: 'The Vault, Orlando, FL', lineup: ['subtronics'], source: { name: 'EDMTrain', url: 'https://edmtrain.com/x' } }],
      shows: [{ id: 'edm-111', date: '2026-10-24', name: 'Underground Alchemy presents', venue: 'The Vault', location: 'Orlando, FL', link: 'https://edmtrain.com/e/111', artists: ['subtronics'] }],
    };
    mockSocial.patches.set('p1', { id: 'p1', title: 'EDMTrain', festivalId: 'alchemy-fest-26', file: JSON.stringify(file), by: 'uidHQ', publishedAt: '2026-10-01T00:00:00.000Z' });
    const app = await organizer();
    await showTab(app, 'Events');
    expect(app.getByText('These look like yours:')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Claim Underground Alchemy presents'));
    await flush();
    await fireEvent.press(app.getByLabelText('Claim Alchemy Fest 2026'));
    await flush();
    expect(mockSocial.orgs.get(ORG)!.claims).toEqual(['edm-111', 'alchemy-fest-26']);

    // Copy the festival, change it, publish: it shows in the import's place.
    await fireEvent.press(app.getByLabelText('Copy Alchemy Fest 2026 to edit on Afterglow'));
    expect(app.getByDisplayValue('Alchemy Fest 2026')).toBeTruthy();
    await fireEvent.changeText(app.getByLabelText('Name'), 'Alchemy Fest: the full night');
    await fireEvent.changeText(app.getByLabelText('Doors'), '21:00');
    answerAlerts('Publish');
    await fireEvent.press(app.getByText('Publish'));
    await flush();
    expect(mockSocial.orgs.get(ORG)!.events.find((e) => e.from === 'alchemy-fest-26')).toMatchObject({ name: 'Alchemy Fest: the full night', fromKind: 'festival', published: true });

    await act(async () => router.push('/festival/alchemy-fest-26'));
    await flush();
    expect(app.getAllByText('Alchemy Fest: the full night').length).toBeGreaterThan(0);
    expect(app.getByText('Doors 9:00 PM')).toBeTruthy();

    // The claimed show says who hosts it, and both list on its page.
    await act(async () => router.push('/show/edm-111'));
    await flush();
    expect(app.getByText('Hosted by')).toBeTruthy();
    expect(app.getByLabelText('Hosted by Underground Alchemy. Open their page')).toBeTruthy();
    await act(async () => router.push(`/org/${ORG}`));
    await flush();
    expect(app.getByText('Underground Alchemy presents')).toBeTruthy();
    expect(app.getAllByText('Alchemy Fest: the full night').length).toBeGreaterThan(0);
    // EDMTrain's own data is untouched.
    expect(mockSocial.patches.get('p1')!.file).toBe(JSON.stringify(file));
    await app.unmount();
  });
  it('the organizer changes its logo and icon in the studio, and can go back to the original', async () => {
    seed();
    const picker = jest.requireMock<{ launchImageLibraryAsync: jest.Mock }>('expo-image-picker');
    const app = await organizer();
    await showTab(app, 'Page');
    picker.launchImageLibraryAsync.mockImplementationOnce(async () => ({ canceled: false, assets: [{ uri: 'file:///new-logo.png', width: 1920, height: 600 }] }));
    await fireEvent.press(app.getByText('Change logo'));
    await flush();
    picker.launchImageLibraryAsync.mockImplementationOnce(async () => ({ canceled: false, assets: [{ uri: 'file:///new-icon.png', width: 600, height: 600 }] }));
    await fireEvent.press(app.getByText('Change icon'));
    await flush();
    expect(mockSocial.orgs.get(ORG)).toMatchObject({ logoUrl: expect.stringContaining('/logo-'), iconUrl: expect.stringContaining('/icon-') });
    answerAlerts('Go back');
    await fireEvent.press(app.getByText('Go back to the original logo and icon'));
    await flush();
    expect(mockSocial.orgs.get(ORG)!.logoUrl).toBeUndefined();
    expect(mockSocial.orgs.get(ORG)!.iconUrl).toBeUndefined();
    // Someone else can't.
    await app.unmount();
    await s().signOut();
    await s().signUp('someone@example.com', 'password123');
    await expect(s().setOrgImage(ORG, 'logo', 'file:///x.png')).rejects.toThrow();
  });
});
