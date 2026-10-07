import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Share } from 'react-native';
import { findLink } from '../../features/finds/finds';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/** Stickers in the wild: made in HQ, found by scanning, kept with no signal. */
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
const SUPPORT = 'afterglowmusic.support@gmail.com';
const T = new Date(2026, 9, 10, 20, 0);

/** A hunt of two with the Ferris wheel in it, straight into the backend. */
function seed(until?: number) {
  mockSocial.hunts.set('nightmkt27', { id: 'nightmkt27', name: 'Night Market 2027', items: [{ creature: 'ferris', name: 'Ferris wheel' }, { creature: 'frog', name: 'Water frog' }] });
  mockSocial.stickers.set('ferris2027', { code: 'ferris2027', name: 'Ferris wheel · Night Market', creature: 'ferris', huntId: 'nightmkt27', slot: 0, ...(until !== undefined ? { until } : {}) });
}
const link = (code = 'ferris2027', c = 'ferris', n = 'Ferris wheel · Night Market') => findLink({ code, creature: c, name: n }).replace('https://afterglowmusic.app', '');

beforeEach(async () => {
  jest.useFakeTimers({ now: T });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  network.__setState({ isConnected: true, isInternetReachable: true });
});
afterEach(() => {
  network.__setState({ isConnected: true, isInternetReachable: true });
});

describe('stickers', () => {
  it('HQ makes a hunt and a sticker in it', async () => {
    mockSocial.verified.add(SUPPORT);
    await s().signUp(SUPPORT, 'password123');
    const app = await renderApp('/admin');
    await flush();
    await fireEvent.press(app.getByText('Stickers'));
    await flush();
    await fireEvent.changeText(app.getByLabelText('Hunt name'), 'Night Market 2027');
    await fireEvent.press(app.getByText('Make hunt'));
    await flush();
    await fireEvent.changeText(app.getByLabelText('Sticker name'), 'Water frog · Station 3');
    await fireEvent.press(app.getByLabelText('The Water frog'));
    await fireEvent.changeText(app.getByLabelText('End date'), '2027-06-14');
    await fireEvent.press(app.getByText('Make sticker'));
    await flush();
    const [sticker] = [...mockSocial.stickers.values()];
    const [hunt] = [...mockSocial.hunts.values()];
    expect(sticker).toMatchObject({ name: 'Water frog · Station 3', creature: 'frog', huntId: hunt.id, slot: 0, until: Date.UTC(2027, 5, 15, 11, 59, 59, 999) });
    expect(sticker.code).toMatch(/^[a-z2-9]{10}$/);
    expect(hunt.items).toEqual([{ creature: 'frog', name: 'Water frog · Station 3' }]);
    expect(app.getByText('Water frog · Station 3')).toBeTruthy();
    expect(app.getByText(/^Found by 0 · Night Market 2027 · Can be found until Jun 14, 2027$/)).toBeTruthy();
    // HQ's creature picker draws every creature, which takes a while when the whole suite runs at once.
  }, 20_000);

  it('opening a sticker’s code keeps it, lights it up and fills in its hunt; signing in sends it', async () => {
    seed();
    const app = await renderApp(link());
    await flush();
    expect(app.getByText('YOU FOUND')).toBeTruthy();
    expect(app.getByText('Ferris wheel · Night Market')).toBeTruthy();
    expect(app.getByText('Night Market 2027')).toBeTruthy();
    expect(app.getByText('1 of 2 found')).toBeTruthy();
    expect(app.getByText('Create a free account')).toBeTruthy();
    // It goes out as a picture.
    await fireEvent.press(app.getByLabelText('Share what you found as a picture'));
    await flush();
    expect(app.getByText('I found Ferris wheel · Night Market')).toBeTruthy();
    await fireEvent.press(app.getAllByLabelText('Close').at(-1)!);
    await flush();
    // Kept on the phone, then sent once you sign in.
    expect(JSON.parse((await AsyncStorage.getItem('finds.v1')) ?? '{}').finds).toEqual([expect.objectContaining({ code: 'ferris2027', state: 'found', sent: false })]);
    const u = await act(() => s().signUp('maya@example.com', 'password123'));
    await flush();
    expect(mockSocial.finds.get(`${u.uid}_ferris2027`)).toBe(T.getTime());
    // In the garden.
    await act(async () => router.push('/garden'));
    await flush();
    expect(app.getByText('Stickers you’ve found · 1')).toBeTruthy();
    expect(app.getByLabelText('Night Market 2027: 1 of 2 found.')).toBeTruthy();
  });

  it('stickers kept on your account come back on a new phone', async () => {
    seed();
    const u = await s().signUp('maya@example.com', 'password123');
    mockSocial.finds.set(`${u.uid}_ferris2027`, T.getTime() - 86_400_000);
    const app = await renderApp('/garden');
    await flush();
    expect(app.getByText('Stickers you’ve found · 1')).toBeTruthy();
    expect(app.getByLabelText('Night Market 2027: 1 of 2 found.')).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem('finds.v1')) ?? '{}').finds).toEqual([
      expect.objectContaining({ code: 'ferris2027', account: u.uid, state: 'found', sent: true, at: T.getTime() - 86_400_000 }),
    ]);
  });

  it('a scan from before a sticker was taken down still counts once there’s signal; one after doesn’t', async () => {
    seed();
    const u = await s().signUp('maya@example.com', 'password123');
    network.__setState({ isConnected: false, isInternetReachable: false });
    const app = await renderApp(link());
    await flush();
    expect(app.getByText('SAVED')).toBeTruthy();
    // HQ takes it down while this phone has no signal.
    mockSocial.stickers.set('ferris2027', { ...mockSocial.stickers.get('ferris2027')!, takenDownAt: T.getTime() + 1000 });
    await act(async () => network.__setState({ isConnected: true, isInternetReachable: true }));
    await flush();
    expect(app.getByText('YOU FOUND')).toBeTruthy();
    expect(mockSocial.finds.get(`${u.uid}_ferris2027`)).toBe(T.getTime());
    mockSocial.stickers.set('frog2027aa', { code: 'frog2027aa', name: 'Water frog', creature: 'frog', takenDownAt: T.getTime() - 1000 });
    await act(async () => router.push(link('frog2027aa', 'frog', 'Water frog')));
    await flush();
    expect(app.getByText('This code isn’t an Afterglow sticker any more.')).toBeTruthy();
  });

  it('a send that’s refused for another reason is tried again, not dropped', async () => {
    seed();
    await s().signUp('maya@example.com', 'password123');
    const real = s().recordFind;
    const spy = jest.spyOn(s(), 'recordFind').mockImplementationOnce(async () => {
      throw new Error('quota');
    });
    const app = await renderApp(link());
    await flush();
    expect(app.getByText('YOU FOUND')).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockImplementation(real);
    await settle(20_000);
    await flush();
    expect([...mockSocial.finds.keys()]).toEqual([expect.stringMatching(/_ferris2027$/)]);
  });

  it('with no signal, keeps the scan and checks it once there’s signal', async () => {
    seed();
    network.__setState({ isConnected: false, isInternetReachable: false });
    const app = await renderApp(link());
    await flush();
    expect(app.getByText('SAVED')).toBeTruthy();
    expect(app.getByText('Saved on your phone. It’s checked as soon as there’s signal.')).toBeTruthy();
    await act(async () => network.__setState({ isConnected: true, isInternetReachable: true }));
    await flush();
    expect(app.getByText('YOU FOUND')).toBeTruthy();
  });

  it('an ended sticker isn’t kept, and a code that isn’t one says so', async () => {
    seed(Date.UTC(2026, 9, 6, 11, 59, 59, 999));
    const app = await renderApp(link());
    await flush();
    expect(app.getByText('NOT THIS TIME')).toBeTruthy();
    expect(app.getByText(/^This one could only be found until Oct 5, 2026\.$/)).toBeTruthy();
    await act(async () => router.push(link('nosuchcode')));
    await flush();
    expect(app.getByText('This code isn’t an Afterglow sticker any more.')).toBeTruthy();
  });

  it('finishing a hunt opens a card to share', async () => {
    seed();
    mockSocial.stickers.set('frog2027aa', { code: 'frog2027aa', name: 'Water frog', creature: 'frog', huntId: 'nightmkt27', slot: 1 });
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'dismissedAction' } as never);
    const app = await renderApp(link());
    await flush();
    expect(app.getByText('See the hunt')).toBeTruthy();
    await act(async () => router.push(link('frog2027aa', 'frog', 'Water frog')));
    await flush();
    expect(app.getByText('HUNT COMPLETE')).toBeTruthy();
    await fireEvent.press(app.getByText('Share your hunt'));
    await flush();
    expect(app.getByLabelText('Night Market 2027: All 2 found.')).toBeTruthy();
    expect(app.getByText(/^Finished Oct 10, 2026$/)).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Share your hunt as text'));
    await flush();
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ message: 'I found all 2 stickers in the Night Market 2027 hunt on Afterglow. https://afterglowmusic.app' }));
    share.mockRestore();
  });

  it('a link edited to another creature still gets the real one', async () => {
    seed();
    const app = await renderApp(link('ferris2027', 'frog', 'Golden frog'));
    await flush();
    expect(app.getByText('Ferris wheel · Night Market')).toBeTruthy();
    expect(app.queryByText('Golden frog')).toBeNull();
  });

  it('the in-app scanner opens a sticker', async () => {
    seed();
    const app = await renderApp('/scan');
    await flush();
    await fireEvent(app.getByTestId('camera-view'), 'barcodeScanned', { data: `https://afterglowmusic.app${link()}`, type: 'qr' });
    await flush();
    expect(app.getByText('YOU FOUND')).toBeTruthy();
  });

  it('a sticker caught off a totem’s screen finds a secret', async () => {
    seed();
    const app = await renderApp('/scan');
    await flush();
    await fireEvent(app.getByTestId('camera-view'), 'barcodeScanned', { data: `https://afterglowmusic.app${link()}&via=totem`, type: 'qr' });
    await flush();
    expect(app.getByText('YOU FOUND')).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem('secrets.v1')) ?? '{}')).toHaveProperty('totem');
  });
});
