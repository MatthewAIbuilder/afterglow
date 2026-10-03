import { useEffect, useState } from 'react';
import { useNow } from '../../lib/useNow';
import { announceFinished, updateQuestBook, useQuestBook } from '../../state/dailyQuests';
import { canDo, picksFor, settleQuests, turnOver } from './daily';
import { useQuestAvailability, useQuestSnapshot } from './useDailyQuests';

/**
 * Keeps the daily quests up to date: turns the day (and week) over, notices
 * quests as they're finished and tells the toast. Renders nothing.
 */
/** How long to wait for sign-in and crews before drawing the day's quests anyway. */
const SETTLE_WAIT_MS = 8000;

export function DailyQuestTracker() {
  const { book, loaded } = useQuestBook();
  const { snap, ready } = useQuestSnapshot();
  const ability = useQuestAvailability();
  const now = useNow().getTime();
  // The day's quests are drawn once everything they depend on has loaded (sign-in, your festivals,
  // your crews), so quests that need them aren't left out of the day; with no signal, after a short wait.
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), SETTLE_WAIT_MS);
    return () => clearTimeout(t);
  }, []);
  const settled = ability.settled !== false || waited;
  useEffect(() => {
    if (!loaded || !ready || !settled) return;
    const finished = updateQuestBook((current) => {
      let turned = turnOver(current, now, snap.counts);
      // The day's three are drawn once, when it begins, and kept.
      const picks = picksFor(turned, canDo(ability));
      if (!turned.picks) turned = { ...turned, picks: picks.map((p) => p.id) };
      const settled = settleQuests(turned, picks, snap);
      return { book: settled.book, extra: settled.finished };
    });
    announceFinished(finished);
  }, [book, loaded, snap, ready, ability, now, settled]);
  return null;
}
