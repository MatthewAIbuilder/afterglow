import { useEffect } from 'react';
import { useNow } from '../../lib/useNow';
import { revealSecret, useSecrets } from '../../state/secrets';
import { isNightOwlHour, isSunriseHour } from './secrets';

/**
 * Secrets that find you: opening Afterglow between 5 and 7 in the morning
 * (Sunrise crew) or between 2 and 4 (Night owl), each once. Renders nothing.
 */
export function SunriseWatcher() {
  const { found, loaded } = useSecrets();
  const now = useNow().getTime();
  const due = !loaded ? undefined : !found.sunrise && isSunriseHour(now) ? 'sunrise' : !found.nightowl && isNightOwlHour(now) ? 'nightowl' : undefined;
  useEffect(() => {
    if (!due) return;
    // A moment after opening, so the app is there to see it.
    const t = setTimeout(() => revealSecret(due), 1500);
    return () => clearTimeout(t);
  }, [due]);
  return null;
}
