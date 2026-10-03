import { useEffect } from 'react';
import { useNow } from '../../lib/useNow';
import { announceFinished, updateQuestBook, useQuestBook } from '../../state/dailyQuests';
import { canDo, picksFor, settleQuests, turnOver } from './daily';
import { useQuestAvailability, useQuestSnapshot } from './useDailyQuests';

/**
 * Keeps the daily quests up to date: turns the day (and week) over, notices
 * quests as they're finished and tells the toast. Renders nothing.
 */
export function DailyQuestTracker() {
  const { book, loaded } = useQuestBook();
  const { snap, ready } = useQuestSnapshot();
  const ability = useQuestAvailability();
  const now = useNow().getTime();
  useEffect(() => {
    if (!loaded || !ready) return;
    const finished = updateQuestBook((current) => {
      let turned = turnOver(current, now, snap.counts);
      // The day's three are drawn once, when it begins, and kept.
      const picks = picksFor(turned, canDo(ability));
      if (!turned.picks) turned = { ...turned, picks: picks.map((p) => p.id) };
      const settled = settleQuests(turned, picks, snap);
      return { book: settled.book, extra: settled.finished };
    });
    announceFinished(finished);
  }, [book, loaded, snap, ready, ability, now]);
  return null;
}
