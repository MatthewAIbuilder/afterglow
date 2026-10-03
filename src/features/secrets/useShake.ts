import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { shakeStep } from './secrets';

/**
 * Calls `onShake` when the phone is shaken, while `on`. Reads the
 * accelerometer (no permission needed on phones) only while switched on;
 * nothing in a browser.
 */
export function useShake(on: boolean, onShake: () => void) {
  const latest = useRef(onShake);
  useEffect(() => {
    latest.current = onShake;
  }, [onShake]);
  useEffect(() => {
    if (!on || Platform.OS === 'web') return;
    let jolts: number[] = [];
    let sub: { remove: () => void } | undefined;
    let live = true;
    Accelerometer.isAvailableAsync()
      .then((ok) => {
        if (!ok || !live) return;
        Accelerometer.setUpdateInterval(80);
        sub = Accelerometer.addListener((s) => {
          const step = shakeStep(jolts, { ...s, t: Date.now() });
          jolts = step.jolts;
          if (step.shook) latest.current();
        });
      })
      .catch(() => {});
    return () => {
      live = false;
      sub?.remove();
    };
  }, [on]);
}
