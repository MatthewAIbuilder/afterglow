import { useEffect } from 'react';

type Lock = { release: () => Promise<void> };
type WakeNavigator = { wakeLock?: { request: (type: 'screen') => Promise<Lock> } };

/**
 * Keeps the screen on while the caller is shown (the totem), on the website:
 * the browser's screen lock, asked for again whenever the page comes back
 * (browsers drop it when the tab is hidden). Quietly nothing where browsers
 * don't have it.
 */
export function useScreenOn() {
  useEffect(() => {
    if (typeof document === 'undefined' || typeof navigator === 'undefined') return;
    const wake = (navigator as WakeNavigator).wakeLock;
    if (!wake) return;
    let lock: Lock | undefined;
    let on = true;
    const ask = () => {
      if (!on || document.visibilityState !== 'visible') return;
      wake
        .request('screen')
        .then((l) => {
          if (on) lock = l;
          else void l.release().catch(() => {});
        })
        .catch(() => {});
    };
    ask();
    document.addEventListener('visibilitychange', ask);
    return () => {
      on = false;
      document.removeEventListener('visibilitychange', ask);
      void lock?.release().catch(() => {});
    };
  }, []);
}
