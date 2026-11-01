import * as Battery from 'expo-battery';

export type BatteryReading = { level: number; charging: boolean; lowPower?: boolean };

/**
 * The phone's battery for Battery saver's Automatic mode: its level, whether
 * it's charging, and iPhone's Low Power Mode, now and as they change. Calls
 * `onChange` with each reading; nothing when the phone won't say.
 */
export async function watchBattery(onChange: (b: BatteryReading) => void): Promise<void> {
  try {
    if (!(await Battery.isAvailableAsync())) return;
    let reading: BatteryReading = { level: await Battery.getBatteryLevelAsync(), charging: false };
    const state = await Battery.getBatteryStateAsync();
    const charging = (s: Battery.BatteryState) => s === Battery.BatteryState.CHARGING || s === Battery.BatteryState.FULL;
    reading = { ...reading, charging: charging(state), lowPower: await Battery.isLowPowerModeEnabledAsync().catch(() => false) };
    if (reading.level < 0) return; // A simulator: no battery.
    onChange(reading);
    Battery.addBatteryLevelListener(({ batteryLevel }) => {
      reading = { ...reading, level: batteryLevel };
      onChange(reading);
    });
    Battery.addBatteryStateListener(({ batteryState }) => {
      reading = { ...reading, charging: charging(batteryState) };
      onChange(reading);
    });
    Battery.addLowPowerModeListener(({ lowPowerMode }) => {
      reading = { ...reading, lowPower: lowPowerMode };
      onChange(reading);
    });
  } catch {
    // No battery reading: Automatic acts as Off.
  }
}
