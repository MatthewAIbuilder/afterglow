import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ActionSheetIOS } from 'react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { renderApp } from './appRoutes';

/** Crew chats through the real routes, with the in-memory backend. */
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
  jest.useFakeTimers({ now: at(20) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetGoers();
  network.__setState({ isConnected: true, isInternetReachable: true });
});
afterEach(() => {
  network.__setState({ isConnected: true, isInternetReachable: true });
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** Maya's crew with Sam in it, and a message from Maya waiting for him. */
async function crewWithMessage() {
  const maya = await person('maya', 'Maya');
  const crew = await s().createCrew('solstice-26', 'Bass crew');
  await s().sendCrewMessages(crew.id, [{ id: 'm-maya-001', text: 'Meet at the big tree?', at: at(19, 58).toISOString() }]);
  await s().signOut();
  const sam = await person('sam', 'Sam');
  await s().joinCrew(crew.id, mockSocial.codeOf(crew.id));
  return { crew, maya, sam };
}

describe('crew chat', () => {
  it('the Friends tab lists your crew chats with what’s new, one tap from the chat', async () => {
    const { crew } = await crewWithMessage();
    const app = await renderApp('/friends');
    await flush();
    expect(app.getByText('Chats')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Bass crew crew chat, 1 new message. Maya: Meet at the big tree?'));
    await flush();
    expect(app.getByText('Only people in this crew can see this chat')).toBeTruthy();
    expect(app.getByLabelText(/^Maya, 7:58 PM: Meet at the big tree\?$/)).toBeTruthy();
    expect(crew.id).toBeTruthy();
  });

  it('the crew page shows the chat with a new message; the chat has the rules, the message, and yours', async () => {
    const { crew, sam } = await crewWithMessage();
    const app = await renderApp(`/crew/${crew.id}`);
    await flush();
    expect(app.getByLabelText('Crew chat, 1 new message. Maya: Meet at the big tree?')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Crew chat, 1 new message. Maya: Meet at the big tree?'));
    await flush();
    expect(app.getByText('Only people in this crew can see this chat')).toBeTruthy();
    expect(app.getByLabelText(/^Maya, 7:58 PM: Meet at the big tree\?$/)).toBeTruthy();
    // A quick message, then your own words.
    await fireEvent.press(app.getByLabelText('Send “On my way”'));
    await flush();
    await fireEvent.changeText(app.getByLabelText('Message your crew'), '  By the main stage bar  ');
    await fireEvent.press(app.getByLabelText('Send message'));
    await flush();
    const mine = [...mockSocial.chat.values()].filter((m) => m.uid === sam).map((m) => m.text);
    expect(mine).toEqual(['On my way', 'By the main stage bar']);
    expect(app.getByLabelText(/^You, 8:00 PM: By the main stage bar$/)).toBeTruthy();
    // Read now: back on the crew page, nothing new.
    await act(async () => router.back());
    await flush();
    expect(app.getByLabelText(/^Crew chat\. You: By the main stage bar$/)).toBeTruthy();
  });

  it('with no signal a message waits, keeps the time it was written, and sends itself later', async () => {
    const { crew, sam } = await crewWithMessage();
    mockSocial.network.down = true;
    network.__setState({ isConnected: false, isInternetReachable: false });
    const app = await renderApp(`/crew-chat/${crew.id}`);
    await flush();
    await fireEvent.changeText(app.getByLabelText('Message your crew'), 'Lost you, heading to the tree');
    await fireEvent.press(app.getByLabelText('Send message'));
    await flush();
    expect(app.getByLabelText(/^You, 8:00 PM: Lost you, heading to the tree\. Waiting for signal$/)).toBeTruthy();
    expect(app.getByLabelText('Waiting for signal. Your message sends by itself as soon as there’s a bar, still marked 8:00 PM.')).toBeTruthy();
    expect([...mockSocial.chat.values()].some((m) => m.uid === sam)).toBe(false);
    // Signal comes back 20 minutes later.
    jest.setSystemTime(at(20, 20));
    mockSocial.network.down = false;
    await act(async () => network.__setState({ isConnected: true, isInternetReachable: true }));
    await flush();
    const sent = [...mockSocial.chat.values()].find((m) => m.uid === sam);
    expect(sent?.text).toBe('Lost you, heading to the tree');
    // Marked when it was written, not when it got through, and you're told it was held up.
    expect(Math.abs(Date.parse(sent!.at) - at(20).getTime())).toBeLessThan(5000);
    expect(app.getByText('Your message reached the crew, held up 20 min by signal. The crew sees the time you wrote it.')).toBeTruthy();
    expect(app.queryByLabelText(/^Waiting for signal\./)).toBeNull();
  });

  it('your latest message says Delivered, then who has seen it; reading it tells the crew', async () => {
    const { crew, maya, sam } = await crewWithMessage();
    const app = await renderApp(`/crew-chat/${crew.id}`);
    await flush();
    // Opening the chat noted that Sam read it.
    expect(mockSocial.reads.has(`${crew.id}/${sam}`)).toBe(true);
    await fireEvent.press(app.getByLabelText('Send “On my way”'));
    await flush();
    expect(app.getByText('8:00 PM · Delivered')).toBeTruthy();
    await settle(1000);
    await act(async () => mockSocial.readAs(crew.id, maya));
    await flush();
    expect(app.getByText('8:00 PM · Seen by Maya')).toBeTruthy();
  });

  it('a crewmate’s message held up by signal sits at the time it was written, and the chat points it out', async () => {
    await person('maya', 'Maya');
    const crew = await s().createCrew('solstice-26', 'Bass crew');
    // Written at 7:30 PM with no signal; it only got through at 8:00 PM.
    await s().sendCrewMessages(crew.id, [{ id: 'm-maya-late', text: 'At the tree now', at: at(19, 30).toISOString() }]);
    await s().signOut();
    await person('sam', 'Sam');
    await s().joinCrew(crew.id, mockSocial.codeOf(crew.id));
    await s().sendCrewMessages(crew.id, [{ id: 'm-sam-early', text: 'Where is everyone?', at: at(19, 45).toISOString() }]);
    const app = await renderApp(`/crew-chat/${crew.id}`);
    await flush();
    expect(app.getByText('Maya’s message from 7:30 PM just got through, held up 30 min by signal. It’s up the chat at 7:30 PM.')).toBeTruthy();
    expect(app.getByText('Sent 7:30 PM · reached the crew 8:00 PM')).toBeTruthy();
    // In the order things were written: Maya's 7:30 PM before Sam's 7:45 PM.
    const order = app.queryAllByLabelText(/^(Maya|You), /).map((n) => n.props.accessibilityLabel as string);
    expect(order[0]).toMatch(/^Maya, 7:30 PM: At the tree now/);
    expect(order[1]).toMatch(/^You, 7:45 PM: Where is everyone\?/);
  });

  it('hold a message to report it or block who wrote it; the starter can remove anyone’s', async () => {
    const { crew } = await crewWithMessage();
    const sheets: string[][] = [];
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((o, cb) => {
      const list = o.options as string[];
      sheets.push(list);
      // The message's menu: Report; the reasons: Spam.
      cb(sheets.length === 1 ? list.indexOf('Report message') : list.indexOf('Spam or misleading'));
    });
    const app = await renderApp(`/crew-chat/${crew.id}`);
    await flush();
    await fireEvent(app.getByLabelText(/^Maya, 7:58 PM: Meet at the big tree\?$/), 'longPress');
    await flush();
    expect(sheets[0]).toEqual(['Report message', 'Block @maya', 'Cancel']);
    expect(mockSocial.reports.at(-1)).toMatchObject({ target: { kind: 'chat', id: `${crew.id}/m-maya-001` }, reason: 'spam' });
    await app.unmount();
    // As the crew's starter, Maya can remove Sam's message.
    await s().sendCrewMessages(crew.id, [{ id: 'm-sam-0001', text: 'hi', at: at(20).toISOString() }]);
    await s().signOut();
    await as('maya');
    await s().deleteCrewMessage(crew.id, 'm-sam-0001');
    expect(mockSocial.chat.has(`${crew.id}/m-sam-0001`)).toBe(false);
  });

  it('only people in the crew can read it; leaving takes your messages', async () => {
    const { crew } = await crewWithMessage();
    await s().sendCrewMessages(crew.id, [{ id: 'm-sam-0002', text: 'See you there', at: at(20).toISOString() }]);
    await s().leaveCrew(crew.id);
    expect(mockSocial.chat.has(`${crew.id}/m-sam-0002`)).toBe(false);
    expect(mockSocial.chat.has(`${crew.id}/m-maya-001`)).toBe(true);
    await expect(s().sendCrewMessages(crew.id, [{ id: 'm-sam-0003', text: 'hello?', at: at(20).toISOString() }])).rejects.toThrow();
    const app = await renderApp(`/crew-chat/${crew.id}`);
    await flush();
    expect(app.getByText('Only people in this crew can read its chat.')).toBeTruthy();
    expect(app.queryByLabelText('Message your crew')).toBeNull();
  });
});
