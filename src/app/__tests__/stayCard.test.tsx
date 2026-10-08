import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { renderApp, showTab } from './appRoutes';

/** "Where to stay" on a festival's Info tab: Stay22's live places near the venue for its nights, with choices. */
const flush = async () => {
  for (let i = 0; i < 8; i++)
    await act(async () => {
      jest.advanceTimersByTime(50);
      await Promise.resolve();
    });
};
const query = (uri: string) => Object.fromEntries(new URL(uri).searchParams);

beforeEach(async () => {
  jest.restoreAllMocks();
  jest.useFakeTimers({ now: new Date(2026, 9, 8, 12) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('where to stay', () => {
  it('shows places near the venue for the festival’s nights, a night either side on request, and opens bookings in the browser', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const app = await renderApp('/festival/edc-orlando-26');
    await flush();
    await showTab(app, 'Info');
    await flush();
    expect(app.getByText('Where to stay')).toBeTruthy();
    expect(app.getByText(/^3 nights near /)).toBeTruthy();
    const map = () => app.getByTestId('stay-map').props as { source: { uri: string }; onShouldStartLoadWithRequest: (r: { url: string; isTopFrame?: boolean }) => boolean };
    expect(map().source.uri.startsWith('https://www.stay22.com/embed/gm?')).toBe(true);
    expect(query(map().source.uri)).toMatchObject({ aid: 'afterglow', checkin: '2026-11-06', checkout: '2026-11-09', viewmode: 'listview', mapstyle: 'dark', campaign: 'edc-orlando-26' });

    await fireEvent.press(app.getByLabelText('Arrive a day early'));
    await fireEvent.press(app.getByLabelText('Show places to stay on a map'));
    expect(app.getByText(/^4 nights near /)).toBeTruthy();
    expect(query(map().source.uri)).toMatchObject({ checkin: '2026-11-05', checkout: '2026-11-09', viewmode: 'map' });

    // Stay22's own pages stay in the card; a booking opens in the browser.
    expect(map().onShouldStartLoadWithRequest({ url: 'https://www.stay22.com/embed/gm?x=1' })).toBe(true);
    expect(map().onShouldStartLoadWithRequest({ url: 'https://www.booking.com/hotel/us/x.html', isTopFrame: true })).toBe(false);
    expect(open).toHaveBeenCalledWith('https://www.booking.com/hotel/us/x.html');

    await fireEvent.press(app.getByLabelText('See all places to stay near EDC Orlando 2026. Opens in your browser.'));
    expect(open.mock.calls.at(-1)?.[0]).toMatch(/^https:\/\/www\.stay22\.com\/allez\/roam\?aid=afterglow.*checkin=2026-11-05/);
    expect(app.getAllByText(/Afterglow may earn a commission/).length).toBeGreaterThan(0);
    await app.unmount();
  });
});
