export type BatteryReading = { level: number; charging: boolean; lowPower?: boolean };

type WebBattery = { level: number; charging: boolean; addEventListener: (e: string, f: () => void) => void };

/** The battery, where the browser says (Chrome); nothing elsewhere. */
export async function watchBattery(onChange: (b: BatteryReading) => void): Promise<void> {
  try {
    const nav = (globalThis as { navigator?: { getBattery?: () => Promise<WebBattery> } }).navigator;
    const b = await nav?.getBattery?.();
    if (!b) return;
    const read = () => onChange({ level: b.level, charging: b.charging });
    read();
    b.addEventListener('levelchange', read);
    b.addEventListener('chargingchange', read);
  } catch {
    // No battery reading: Automatic acts as Off.
  }
}
