import { useEffect } from 'react';
import { useNow } from '../../lib/useNow';
import { announceFinished, setQuestBook, useQuestBook } from '../../state/dailyQuests';
import { canDo, picksFor, settleQuests, turnOver } from './daily';
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
    let turned = turnOver(book, now, snap.counts);
    // The day's three are drawn once, when it begins, and kept.
    const picks = picksFor(turned, canDo({ planning, enoughSets }));
    if (!turned.picks) turned = { ...turned, picks: picks.map((p) => p.id) };
    const { book: settled, finished } = settleQuests(turned, picks, snap);
    if (settled !== book) setQuestBook(settled);
    announceFinished(finished);
  }, [book, loaded, snap, ready, planning, enoughSets, now]);
  return null;
}
