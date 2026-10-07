import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

/** A collectible card someone shared: its page shows the card as they have it, and how to earn your own. */
const flush = async () => {
  for (let i = 0; i < 10; i++)
    await act(async () => {
      jest.advanceTimersByTime(50);
      await Promise.resolve();
    });
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 7, 20, 0) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
});

describe('shared collectible cards', () => {
  it('shows their card, shiny and silver, and how to earn your own', async () => {
    const app = await renderApp('/card/hedex?h=maya&t=2&v=7&s=1');
    await flush();
    expect(app.getByText('@maya’s collectible')).toBeTruthy();
    expect(app.getByText('Shiny')).toBeTruthy();
    expect(app.getByText('Where HEDEX plays')).toBeTruthy();
    // It turns over to how far they've come.
    await fireEvent.press(app.getByText('Turn it over'));
    await flush();
    expect(app.getByLabelText(/^7 videos of HEDEX\./)).toBeTruthy();
    await app.unmount();
  });
  it('a link to an artist Afterglow doesn’t have says so', async () => {
    const app = await renderApp('/card/nobody-at-all?h=maya');
    await flush();
    expect(app.getByText('Card not found')).toBeTruthy();
    await app.unmount();
  });
});

describe('your collection', () => {
  it('opens from the garden and shows every set with what’s still out there', async () => {
    const app = await renderApp('/garden');
    await flush();
    await fireEvent.press(app.getByLabelText('Your collection: every set, and what’s still out there'));
    await flush();
    expect(app.getAllByText('Your collection').length).toBeGreaterThan(0);
    for (const set of ['Sprout kinds', 'Hand-made collectibles', 'Sound creatures', 'Stickers', 'Kandi beads', 'Kandi charms', 'Garden decorations']) expect(app.getByText(set)).toBeTruthy();
    expect(app.getByText('Film these artists’ sets')).toBeTruthy();
    await app.unmount();
  }, 20000);

  it('goes out as a picture: the ring, a bar per set, and what you’ve found', async () => {
    // Someone gives Maya kandi, so there's something in her collection.
    const s = mockSocial.service;
    const maya = (await s.signUp('maya@example.com', 'password123')).uid;
    await s.saveProfile({ handle: 'maya', displayName: 'Maya', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
    await s.signOut();
    await s.signUp('sam@example.com', 'password123');
    await s.saveProfile({ handle: 'sam', displayName: 'Sam', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
    await s.giveKandi({ to: maya, word: 'HI', beads: 'galaxy', charm: 'alien' });
    await s.signOut();
    await s.signIn('maya@example.com', 'password123');
    // Maya last looked before the kandi came: its beads and charm are new.
    await AsyncStorage.setItem('collectionSeen.v1', JSON.stringify({ [maya]: [] }));
    const app = await renderApp('/collection');
    await flush();
    await flush();
    await flush();
    expect(app.getByText('2 new since you last looked')).toBeTruthy();
    expect(app.getAllByText('New').length).toBe(2);
    await fireEvent.press(app.getByLabelText('Share your collection as a picture'));
    await flush();
    expect(app.getByText('@maya’s collection')).toBeTruthy();
    expect(app.getByText(/^\d+ of \d+ found$/)).toBeTruthy();
    const Sharing = jest.requireMock<{ shareAsync: jest.Mock }>('expo-sharing');
    Sharing.shareAsync.mockClear();
    await fireEvent.press(app.getByLabelText('Share this picture'));
    await flush();
    expect(Sharing.shareAsync).toHaveBeenCalled();
    await fireEvent.press(app.getAllByLabelText('Close').at(-1)!);
    await flush();
    // One you have opens big; one you don't is just a silhouette.
    await fireEvent.press(app.getByLabelText('Galaxy'));
    await flush();
    expect(app.getByText('Galaxy beads')).toBeTruthy();
    await fireEvent.press(app.getByText('Done'));
    await flush();
    expect(app.queryByText('Galaxy beads')).toBeNull();
    await app.unmount();
    // Once looked at, they aren't new any more.
    const again = await renderApp('/collection');
    await flush();
    await flush();
    expect(again.queryByText('2 new since you last looked')).toBeNull();
    await again.unmount();
  }, 30000);
});
