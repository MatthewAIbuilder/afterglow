import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Share } from 'react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { renderApp } from './appRoutes';

/** Sending things from the app into chats, through the real routes, with the in-memory backend. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

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

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 4, 20) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetGoers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** Maya and Sam follow each other; Sam is signed in. */
async function friends() {
  const maya = await person('maya', 'Maya Lin');
  await s().signOut();
  const sam = await person('sam', 'Sam');
  await s().follow(maya);
  await s().signOut();
  await as('maya');
  await s().follow(sam);
  await s().signOut();
  await as('sam');
  return { maya, sam };
}

describe('send into a chat', () => {
  it('a festival from its page goes to a friend’s chat as a card; they open it from there', async () => {
    const { sam } = await friends();
    const app = await renderApp('/festival/edc-orlando-26');
    await flush();
    await fireEvent.press(app.getByLabelText('Share EDC Orlando 2026'));
    await flush();
    expect(app.getByText('Send to')).toBeTruthy();
    expect(app.getByLabelText(/^Festival: EDC Orlando 2026/)).toBeTruthy();
    await fireEvent.changeText(app.getByLabelText('Add a message'), 'We going?');
    await fireEvent.press(app.getByLabelText('Send to Maya Lin'));
    await flush();
    expect(app.getByLabelText('Sent to Maya Lin')).toBeTruthy();
    const sent = [...mockSocial.chat.values()].filter((m) => m.uid === sam).map((m) => m.text);
    expect(sent).toEqual(['We going?\nhttps://afterglowmusic.app/festival/edc-orlando-26']);

    // Other apps are still one tap away.
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await fireEvent.press(app.getByLabelText('More ways to share'));
    await flush();
    expect((share.mock.calls[0][0] as { message: string }).message).toContain('https://afterglowmusic.app/festival/edc-orlando-26');

    // Maya sees what it is, not a link, and opens the festival from the card.
    await act(async () => router.replace('/friends'));
    await flush();
    await act(async () => {
      await s().signOut();
      await as('maya');
    });
    await flush();
    await fireEvent.press(app.getByLabelText(/^Sam, 1 new message\. Sam: We going\?$/));
    await flush();
    expect(app.getByLabelText(/^Sam, 8:00 PM: We going\?\. Sent a festival$/)).toBeTruthy();
    await fireEvent.press(app.getByLabelText(/^Festival: EDC Orlando 2026.*\. Open$/));
    await flush();
    expect(app.getAllByText('EDC Orlando 2026').length).toBeGreaterThan(0);
    expect(app.queryByText('Only you and Sam can see this chat')).toBeNull();
  });

  it('an artist goes to your crew too; without words the preview says what was sent', async () => {
    await friends();
    const crew = await s().createCrew('edc-orlando-26', 'Bass crew');
    const app = await renderApp('/artist/subtronics');
    await flush();
    await fireEvent.press(app.getByLabelText('Share SUBTRONICS'));
    await flush();
    await fireEvent.press(app.getByLabelText('Send to Bass crew'));
    await flush();
    expect(app.getByLabelText('Sent to Bass crew')).toBeTruthy();
    expect([...mockSocial.chat.values()].map((m) => m.text)).toEqual(['https://afterglowmusic.app/artist/subtronics']);
    await act(async () => router.replace(`/crew/${crew.id}`));
    await flush();
    expect(app.getByLabelText(/^Crew chat\. You: Sent an artist$/)).toBeTruthy();
  });

  it('signed out, sharing goes straight to other apps', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const app = await renderApp('/artist/subtronics');
    await flush();
    await fireEvent.press(app.getByLabelText('Share SUBTRONICS'));
    await flush();
    expect(share).toHaveBeenCalled();
    expect(app.queryByText('Send to')).toBeNull();
  });
});
