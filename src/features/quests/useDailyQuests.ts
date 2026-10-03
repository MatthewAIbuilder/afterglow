import { useMemo } from 'react';
import { useNow } from '../../lib/useNow';
import { useBadgeClaims } from '../../state/badgeClaims';
import { useCatalog } from '../../state/catalog';
import { useQuestBook } from '../../state/dailyQuests';
import { useFollowedArtists } from '../../state/followedArtists';
import { useGoing } from '../../state/going';
import { usePlan } from '../../state/plan';
import { useQuests } from '../../state/quests';
import { useRatings } from '../../state/ratings';
import { useReactions } from '../../state/reactions';
import { useSeen } from '../../state/seen';
import { useSecrets } from '../../state/secrets';
import { isOver } from '../festivals/shelves';
import { useToday } from '../../lib/useToday';
import { isWarm } from '../taste/ratings';
import { topSound } from '../taste/thisOrThat';
import {
  type Counters,
  type QuestAbility,
  canDo,
  type DailySpec,
  type QuestGo,
  type QuestSnapshot,
  type WeeklySpec,
  dailyCurrent,
  dailyPicks,
  dayStart,
  daysLitInWeek,
  levelOf,
  questDay,
  streakOf,
  totalGlow,
  turnsOverIn,
  weekRow,
  weeklyCurrent,
  weeklyPick,
} from './daily';
import { QUESTS } from './quests';

/** What the quests count from, once everything they count has loaded. */
export function useQuestSnapshot(): { snap: QuestSnapshot; ready: boolean } {
  const { reactions, hydrated: reacted } = useReactions();
  const { ratings, hydrated: rated } = useRatings();
  const { seen, hydrated: seenReady } = useSeen();
  const { followed, hydrated: followReady } = useFollowedArtists();
  const plan = usePlan();
  const catalog = useCatalog();
  const snap = useMemo<QuestSnapshot>(() => {
    const all = Object.values(reactions);
    const counts: Counters = {
      likes: all.filter((r) => r.liked).length,
      saves: all.filter((r) => r.saved).length,
      through: all.filter((r) => r.watched === 'through' || r.watched === 'replayed').length,
      rated: Object.keys(ratings).length,
      warm: Object.values(ratings).filter(isWarm).length,
      follows: followed.length,
      stars: plan.starCount,
    };
    const soundOf = (clipId: string) => {
      const clip = catalog.clip(clipId);
      return clip ? topSound(catalog.artist(clip.artistId)) : undefined;
    };
    return { counts, seen, soundOf };
  }, [reactions, ratings, followed, plan.starCount, seen, catalog]);
  return { snap, ready: reacted && rated && seenReady && followReady && plan.hydrated };
}

export type QuestRow = { spec: DailySpec; current: number; done: boolean };
export type WeekRow = { spec: WeeklySpec; current: number; done: boolean };

/**
 * Today's quests with how far along each is, this week's, your streak and
 * your glow level. `can` leaves out quests you can't do right now.
 */
export function useDailyQuests() {
  const { book, loaded } = useQuestBook();
  const { snap, ready } = useQuestSnapshot();
  const { planning, enoughSets } = useQuestAvailability();
  const now = useNow().getTime();
  const { log } = useQuests();
  const { claimed } = useBadgeClaims();
  const secrets = useSecrets();
  const day = book?.day ?? questDay(now);
  // Cheap enough to work out on every render (the React Compiler keeps it steady).
  const picks = dailyPicks(day, canDo({ planning, enoughSets }));
  const rows: QuestRow[] = picks.map((spec) => {
    const done = !!book?.done.includes(spec.id);
    const current = book ? dailyCurrent(spec, snap, book.base, book.events, dayStart(book.day)) : 0;
    return { spec, current: done ? spec.target : current, done };
  });
  let weekly: WeekRow | undefined;
  if (book) {
    const spec = weeklyPick(book.week);
    const current = book.weekDone ? spec.target : weeklyCurrent(spec, snap, book.weekBase, dayStart(book.week), daysLitInWeek(book));
    weekly = { spec, current, done: book.weekDone };
  }
  // Side quests count for your level; claimed badges too (but side quests only once).
  const sideDone = QUESTS.filter((q) => log[q.id]).length;
  const questKeys = new Set(QUESTS.map((q) => `ms:${q.id}`));
  const badgeCount = claimed ? [...claimed].filter((k) => !questKeys.has(k)).length : 0;
  const glow = totalGlow(book, sideDone, badgeCount, Object.keys(secrets.found).length);
  return {
    ready: loaded && ready && !!book,
    book,
    picks,
    rows,
    weekly,
    doneToday: rows.filter((r) => r.done).length,
    streak: book ? streakOf(book.lit, book.day) : 0,
    week: book ? weekRow(book.lit, book.day) : [],
    glow,
    level: levelOf(glow),
    turnsOver: turnsOverIn(now),
  };
}

/** Which quests make sense right now: starring sets needs a festival you're going to. */
export function useQuestAvailability(): QuestAbility {
  const { going } = useGoing();
  const catalog = useCatalog();
  const today = useToday();
  const planning = useMemo(() => catalog.festivals.some((f) => going.includes(f.id) && !isOver(f, today) && f.lineup.length > 0), [catalog.festivals, going, today]);
  const enoughSets = catalog.clips.filter((c) => c.source?.provider === 'youtube').length >= 6;
  return useMemo(() => ({ planning, enoughSets }), [planning, enoughSets]);
}

/** Where a quest's "Go" takes you. */
export function useQuestRoute(): (go: QuestGo | undefined) => string | undefined {
  const { going } = useGoing();
  const catalog = useCatalog();
  const today = useToday();
  const next = catalog.festivals.find((f) => going.includes(f.id) && !isOver(f, today));
  return (go) => (go === 'festival' ? (next ? `/festival/${next.id}` : '/festivals') : go);
}
