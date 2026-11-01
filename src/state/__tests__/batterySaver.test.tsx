import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { forgetBatterySaver, SAVER_KEY, saverOn, setSaverMode, useBatterySaver } from '../batterySaver';

function Probe() {
  const s = useBatterySaver();
  return <Text>{`${s.mode}:${s.on}`}</Text>;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  forgetBatterySaver();
});

describe('battery saver', () => {
  it('is off by default, on when you say, and Automatic waits until it knows the battery', async () => {
    const app = await render(<Probe />);
    expect(app.getByText('off:false')).toBeTruthy();
    await act(async () => setSaverMode('on'));
    expect(app.getByText('on:true')).toBeTruthy();
    expect(saverOn()).toBe(true);
    expect(await AsyncStorage.getItem(SAVER_KEY)).toBe('on');
    await act(async () => setSaverMode('auto'));
    // No battery reading on this phone yet: Automatic acts as Off.
    expect(app.getByText('auto:false')).toBeTruthy();
    await app.unmount();
  });

  it('remembers your choice', async () => {
    await AsyncStorage.setItem(SAVER_KEY, 'on');
    const app = await render(<Probe />);
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());
    expect(app.getByText('on:true')).toBeTruthy();
    await app.unmount();
  });

  it('Automatic reads the phone: on below 30% unplugged, or with Low Power Mode', async () => {
    const battery = jest.requireMock<{ __state: { available: boolean; level: number; state: number; lowPower: boolean; levelListeners: ((e: { batteryLevel: number }) => void)[]; lowPowerListeners: ((e: { lowPowerMode: boolean }) => void)[] } }>('expo-battery').__state;
    Object.assign(battery, { available: true, level: 0.5, state: 1, lowPower: false, levelListeners: [], lowPowerListeners: [] });
    await AsyncStorage.setItem(SAVER_KEY, 'auto');
    const app = await render(<Probe />);
    for (let i = 0; i < 6; i++) await act(async () => Promise.resolve());
    expect(app.getByText('auto:false')).toBeTruthy();
    await act(async () => battery.levelListeners.forEach((l) => l({ batteryLevel: 0.2 })));
    expect(app.getByText('auto:true')).toBeTruthy();
    await act(async () => battery.levelListeners.forEach((l) => l({ batteryLevel: 0.9 })));
    expect(app.getByText('auto:false')).toBeTruthy();
    await act(async () => battery.lowPowerListeners.forEach((l) => l({ lowPowerMode: true })));
    expect(app.getByText('auto:true')).toBeTruthy();
    await app.unmount();
    battery.available = false;
  });
});
