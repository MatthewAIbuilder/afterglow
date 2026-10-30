import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { notifyNow } from '../../lib/notifyNow';
import { useNotices } from '../../state/notices';

/** Lineup and show news already sent to this phone (`newsAlerted.v1`), so each comes once. */
export const NEWS_ALERTED_KEY = 'newsAlerted.v1';
/** At most this many news notifications at once (the rest wait in the bell). */
const AT_ONCE = 2;
const KEPT = 400;

/**
 * Show alerts on the phone: when the bell gets lineup news (an artist you'd
 * love added to a festival, a show near you) or set times come out for a
 * festival you're going to, a notification says so, once
 * each, never for news that was there before this phone first looked.
 * Draws nothing; not on the website (the bell is there).
 */
export function NewsAlerts() {
  return Platform.OS === 'web' ? null : <PhoneNewsAlerts />;
}

function PhoneNewsAlerts() {
  const { list, hydrated } = useNotices();
  const news = list.filter((n) => n.kind === 'lineup' || n.kind === 'setTimes');
  const key = news.map((n) => n.id).join('|');
  useEffect(() => {
    if (!hydrated) return;
    let live = true;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(NEWS_ALERTED_KEY);
        const had = raw ? new Set<string>(JSON.parse(raw) as string[]) : undefined;
        const fresh = had ? news.filter((n) => !had.has(n.id)) : [];
        if (!live) return;
        // The first look just takes note: nothing is news to someone who just arrived.
        for (const n of fresh.slice(0, AT_ONCE)) void notifyNow(`news:${n.id}`, n.title, n.body, n.href);
        const next = [...(had ?? []), ...news.map((n) => n.id)];
        if (!had || fresh.length) await AsyncStorage.setItem(NEWS_ALERTED_KEY, JSON.stringify([...new Set(next)].slice(-KEPT)));
      } catch {
        // Alerts are a nicety.
      }
    })();
    return () => {
      live = false;
    };
    // key stands for `news`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hydrated]);
  return null;
}
