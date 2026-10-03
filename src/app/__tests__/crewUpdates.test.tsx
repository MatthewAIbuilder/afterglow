import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { ActionSheetIOS, Alert } from 'react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { renderApp } from './appRoutes';

/** Crew updates through the real routes, with the in-memory backend and a festival afternoon's clock. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const network = jest.requireMock<{ __setState: (s: { isConnected?: boolean; isInternetReachable?: boolean }) => void }>('expo-network');
const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i++) await settle();
};
const s = () => mockSocial.service;
async function person(handle: string, name: string) {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: name, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
}
const as = (handle: string) => s().signIn(`${handle}@example.com`, 'password123');
const at = (h: number, m = 0) => new Date(2026, 10, 7, h, m);

beforeEach(async () => {
  jest.useFakeTimers({ now: at(12) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetGoers();
  network.__setState({ isConnected: true, isInternetReachable: true });
});
afterEach(() => {
  network.__setState({ isConnected: true, isInternetReachable: true });
});

/** Maya and Sam in a crew; Maya's 4:05 PM check-in got through at once, her 3:00 PM video only at 5:00 PM. */
async function crewWithNews() {
  await person('maya', 'Maya');
  const crew = await s().createCrew('solstice-26', 'Bass crew');
  jest.setSystemTime(at(16, 5));
  await s().postCrewUpdate(crew.id, { id: 'u-checkin1', kind: 'checkin', at: at(16, 5).toISOString(), festivalId: 'solstice-26', stage: 'Main Stage', artistId: 'illenium', note: 'Meet at our spot' });
  jest.setSystemTime(at(17));
  await s().postCrewUpdate(crew.id, { id: 'u-video01', kind: 'video', at: at(15).toISOString(), festivalId: 'solstice-26', videoUrl: 'https://files.example/maya.mp4' });
  await s().signOut();
  await person('sam', 'Sam');
  await s().joinCrew(crew.id, mockSocial.codeOf(crew.id));
  jest.setSystemTime(at(17, 30));
  return crew;
}

describe('crew updates', () => {
  it('shows your crew along the top of Discover, newest by when it happened, and says when signal held one back', async () => {
    await crewWithNews();
    const app = await renderApp('/');
    await flush();
    await fireEvent.press(app.getByLabelText(/^Maya, updated 4:05 PM, Main Stage · ILLENIUM, “Meet at our spot”\. New$/));
    await flush();
    // Her latest first: the check-in, though the earlier video reached the crew after it.
    expect(app.getByText('Meet at our spot')).toBeTruthy();
    expect(app.getByText('Updated 4:05 PM · Main Stage · ILLENIUM')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Earlier update'));
    await flush();
    expect(app.getByText('Updated 3:00 PM')).toBeTruthy();
    expect(app.getByText('Sent 3:00 PM, reached the crew 5:00 PM')).toBeTruthy();
    // Past her last update, the story closes; she no longer glows.
    await fireEvent.press(app.getByLabelText('Earlier update'));
    await flush();
    expect(app.getByLabelText(/^Maya, updated 4:05 PM, .*”$/)).toBeTruthy();
  });

  it('a check-in with no signal waits on the phone and sends itself later, still marked when you tapped', async () => {
    const crew = await crewWithNews();
    await as('sam');
    const app = await renderApp('/');
    await flush();
    network.__setState({ isConnected: false, isInternetReachable: false });
    mockSocial.network.down = true;
    await fireEvent.press(app.getByLabelText('Check in with your crew'));
    await flush();
    await fireEvent.press(app.getByLabelText('Send “Getting water” to your crew'));
    await flush();
    expect(app.getByText('Saved for when there’s signal')).toBeTruthy();
    expect(app.getByText(/still marked 5:30 PM/)).toBeTruthy();
    await fireEvent.press(app.getByText('Done'));
    await flush();
    expect(app.getByLabelText(/^Check in with your crew\. 1 update is waiting for signal$/)).toBeTruthy();
    expect([...mockSocial.updates.values()].filter((u) => u.note === 'Getting water')).toHaveLength(0);

    // Signal comes back an hour later: it goes up, marked 5:30 PM, not 6:30.
    jest.setSystemTime(at(18, 30));
    mockSocial.network.down = false;
    network.__setState({ isConnected: true, isInternetReachable: true });
    await settle(130_000);
    await flush();
    const sent = [...mockSocial.updates.values()].find((u) => u.note === 'Getting water');
    expect(sent).toMatchObject({ crewId: crew.id, sentAt: at(18, 30).toISOString() });
    // Marked with the moment it was tapped (the test clock had moved a second or so).
    expect(Math.abs(Date.parse(sent!.at) - at(17, 30).getTime())).toBeLessThan(5000);
    expect(app.getByLabelText('Check in with your crew')).toBeTruthy();
  });

  it('a check-in only says sent once it has really reached the crew', async () => {
    await crewWithNews();
    await as('sam');
    const app = await renderApp('/');
    await flush();
    // Bars on the phone, but nothing getting through.
    mockSocial.network.down = true;
    await fireEvent.press(app.getByLabelText('Check in with your crew'));
    await flush();
    await fireEvent.press(app.getByLabelText('Send “I’m here” to your crew'));
    await flush();
    expect(app.getByText('Sending…')).toBeTruthy();
    expect(app.queryByText('Sent to your crew')).toBeNull();
    mockSocial.network.down = false;
    await settle(20_000);
    await flush();
    expect(app.getByText('Sent to your crew')).toBeTruthy();
  });

  it('a crew that refuses a check-in never costs the other crew it; and refused everywhere, it says so', async () => {
    const crew = await crewWithNews();
    const own = await s().createCrew('solstice-26', 'Second crew');
    const samUid = mockSocial.currentUser()!.uid;
    const app = await renderApp('/');
    await flush();
    // The second crew stops taking anything from Sam (it ended), though the phone hasn't heard yet.
    mockSocial.crews.delete(own.id);
    await fireEvent.press(app.getByLabelText('Check in with your crew'));
    await flush();
    await fireEvent.press(app.getByLabelText('Send “Getting water” to your crew'));
    await flush();
    expect([...mockSocial.updates.values()].filter((u) => u.note === 'Getting water').map((u) => u.crewId)).toEqual([crew.id]);
    for (let i = 0; i < 4; i++) await settle(130_000);
    await flush();
    expect(app.getByText('Sent to your crew')).toBeTruthy();
    await fireEvent.press(app.getByText('Done'));
    await flush();

    // Now the first crew refuses too: nobody can take it, and the screen doesn't pretend.
    mockSocial.crews.set(crew.id, { ...mockSocial.crews.get(crew.id)!, members: mockSocial.crews.get(crew.id)!.members.filter((m) => m !== samUid) });
    await fireEvent.press(app.getByLabelText('Check in with your crew'));
    await flush();
    await fireEvent.press(app.getByLabelText('Send “Heading out” to your crew'));
    await flush();
    expect(app.getByText('Sending…')).toBeTruthy();
    for (let i = 0; i < 4; i++) await settle(130_000);
    await flush();
    expect(app.getByText('Couldn’t reach your crew')).toBeTruthy();
  });

  it('the crew page shows where everyone last was', async () => {
    const crew = await crewWithNews();
    const app = await renderApp(`/crew/${crew.id}`);
    await flush();
    expect(app.getByText('Latest from the crew')).toBeTruthy();
    expect(app.getByText('Updated 4:05 PM · Main Stage · ILLENIUM · “Meet at our spot”')).toBeTruthy();
    expect(app.getByText('No updates yet')).toBeTruthy();
  });

  it('reply to a crewmate from their story; it reaches them as news, and shows on the crew page', async () => {
    const crew = await crewWithNews();
    await as('sam');
    const app = await renderApp('/');
    await flush();
    await fireEvent.press(app.getByLabelText(/^Maya, updated 4:05 PM/));
    await flush();
    await fireEvent.press(app.getByLabelText('Reply “On my way” to Maya'));
    await flush();
    const sent = [...mockSocial.updates.values()].find((u) => u.kind === 'reply');
    expect(sent).toMatchObject({ crewId: crew.id, replyTo: 'u-checkin1', note: 'On my way' });
    expect(app.getByLabelText(/^You, 5:30 PM: On my way$/)).toBeTruthy();
    await app.unmount();

    // Maya sees Sam's answer as news, and under her latest on the crew page.
    await s().signOut();
    await as('maya');
    const hers = await renderApp('/');
    await flush();
    expect(hers.getByLabelText(/^Sam, replied to you 5:30 PM, “On my way”\. New$/)).toBeTruthy();
    await hers.unmount();
    const page = await renderApp(`/crew/${crew.id}`);
    await flush();
    expect(page.getByText('1 reply · Sam: On my way')).toBeTruthy();
  });

  it('a reply the crew can no longer take never holds up the updates after it', async () => {
    const crew = await crewWithNews();
    await as('sam');
    const app = await renderApp('/');
    await flush();
    network.__setState({ isConnected: false, isInternetReachable: false });
    mockSocial.network.down = true;
    await fireEvent.press(app.getByLabelText(/^Maya, updated 4:05 PM/));
    await flush();
    await fireEvent.press(app.getByLabelText('Reply “Be there in 10” to Maya'));
    await flush();
    await fireEvent.press(app.getByLabelText('Close'));
    await flush();
    await fireEvent.press(app.getByLabelText(/^Check in with your crew\. 1 update is waiting for signal$/));
    await flush();
    await fireEvent.press(app.getByLabelText('Send “Getting water” to your crew'));
    await flush();
    await fireEvent.press(app.getByText('Done'));
    await flush();
    // Meanwhile Maya took her check-in back, so the reply has nothing to answer.
    mockSocial.updates.delete(`${crew.id}/u-checkin1`);
    mockSocial.network.down = false;
    network.__setState({ isConnected: true, isInternetReachable: true });
    await flush();
    expect([...mockSocial.updates.values()].some((u) => u.note === 'Getting water')).toBe(true);
    // The refused reply is tried a few times, then let go.
    for (let i = 0; i < 4; i++) await settle(130_000);
    await flush();
    expect(app.getByLabelText('Check in with your crew')).toBeTruthy();
    expect([...mockSocial.updates.values()].some((u) => u.kind === 'reply')).toBe(false);
  });

  it('once you are out of a crew, your crew-only videos there come out of storage', async () => {
    const crew = await crewWithNews();
    const other = await s().createCrew('solstice-26', 'Second crew'); // Sam's own, still in it
    const samUid = mockSocial.currentUser()!.uid;
    mockSocial.crewFiles.add(`${crew.id}/${samUid}/u-video77`);
    mockSocial.crewFiles.add(`${other.id}/${samUid}/u-video88`);
    await AsyncStorage.setItem('crewVideos.v1', JSON.stringify({ [crew.id]: ['u-video77'], [other.id]: ['u-video88'] }));
    // Maya, the owner, takes Sam out of the first crew.
    await s().signOut();
    await as('maya');
    await s().removeFromCrew(crew.id, samUid);
    await s().signOut();
    await as('sam');
    await renderApp('/');
    await flush();
    expect([...mockSocial.crewFiles]).toEqual([`${other.id}/${samUid}/u-video88`]);
    expect(JSON.parse((await AsyncStorage.getItem('crewVideos.v1'))!)).toEqual({ [other.id]: ['u-video88'] });
  });

  it('a meeting spot any member can set, and “Can’t find you” pointing at it', async () => {
    const crew = await crewWithNews();
    await as('sam');
    const page = await renderApp(`/crew/${crew.id}`);
    await flush();
    await fireEvent.press(page.getByLabelText('Pick a meeting spot for your crew'));
    await fireEvent.changeText(page.getByLabelText('Meeting spot'), 'By the big tree left of Main Stage');
    await fireEvent.press(page.getByLabelText('Save the meeting spot'));
    await flush();
    expect(mockSocial.meets.get(crew.id)).toMatchObject({ text: 'By the big tree left of Main Stage' });
    expect(page.getByLabelText(/^Meeting spot: By the big tree left of Main Stage\. Set by you\. Change it$/)).toBeTruthy();
    await page.unmount();

    const app = await renderApp('/check-in');
    await flush();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === 'Send')?.onPress?.());
    await fireEvent.press(app.getByLabelText('Can’t find my crew. Tell them'));
    await flush();
    alert.mockRestore();
    const lost = [...mockSocial.updates.values()].find((u) => u.lost);
    expect(lost).toMatchObject({ kind: 'checkin', note: 'Can’t find you. Heading to By the big tree left of Main Stage' });
    expect(app.getByText('Sent to your crew')).toBeTruthy();
    await app.unmount();

    // Maya sees it at the front of her stories.
    await s().signOut();
    await as('maya');
    const hers = await renderApp('/');
    await flush();
    expect(hers.getByLabelText(/^Sam, can’t find the crew, 5:30 PM, “Can’t find you\. Heading to By the big tree left of Main Stage”\. New$/)).toBeTruthy();
  });

  it('sends a photo to the crew only, and it shows in their story', async () => {
    const crew = await crewWithNews();
    await as('sam');
    const picker = jest.requireMock<{ launchImageLibraryAsync: jest.Mock }>('expo-image-picker');
    picker.launchImageLibraryAsync.mockImplementationOnce(async () => ({ canceled: false, assets: [{ uri: 'file:///crowd.jpg', width: 1200, height: 900 }] }));
    const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((o, pick) => pick(o.options.indexOf('Choose from Photos')));
    const app = await renderApp('/check-in');
    await flush();
    await fireEvent.press(app.getByLabelText('Add a photo for your crew'));
    await flush();
    sheet.mockRestore();
    expect(app.getByLabelText('Your photo for the crew')).toBeTruthy();
    await fireEvent.changeText(app.getByLabelText('Your own words for your crew'), 'Look at this crowd');
    await fireEvent.press(app.getByLabelText('Send the photo to your crew'));
    await flush();
    const photo = [...mockSocial.updates.values()].find((u) => u.kind === 'photo');
    expect(photo).toMatchObject({ crewId: crew.id, note: 'Look at this crowd', thumbUrl: expect.stringContaining('https://'), width: 1200, height: 900 });
    // Never on Discover or a profile.
    expect([...mockSocial.memories.values()]).toHaveLength(0);
    await app.unmount();

    await s().signOut();
    await as('maya');
    const hers = await renderApp(`/crew-story?uid=${photo!.uid}`);
    await flush();
    expect(hers.getByLabelText('Photo from Sam: Look at this crowd')).toBeTruthy();
    expect(hers.getAllByText(/^Photo 5:30 PM/).length).toBeGreaterThan(0);
  });

  it('nobody sees updates from a crew they are not in', async () => {
    const crew = await crewWithNews();
    await s().signOut();
    await person('stranger', 'Stranger');
    await expect(s().crewUpdates(crew.id, 0, 10)).rejects.toThrow();
    await expect(s().postCrewUpdate(crew.id, { id: 'u-sneaky1', kind: 'checkin', at: at(17).toISOString(), festivalId: 'solstice-26' })).rejects.toThrow();
    await expect(s().postCrewUpdate(crew.id, { id: 'u-sneaky2', kind: 'reply', at: at(17).toISOString(), festivalId: 'solstice-26', replyTo: 'u-checkin1', note: 'hi' })).rejects.toThrow();
  });
});
