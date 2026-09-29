import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Today's date, refreshed when the app comes back to the foreground (so a countdown never goes stale overnight). */
export function useToday() {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setToday(new Date());
    });
    return () => sub.remove();
  }, []);
  return today;
}
