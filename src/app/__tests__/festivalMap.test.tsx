import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { ActionSheetIOS } from 'react-native';
import { renderApp, showTab } from './appRoutes';

const flush = async () => {
  for (let i = 0; i < 6; i++)
    await act(async () => {
      await Promise.resolve();
    });
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('the festival map', () => {
  it('opens from the Festivals tab with every festival that has a place', async () => {
    const app = await renderApp('/festivals');
    await flush();
    await fireEvent.press(app.getByLabelText('Festival map'));
    await flush();
    expect(app.getByTestId('festival-map')).toBeTruthy();
    expect(app.getByTestId('map-light-acl-26')).toBeTruthy();
    expect(app.getByTestId('map-card-cyclops-cove-4')).toBeTruthy();
  });

  it('shows yours, chooses a festival from its light, then opens it from its card', async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
    const app = await renderApp('/festival-map');
    await flush();
    await fireEvent.press(app.getByLabelText("Festivals you're going to or went to, 1"));
    await flush();
    expect(app.getByText('1 of yours')).toBeTruthy();
    expect(app.queryByTestId('map-card-acl-26')).toBeNull();
    await fireEvent.press(app.getByTestId('map-light-cyclops-cove-4'));
    await flush();
    expect(app.getByText('Open ›')).toBeTruthy();
    await fireEvent.press(app.getByTestId('map-card-cyclops-cove-4'));
    await flush();
    expect(app.getAllByText('Cyclops Cove 4').length).toBeGreaterThan(0);
    expect(app.queryByTestId('festival-map')).toBeNull();
  });

  it('a festival page links to it on the map', async () => {
    const app = await renderApp('/festival/acl-26');
    await flush();
    await showTab(app, 'Info');
    await fireEvent.press(app.getByLabelText('See Austin City Limits 2026 on the festival map'));
    await flush();
    expect(app.getByTestId('festival-map')).toBeTruthy();
    expect(app.getByTestId('map-light-acl-26').props.accessibilityState).toEqual({ selected: true });
    expect(app.getByText('Open ›')).toBeTruthy();
  });

  it("an artist's festivals, as their tour", async () => {
    const app = await renderApp('/artist/subtronics');
    await flush();
    await fireEvent.press(app.getByLabelText("See SUBTRONICS's festivals on the map"));
    await flush();
    expect(app.getByText('SUBTRONICS on tour')).toBeTruthy();
    expect(app.getByTestId('map-card-cyclops-cove-4')).toBeTruthy();
    expect(app.queryByTestId('map-card-acl-26')).toBeNull();
    expect(app.queryByLabelText(/^All festivals, /)).toBeNull();
  });

  it('shows you on the map once you allow it', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Location = require('expo-location');
    Location.requestForegroundPermissionsAsync.mockImplementationOnce(async () => ({ granted: true }));
    Location.getCurrentPositionAsync.mockImplementationOnce(async () => ({ coords: { latitude: 28.5, longitude: -81.4 } }));
    const app = await renderApp('/festival-map');
    await flush();
    await fireEvent.press(app.getByLabelText('Show me on the map'));
    await flush();
    expect(app.getByLabelText('You are here, roughly')).toBeTruthy();
    expect(app.getByLabelText('Show where I am')).toBeTruthy();
  });

  it('moves like a real map: Show all brings every festival back, and the streets hold a secret', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const maps = require('react-native-maps');
    const app = await renderApp('/festival-map');
    await flush();
    // Framed once on opening.
    expect(maps.__calls.some((c: { method: string }) => c.method === 'fitToCoordinates')).toBe(true);
    expect(app.queryByLabelText('Show all these festivals again')).toBeNull();
    await fireEvent(app.getByTestId('festival-map'), 'touchStart');
    maps.__calls.length = 0;
    await fireEvent.press(app.getByLabelText('Show all these festivals again'));
    expect(maps.__calls.map((c: { method: string }) => c.method)).toEqual(['fitToCoordinates']);
    expect(app.queryByLabelText('Show all these festivals again')).toBeNull();
    // All the way down to the streets.
    await fireEvent(app.getByTestId('native-map'), 'regionChangeComplete', { latitude: 26.4, longitude: -80.1, latitudeDelta: 0.008, longitudeDelta: 0.01 });
    await flush();
    expect(JSON.parse((await AsyncStorage.getItem('secrets.v1')) ?? '{}')).toHaveProperty('edge');
  });

  it('festivals sharing a spot fan out when you zoom in, and the cards follow what you can see', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const maps = require('react-native-maps');
    const app = await renderApp('/festival-map');
    await flush();
    // EDC Orlando and Eternal NYE are in the same part of Orlando: one light with a count.
    const both = app.getByLabelText(/^(EDC Orlando 2026|Eternal NYE 2026) and 1 more here\./);
    maps.__calls.length = 0;
    await fireEvent(app.getByTestId('festival-map'), 'touchStart');
    await fireEvent.press(both);
    await flush();
    // Tapping it zooms to the city (it would never split by zooming alone).
    const zoom = maps.__calls.find((c: { method: string }) => c.method === 'animateToRegion');
    expect(zoom.args[0]).toMatchObject({ longitudeDelta: 0.75 });
    await fireEvent(app.getByTestId('native-map'), 'regionChangeComplete', { latitude: 28.537, longitude: -81.4, latitudeDelta: 0.6, longitudeDelta: 0.75 });
    await flush();
    // There, each is its own light, and the cards are the festivals in view.
    expect(app.getByTestId('map-light-edc-orlando-26')).toBeTruthy();
    expect(app.getByTestId('map-light-eternal-nye-26')).toBeTruthy();
    expect(app.getByText(/^2 festivals here · \d+ in all$/)).toBeTruthy();
    expect(app.getByTestId('map-card-edc-orlando-26')).toBeTruthy();
    expect(app.queryByTestId('map-card-acl-26')).toBeNull();
    // Show all: every festival's card again.
    await fireEvent.press(app.getByLabelText('Show all these festivals again'));
    await flush();
    expect(app.getByTestId('map-card-acl-26')).toBeTruthy();
  });

  it('search finds a festival or a city, and When narrows it to soon', async () => {
    const app = await renderApp('/festival-map');
    await flush();
    await fireEvent.press(app.getByLabelText('Search the map'));
    await fireEvent.changeText(app.getByLabelText('Search the map'), 'orlando');
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await flush();
    expect(app.getByTestId('map-card-edc-orlando-26')).toBeTruthy();
    expect(app.queryByTestId('map-card-acl-26')).toBeNull();
    await fireEvent.press(app.getByLabelText('Stop searching'));
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await flush();
    expect(app.getByTestId('map-card-acl-26')).toBeTruthy();
    // When: the next three months leaves out the festivals further off.
    const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_, pick) => pick(2));
    await fireEvent.press(app.getByLabelText('When: Any time. Change'));
    await flush();
    expect(app.getByLabelText('When: Next 3 months. Change')).toBeTruthy();
    sheet.mockRestore();
  });
});
