import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
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
});
