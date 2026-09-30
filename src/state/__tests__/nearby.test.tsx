import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { useEffect } from 'react';
import { CatalogProvider } from '../catalog';
import { AREA_FRESH_MS, NearbyProvider, useNearby } from '../nearby';

const Location = jest.requireMock<Record<string, jest.Mock>>('expo-location');

const latest: { current?: ReturnType<typeof useNearby> } = {};
function Probe() {
  const n = useNearby();
  useEffect(() => {
    latest.current = n;
  });
  return null;
}
const settle = async () => {
  for (let i = 0; i < 8; i++) await act(async () => void (await Promise.resolve()));
};
async function mount() {
  await render(
    <CatalogProvider>
      <NearbyProvider>
        <Probe />
      </NearbyProvider>
    </CatalogProvider>,
  );
  await settle();
  return () => latest.current!;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  latest.current = undefined;
  jest.clearAllMocks();
});

describe('near you', () => {
  it('is off until you ask, and never asks for location on its own', async () => {
    const ctx = await mount();
    expect(ctx().status).toBe('off');
    expect(ctx().here).toBeUndefined();
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('looks up festivals without coordinates once, and remembers them', async () => {
    Location.requestForegroundPermissionsAsync.mockImplementationOnce(async () => ({ granted: true }));
    Location.getCurrentPositionAsync.mockImplementationOnce(async () => ({ coords: { latitude: 26.37, longitude: -80.1 } }));
    Location.geocodeAsync.mockImplementation(async (text: unknown) => (/Boca Raton/.test(String(text)) ? [{ latitude: 26.3683, longitude: -80.1289 }] : []));
    const ctx = await mount();
    await act(async () => void (await ctx().turnOn()));
    await settle();
    expect(ctx().status).toBe('on');
    const cyclops = { id: 'x', name: 'x', dates: '', location: 'Sunset Cove Amphitheater, Boca Raton', lineup: [], days: [], stages: [] };
    expect(ctx().placeOf(cyclops)).toEqual({ lat: 26.368, lon: -80.129 });
    expect(ctx().distanceTo(cyclops)).toBeLessThan(5);
    const saved = JSON.parse((await AsyncStorage.getItem('festivalPlaces.v1'))!);
    expect(saved['Sunset Cove Amphitheater, Boca Raton']).toEqual({ lat: 26.368, lon: -80.129 });
    Location.geocodeAsync.mockReset();
  });

  it('refreshes where you are quietly when it is old, only if you already allowed it', async () => {
    await AsyncStorage.setItem('nearYou.v1', JSON.stringify({ lat: 40.71, lon: -74.01, at: Date.now() - AREA_FRESH_MS - 1 }));
    Location.getForegroundPermissionsAsync.mockImplementationOnce(async () => ({ granted: true }));
    Location.getCurrentPositionAsync.mockImplementationOnce(async () => ({ coords: { latitude: 28.54, longitude: -81.38 } }));
    const ctx = await mount();
    expect(ctx().here).toEqual({ lat: 28.54, lon: -81.38 });
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('keeps an old place when location was taken away since', async () => {
    await AsyncStorage.setItem('nearYou.v1', JSON.stringify({ lat: 40.71, lon: -74.01, at: Date.now() - AREA_FRESH_MS - 1 }));
    const ctx = await mount();
    expect(ctx().here).toEqual({ lat: 40.71, lon: -74.01 });
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });
});
