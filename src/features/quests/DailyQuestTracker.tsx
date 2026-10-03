import { useEffect } from 'react';
import { useNow } from '../../lib/useNow';
import { announceFinished, setQuestBook, useQuestBook } from '../../state/dailyQuests';
import { canDo, dailyPicks, lowerBase, settleQuests, turnOver } from './daily';
import { useQuestAvailability, useQuestSnapshot } from './useDailyQuests';

/**
 * Keeps the daily quests up to date: turns the day (and week) over, notices
 * quests as they're finished and tells the toast. Renders nothing.
 */
export function DailyQuestTracker() {
  const { book, loaded } = useQuestBook();
  const { snap, ready } = useQuestSnapshot();
  const { planning, enoughSets } = useQuestAvailability();
  const now = useNow().getTime();
  useEffect(() => {
    if (!loaded || !ready) return;
    const turned = lowerBase(turnOver(book, now, snap.counts), snap.counts);
    const { book: settled, finished } = settleQuests(turned, dailyPicks(turned.day, canDo({ planning, enoughSets })), snap);
    if (settled !== book) setQuestBook(settled);
    announceFinished(finished);
  }, [book, loaded, snap, ready, planning, enoughSets, now]);
  return null;
}
