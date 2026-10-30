import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/** A festival's own map through the real routes: on the Info tab, then the map with its markers. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const flush = async (n = 10) => {
  for (let i = 0; i < n; i++)
    await act(async () => {
      jest.advanceTimersByTime(50);
      await Promise.resolve();
    });
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  mockSocial.venueMaps.set('edc-orlando-26', {
    festivalId: 'edc-orlando-26',
    image: 'https://firebasestorage.googleapis.com/v0/b/x/o/venueMaps%2Fedc%2Fmap-1.jpg?alt=media',
    width: 1000,
    height: 800,
    anchors: [
      { x: 0, y: 0, lat: 28.54, lon: -81.41 },
      { x: 1000, y: 0, lat: 28.54, lon: -81.4 },
      { x: 0, y: 800, lat: 28.532, lon: -81.41 },
    ],
    pins: [
      { id: 'w', kind: 'water', label: 'Water by the wheel', x: 300, y: 300 },
      { id: 'm', kind: 'medical', label: '', x: 600, y: 500 },
    ],
  });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('festival maps', () => {
  it('shows on the festival’s Info tab and opens with its markers', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 30, 12) });
    const app = await renderApp('/festival/edc-orlando-26');
    await flush();
    await fireEvent.press(app.getByText('Info'));
    await flush();
    await fireEvent.press(app.getByLabelText('Festival map: where the stages, water and medical are, and where you are'));
    await flush();
    expect(app.getByText('Festival map')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Water by the wheel, Water'));
    await flush(2);
    expect(app.getByText('Water by the wheel')).toBeTruthy();
    expect(app.getByLabelText('Medical, Medical')).toBeTruthy();
    // Kept on the phone for no signal.
    expect(Object.keys(JSON.parse((await AsyncStorage.getItem('venueMaps.v1')) ?? '{}'))).toContain('edc-orlando-26');
    await app.unmount();
  });
});
