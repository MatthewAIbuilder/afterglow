import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { showAlert } from '../../lib/dialog';
import { useCatalog } from '../../state/catalog';
import { useGoing } from '../../state/going';
import { useWeekends } from '../../state/weekends';
import { t } from '../../i18n';
import { askKey, trailFestival, trailPlan } from './trail';
import { askTrailPermission, startRecording, stopRecording, trailPermission } from './trailRecorder';
import { readPrefs, writePrefs } from './trailStore';

/** While the app is open, the plan is looked at again this often (a festival day starts, a festival ends). */
const RECHECK_MS = 15 * 60_000;

/**
 * Keeps the festival trail: on a day a festival you're going to is on, it asks once (the first time) whether to
 * keep a trail of where you walk, and if you said yes, records until the festival is over; on every other day
 * nothing records. Looked at when the app opens or comes back, when your festivals change, and every quarter
 * hour while it's open. Renders nothing; phones only. See `trail.ts` and `docs/trail.md`.
 */
export function TrailKeeper() {
  const { festivals: catalogFestivals } = useCatalog();
  const { forYou } = useWeekends();
  const { going, hydrated } = useGoing();
  const festivals = useMemo(() => catalogFestivals.map(forYou), [catalogFestivals, forYou]);
  const asking = useRef(false);
  // Bumped to look again right away (after you said yes).
  const [again, setAgain] = useState(0);

  const check = useCallback(async () => {
    if (Platform.OS === 'web' || !hydrated) return;
    const now = new Date();
    const prefs = await readPrefs();
    const plan = trailPlan(prefs, trailFestival(festivals, going, now), now);
    if (plan.do === 'stop') {
      await stopRecording();
      return;
    }
    if (plan.do === 'record') {
      // Said yes before: record once the phone allows it (asked for again only from the Trail screen).
      const perm = await trailPermission();
      if (perm === 'always' || perm === 'while-open') await startRecording(plan.festival.id, plan.until);
      return;
    }
    // A festival day and no answer yet: ask, once a day at most.
    if (asking.current) return;
    asking.current = true;
    const key = askKey(plan.festival.id, now);
    const decide = async (mode: 'ask' | 'on' | 'off') => {
      await writePrefs({ mode, askedFor: key });
      asking.current = false;
      if (mode === 'on') {
        await askTrailPermission();
        setAgain((n) => n + 1);
      }
    };
    showAlert(
      t('Keep a trail of your festival day?'),
      t('Afterglow can draw where you walk, only on festival days like today, and only on this phone. Turn it on to see your day on a map afterwards.'),
      [
        { text: t('Not now'), style: 'cancel', onPress: () => void decide('ask') },
        { text: t('Never'), onPress: () => void decide('off') },
        { text: t('Turn on'), onPress: () => void decide('on') },
      ],
    );
  }, [festivals, going, hydrated]);

  useEffect(() => {
    void check();
    const timer = setInterval(() => void check(), RECHECK_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void check());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [check, again]);

  return null;
}
