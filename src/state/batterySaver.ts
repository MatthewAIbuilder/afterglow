import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Battery saver for festival days (`batterySaver.v1`, this phone): Off, On,
 * or Automatic (on below 30% while not charging). While it's on, Afterglow
 * does less: Discover doesn't play the next clip by itself, crew updates and
 * the crew map are read less often, your spot goes to your crew less often,
 * and the festival trail records with less accuracy. Automatic needs to know
 * the battery: browsers that say (Chrome), and the phone app from its next
 * build; until then Automatic acts as Off there.
 */
export type SaverMode = 'off' | 'on' | 'auto';
export const SAVER_KEY = 'batterySaver.v1';
/** Automatic turns on below this. */
export const SAVER_LEVEL = 0.3;

type Battery = { level: number; charging: boolean };
let mode: SaverMode = 'off';
let battery: Battery | undefined;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Whether it's on right now. */
export const saverOn = () => mode === 'on' || (mode === 'auto' && !!battery && !battery.charging && battery.level <= SAVER_LEVEL);
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
  // The battery, where the browser says (the phone app reads it from its next build).
  if (Platform.OS === 'web') {
    const nav = (globalThis as { navigator?: { getBattery?: () => Promise<{ level: number; charging: boolean; addEventListener: (e: string, f: () => void) => void }> } }).navigator;
    void nav
      ?.getBattery?.()
      .then((b) => {
        const read = () => {
          battery = { level: b.level, charging: b.charging };
          emit();
        };
        read();
        b.addEventListener('levelchange', read);
        b.addEventListener('chargingchange', read);
      })
      .catch(() => {});
  }
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
