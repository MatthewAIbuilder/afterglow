import { useEffect } from 'react';
import { useNow } from '../../lib/useNow';
import { revealSecret, useSecrets } from '../../state/secrets';
import { isSunriseHour } from './secrets';

/** A secret that finds you: opening Afterglow between 5 and 7 in the morning, once. Renders nothing. */
export function SunriseWatcher() {
  const { found, loaded } = useSecrets();
  const now = useNow().getTime();
  const due = loaded && !found.sunrise && isSunriseHour(now);
  useEffect(() => {
    if (!due) return;
    // A moment after opening, so the app is there to see it.
    const t = setTimeout(() => revealSecret('sunrise'), 1500);
    return () => clearTimeout(t);
  }, [due]);
  return null;
}
