import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** The current time, updated every `everyMs` and whenever the app comes back to the foreground. */
export function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, everyMs);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') tick();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [everyMs]);
  return now;
}
