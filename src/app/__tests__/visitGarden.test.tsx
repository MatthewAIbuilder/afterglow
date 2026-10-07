import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/** Visiting someone's garden from their profile, and your own garden shown on yours (or not). */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (n = 10) => {
  for (let i = 0; i < n; i++) await settle();
};
const s = () => mockSocial.service;
const person = async (handle: string, name: string) => {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: name, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 3, 20, 0) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
});

describe('gardens', () => {
  it('a friend’s garden opens from their profile, and a tap makes one dance', async () => {
    const maya = await person('maya', 'Maya Lin');
    await s().publishGarden([
      { k: 's', kind: 'plur', stage: 3 },
      { k: 's', kind: 'seedling', stage: 1 },
      { k: 'a', artistId: 'subtronics', name: 'SUBTRONICS', tier: 1 },
    ]);
    await s().signOut();
    await person('sam', 'Sam');
    const app = await renderApp('/u/maya');
    await flush();
    expect(app.getByText('Maya’s garden')).toBeTruthy();
    expect(app.getByText('3 living there · Visit')).toBeTruthy();
    await fireEvent.press(app.getByTestId('visit-garden'));
    await flush();
    expect(app.getByText('@maya’s garden')).toBeTruthy();
    expect(app.getByText('2 sprouts and 1 artist collectible. Tap one to make it dance.')).toBeTruthy();
    expect(app.queryByText(/In their sky/)).toBeNull();
    // Nothing to move; a tap dances (and opens nothing).
    await fireEvent.press(app.getByLabelText('PLUR sprout, In bloom.'));
    await settle(1000);
    expect(app.getByText('@maya’s garden')).toBeTruthy();
    expect(maya).toBeTruthy();
  });

  it('your garden shows on your profile by itself, and comes down when you hide it', async () => {
    const me = await person('sam', 'Sam');
    const app = await renderApp('/garden');
    await flush();
    await settle(4500);
    await flush();
    expect(mockSocial.gardens.get(me)?.residents.length).toBeGreaterThan(0);
    await fireEvent(app.getByLabelText('Show my garden on my profile'), 'valueChange', false);
    await flush();
    await settle(4500);
    await flush();
    expect(mockSocial.gardens.has(me)).toBe(false);
    await act(async () => router.push('/u/sam'));
    await flush();
    expect(app.queryByTestId('visit-garden')).toBeNull();
    expect(app.getByText('Hidden from your profile. Open your garden to show it.')).toBeTruthy();
  });

  it('a friend who hasn’t shared a garden yet still shows where it will be, and why it isn’t there', async () => {
    await person('maya', 'Maya Lin');
    await s().signOut();
    await person('sam', 'Sam');
    const app = await renderApp('/u/maya');
    await flush();
    expect(app.queryByTestId('visit-garden')).toBeNull();
    expect(app.getByTestId('garden-not-shared')).toBeTruthy();
    expect(app.getByText('Not shared yet. It shows here once Maya opens the latest Afterglow with something growing.')).toBeTruthy();
    expect(app.getByText('Make kandi for Maya')).toBeTruthy();
  });

  it('Make kandi from your garden: pick a friend you follow, then make theirs', async () => {
    const maya = await person('maya', 'Maya Lin');
    await s().signOut();
    await person('sam', 'Sam');
    await s().follow(maya);
    const app = await renderApp('/garden');
    await flush();
    await fireEvent.press(app.getByLabelText('Make kandi for a friend'));
    await flush();
    expect(app.getByText('Who’s it for?')).toBeTruthy();
    await fireEvent.press(app.getByTestId('kandi-for-maya'));
    await flush();
    expect(app.getByText('Kandi for Maya')).toBeTruthy();
    expect(app.getByText('Leave it in Maya’s garden')).toBeTruthy();
  });

  it('kandi for anyone: search for them by name', async () => {
    await person('maya', 'Maya Lin');
    await s().signOut();
    await person('sam', 'Sam');
    const app = await renderApp('/kandi-make');
    await flush();
    await fireEvent.changeText(app.getByLabelText('Search for someone to make kandi for'), 'may');
    await settle(400);
    await flush();
    await fireEvent.press(app.getByTestId('kandi-for-maya'));
    await flush();
    expect(app.getByText('Kandi for Maya')).toBeTruthy();
  });

  it('kandi given by code: a QR anyone scans, and the first to pick it up gets it, note and all', async () => {
    const maya = await person('maya', 'Maya Lin');
    await s().signOut();
    const sam = await person('sam', 'Sam');
    const app = await renderApp('/kandi-make');
    await flush();
    await fireEvent.press(app.getByTestId('kandi-by-code'));
    await flush();
    expect(app.getByText('Kandi to give in person')).toBeTruthy();
    await fireEvent.changeText(app.getByLabelText('A note with your kandi'), 'Found you at the rail');
    await fireEvent.press(app.getByText('Make the code'));
    await flush();
    expect(app.getByText('Show them this code')).toBeTruthy();
    await settle(1000);
    await flush();
    const made = [...mockSocial.kandi.values()].find((k) => k.from === sam);
    expect(made?.to).toBe('');
    await app.unmount();

    // Maya scans it.
    await s().signOut();
    await s().signIn('maya@example.com', 'password123');
    const hers = await renderApp(`/kandi/${made!.id}?u=${sam}&h=sam&w=PLUR&b=rainbow`);
    await flush();
    await fireEvent.press(hers.getByText('Put it in my garden'));
    await flush();
    expect(hers.getByText('It’s in your garden')).toBeTruthy();
    expect(hers.getByText('“Found you at the rail”')).toBeTruthy();
    expect(mockSocial.kandi.get(made!.id)?.to).toBe(maya);
    await hers.unmount();

    // Too late for anyone else.
    await s().signOut();
    await person('kim', 'Kim');
    const late = await renderApp(`/kandi/${made!.id}?u=${sam}&h=sam&w=PLUR&b=rainbow`);
    await flush();
    expect(late.queryByText('Put it in my garden')).toBeNull();
    expect(late.getByText(/isn’t on Afterglow yet, or it was taken back/)).toBeTruthy();
  });

  it('kandi with a charm and galaxy beads, and making one back from your garden', async () => {
    const maya = await person('maya', 'Maya Lin');
    await s().signOut();
    const sam = await person('sam', 'Sam');
    const app = await renderApp(`/kandi-make?uid=${maya}&name=Maya&handle=maya`);
    await flush();
    await fireEvent.press(app.getByLabelText('Galaxy'));
    await fireEvent.press(app.getByLabelText('Alien'));
    await fireEvent.press(app.getByText('Leave it in Maya’s garden'));
    await flush();
    await settle(1000);
    await flush();
    const made = [...mockSocial.kandi.values()].find((k) => k.from === sam);
    expect(made).toMatchObject({ to: maya, beads: 'galaxy', charm: 'alien' });
    await app.unmount();

    // Maya opens it in her garden and makes one back.
    await s().signOut();
    await s().signIn('maya@example.com', 'password123');
    const hers = await renderApp('/garden');
    await flush();
    await settle(1000);
    await flush();
    await fireEvent.press(hers.getByLabelText('Kandi spelling PLUR, from @sam'));
    await flush();
    await fireEvent.press(hers.getByLabelText('Make kandi back for @sam'));
    await flush();
    expect(hers.getByText('Kandi for Sam')).toBeTruthy();
  });

  it('wear kandi on your profile, and visitors see whose it is', async () => {
    const maya = await person('maya', 'Maya Lin');
    await s().signOut();
    await person('sam', 'Sam');
    await s().giveKandi({ to: maya, word: 'BESTIES', beads: 'glow', charm: 'heart' });
    await s().signOut();
    await s().signIn('maya@example.com', 'password123');
    const app = await renderApp('/garden');
    await flush();
    await settle(1000);
    await flush();
    await fireEvent.press(app.getByLabelText('Kandi spelling BESTIES, from @sam'));
    await flush();
    await fireEvent.press(app.getByText('Wear it on my profile'));
    await flush();
    expect(app.getByText('Wearing it on your profile · Take it off')).toBeTruthy();
    await settle(5000);
    await flush();
    expect(mockSocial.gardens.get(maya)?.kandi[0]).toMatchObject({ word: 'BESTIES', worn: true, from: 'sam' });
    await app.unmount();

    await s().signOut();
    await s().signIn('sam@example.com', 'password123');
    const visit = await renderApp('/u/maya');
    await flush();
    expect(visit.getByText('Wearing kandi from @sam')).toBeTruthy();
  });

  it('decorations they earned hang in their sky for visitors', async () => {
    await person('maya', 'Maya Lin');
    await s().publishGarden([{ k: 's', kind: 'moonlight', stage: 3 }], [], ['lights', 'moon', 'nonsense' as never]);
    await s().signOut();
    await person('sam', 'Sam');
    const app = await renderApp('/u/maya');
    await flush();
    await fireEvent.press(app.getByTestId('visit-garden'));
    await flush();
    expect(app.getByText('In their sky: fairy lights, the moon')).toBeTruthy();
  });

  it('kandi you were given goes out as a story picture', async () => {
    const maya = await person('maya', 'Maya Lin');
    await s().signOut();
    await person('sam', 'Sam');
    await s().giveKandi({ to: maya, word: 'RAIL', beads: 'galaxy', charm: 'alien', note: 'see you at the rail' });
    await s().signOut();
    await s().signIn('maya@example.com', 'password123');
    const app = await renderApp('/garden');
    await flush();
    await settle(1000);
    await flush();
    await fireEvent.press(app.getByLabelText('Kandi spelling RAIL, from @sam'));
    await flush();
    await fireEvent.press(app.getByLabelText('Share this kandi as a picture'));
    await flush();
    expect(app.getByText('Kandi from @sam')).toBeTruthy();
    expect(app.getAllByText('“see you at the rail”').length).toBeGreaterThan(0);
    const Sharing = jest.requireMock<{ shareAsync: jest.Mock }>('expo-sharing');
    Sharing.shareAsync.mockClear();
    await fireEvent.press(app.getByLabelText('Share this picture'));
    await flush();
    expect(Sharing.shareAsync).toHaveBeenCalledWith(expect.stringMatching(/\.png$/), expect.objectContaining({ mimeType: 'image/png' }));
    // Closing the picture goes back to the kandi.
    await fireEvent.press(app.getAllByLabelText('Close').at(-1)!);
    await flush();
    expect(app.queryByText('Kandi from @sam')).toBeNull();
    expect(app.getByText('Wear it on my profile')).toBeTruthy();
  });

  it('visitors see the cards someone pinned, and a tap opens one', async () => {
    await person('maya', 'Maya Lin');
    await s().publishGarden([
      { k: 's', kind: 'plur', stage: 3 },
      { k: 'a', artistId: 'subtronics', name: 'SUBTRONICS', tier: 2, pin: 1 },
      { k: 'a', artistId: 'hedex', name: 'HEDEX', tier: 1 },
    ]);
    await s().signOut();
    await person('sam', 'Sam');
    const app = await renderApp('/u/maya');
    await flush();
    expect(app.getByText('Showcase')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('The Watcher, from SUBTRONICS. Opens the card.'));
    await flush();
    expect(app.getByText('@maya’s collectible')).toBeTruthy();
    expect(app.getByText('Silver')).toBeTruthy();
  });

  it('a decoration you earn gets its moment once; ones you had before the update are simply there', async () => {
    const maya = await person('maya', 'Maya Lin');
    await s().signOut();
    await person('sam', 'Sam');
    for (const word of ['A', 'B', 'C', 'D', 'E']) await s().giveKandi({ to: maya, word, beads: 'neon' });
    await s().signOut();
    await s().signIn('maya@example.com', 'password123');
    // Seen nothing yet on this phone: the lanterns are new.
    await AsyncStorage.setItem('decorSeen.v1', JSON.stringify({ [maya]: [] }));
    const app = await renderApp('/garden');
    await flush();
    await settle(1000);
    await flush();
    expect(app.getByText('New in your garden’s sky')).toBeTruthy();
    expect(app.getAllByText('Paper lanterns').length).toBeGreaterThan(0);
    await settle(500);
    await fireEvent.press(app.getByText('Lovely'));
    await flush();
    expect(app.queryByText('New in your garden’s sky')).toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem('decorSeen.v1'))!)[maya]).toEqual(['lanterns']);
  });

  it('decorations already earned when you first look are not celebrated', async () => {
    const maya = await person('maya', 'Maya Lin');
    await s().signOut();
    await person('sam', 'Sam');
    for (const word of ['A', 'B', 'C', 'D', 'E']) await s().giveKandi({ to: maya, word, beads: 'neon' });
    await s().signOut();
    await s().signIn('maya@example.com', 'password123');
    await AsyncStorage.setItem('kandi.v1', JSON.stringify({ outbox: [], received: ['A', 'B', 'C', 'D', 'E'].map((w, i) => ({ id: `k${i}`, word: w, beads: 'neon', from: 'x', fromHandle: 'sam', createdAt: new Date(2026, 9, 1).toISOString() })) }));
    const app = await renderApp('/garden');
    await flush();
    await settle(1000);
    await flush();
    expect(app.queryByText('New in your garden’s sky')).toBeNull();
  });
});
