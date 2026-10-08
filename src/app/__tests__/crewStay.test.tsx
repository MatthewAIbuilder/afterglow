import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { renderApp } from './appRoutes';

/** A crew finds a place to stay together: from its page, and from a stays card in its chat. */
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
const stayMap = (app: Awaited<ReturnType<typeof renderApp>>) => new URL((app.getByTestId('stay-map').props as { source: { uri: string } }).source.uri);

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 8, 12) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetGoers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('a place to stay for the crew', () => {
  it('the crew page finds places for all of them, and asks the crew in the chat with a card that opens them', async () => {
    await person('maya', 'Maya');
    const crew = await s().createCrew('edc-orlando-26', 'Sunrise gang');
    await s().signOut();
    for (const [h, n] of [['sam', 'Sam'], ['lee', 'Lee']]) {
      await person(h, n);
      await s().joinCrew(crew.id, mockSocial.codeOf(crew.id));
      await s().signOut();
    }
    const sam = await s().signIn('sam@example.com', 'password123');
    const app = await renderApp(`/crew/${crew.id}`);
    await flush();
    expect(app.getByText('Need a place to stay?')).toBeTruthy();
    expect(app.getByText('Places for all 3 of you near Tinker Field, for your nights there.')).toBeTruthy();

    await fireEvent.press(app.getByLabelText('Ask the crew in the chat'));
    await flush();
    const sent = [...mockSocial.chat.values()].filter((m) => m.uid === sam.uid).map((m) => m.text);
    expect(sent).toEqual(['Need a place to stay for EDC Orlando 2026? Places for all 3 of us:\nhttps://afterglowmusic.app/stay/edc-orlando-26?guests=3']);
    expect(app.getByText('Sent to the chat')).toBeTruthy();

    await fireEvent.press(app.getByLabelText('Find a place for all 3 of you near Tinker Field'));
    await flush();
    expect(app.getByText('Where to stay')).toBeTruthy();
    expect(app.getAllByText('EDC Orlando 2026').length).toBeGreaterThan(0);
    expect(app.getByText('Your crew of 3')).toBeTruthy();
    expect(stayMap(app).searchParams.get('adults')).toBe('3');
    await app.unmount();

    // In the chat, the message is a stays card that opens the same page.
    const chat = await renderApp(`/crew-chat/${crew.id}`);
    await flush();
    await fireEvent.press(chat.getByLabelText(/^Places to stay: EDC Orlando 2026, For 3 of you · near Tinker Field\. Open$/));
    await flush();
    expect(stayMap(chat).searchParams.get('adults')).toBe('3');
    await chat.unmount();
  });

  it('the stays page opens from its link alone, and says so when it has passed', async () => {
    const app = await renderApp('/stay/edc-orlando-26');
    await flush();
    expect(app.getByText(/^3 nights near Tinker Field/)).toBeTruthy();
    expect(stayMap(app).searchParams.has('adults')).toBe(false);
    await app.unmount();
    jest.setSystemTime(new Date(2026, 11, 1, 12));
    const later = await renderApp('/stay/edc-orlando-26?guests=4');
    await flush();
    expect(later.getByText('This has passed, so there’s nowhere to book any more.')).toBeTruthy();
    expect(later.queryByTestId('stay-map')).toBeNull();
    await later.unmount();
  });
});
