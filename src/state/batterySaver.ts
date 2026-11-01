import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { type BatteryReading, watchBattery } from './batteryReader';

/**
 * Battery saver for festival days (`batterySaver.v1`, this phone): Off, On,
 * or Automatic (on below 30% while not charging, or with iPhone's Low Power
 * Mode on). While it's on, Afterglow
 * does less: Discover doesn't play the next clip by itself, crew updates and
 * the crew map are read less often, your spot goes to your crew less often,
 * and the festival trail records with less accuracy. Automatic needs to know
 * the battery: the phone app (version 1.0.6 on, expo-battery) and browsers
 * that say (Chrome); elsewhere Automatic acts as Off.
 */
export type SaverMode = 'off' | 'on' | 'auto';
export const SAVER_KEY = 'batterySaver.v1';
/** Automatic turns on below this. */
export const SAVER_LEVEL = 0.3;

let mode: SaverMode = 'off';
let battery: BatteryReading | undefined;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Whether it's on right now. */
export const saverOn = () => {
  start();
  return mode === 'on' || (mode === 'auto' && !!battery && (!!battery.lowPower || (!battery.charging && battery.level <= SAVER_LEVEL)));
};
export const saverMode = () => mode;

function start() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(SAVER_KEY)
    .then((raw) => {
      if (raw === 'on' || raw === 'auto') {
        mode = raw;
        emit();
      }
    })
    .catch(() => {});
  // The battery: the phone's (with iPhone's Low Power Mode), or the browser's where it says.
  void watchBattery((b) => {
    battery = b;
    emit();
  });
}

export function setSaverMode(next: SaverMode) {
  mode = next;
  emit();
  void AsyncStorage.setItem(SAVER_KEY, next).catch(() => {});
}

/** For tests: back to Off. */
export function forgetBatterySaver() {
  mode = 'off';
  battery = undefined;
  loaded = false;
}

/** Battery saver's mode, whether it's on now, and the battery when known. */
export function useBatterySaver() {
  const [, bump] = useState(0);
  useEffect(() => {
    start();
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { mode, on: saverOn(), level: battery?.level, charging: battery?.charging, knowsBattery: !!battery, setMode: setSaverMode };
}
