import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { renderApp } from './appRoutes';

/** 1-to-1 messages between friends, through the real routes, with the in-memory backend. */
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

describe('1-to-1 messages', () => {
  it('Message on a friend’s profile opens a chat only the two of you see; they get it in Messages', async () => {
    const { maya, sam } = await friends();
    const app = await renderApp('/u/maya');
    await flush();
    await fireEvent.press(app.getByLabelText('Message Maya Lin'));
    await flush();
    expect(app.getByText('Only you and Maya can see this chat')).toBeTruthy();
    await fireEvent.changeText(app.getByLabelText('Message Maya'), 'Same stage tonight?');
    await fireEvent.press(app.getByLabelText('Send message'));
    await flush();
    const sent = [...mockSocial.chat.values()].filter((m) => m.uid === sam).map((m) => m.text);
    expect(sent).toEqual(['Same stage tonight?']);
    expect(mockSocial.dms.size).toBe(1);
    expect([...mockSocial.dms.values()][0].members).toEqual([maya, sam].sort());

    // Maya sees it on Friends, new, and opening it reads it.
    await act(async () => router.replace('/friends'));
    await flush();
    await act(async () => {
      await s().signOut();
      await as('maya');
    });
    await act(async () => router.push('/friends'));
    await flush();
    expect(app.getByText('Messages')).toBeTruthy();
    const row = app.getByLabelText(/^Sam, 1 new message\. Sam: Same stage tonight\?$/);
    await fireEvent.press(row);
    await flush();
    expect(app.getByText('Only you and Sam can see this chat')).toBeTruthy();
    expect(app.getByLabelText(/^Sam, 8:00 PM: Same stage tonight\?$/)).toBeTruthy();
  });

  it('not someone who doesn’t follow you back, and not once they’ve blocked you', async () => {
    const maya = await person('maya', 'Maya Lin');
    await s().signOut();
    await person('sam', 'Sam');
    await s().follow(maya);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const app = await renderApp('/u/maya');
    await flush();
    await fireEvent.press(app.getByLabelText('Message Maya Lin'));
    await flush();
    expect(alert).toHaveBeenCalledWith('You can’t message Maya yet', expect.stringMatching(/follow you back/));
    expect(mockSocial.dms.size).toBe(0);
    await app.unmount();

    // Friends both ways, then Maya blocks Sam: his message is refused.
    const sam = mockSocial.currentUser()!.uid;
    await s().signOut();
    await as('maya');
    await s().follow(sam);
    await s().signOut();
    await as('sam');
    const room = await s().openDirectChat(maya);
    await s().signOut();
    await as('maya');
    await s().setBlocked(sam, true);
    await s().signOut();
    await as('sam');
    await expect(s().sendCrewMessages(room, [{ id: 'm-sam-001', text: 'Hey', at: new Date().toISOString() }])).rejects.toBeTruthy();
  });
});
