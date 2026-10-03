import { useMemo, useState } from 'react';
import { toCollect } from '../badges/badges';
import { useBadges } from '../badges/useBadges';
import { yourClipCount, yourClips } from '../discover/saved';
import { groupFestivals } from '../festivals/going';
import { useStanding } from '../standing/useStanding';
import { questBadges } from '../quests/quests';
import { isWarm } from '../taste/ratings';
import { useToday } from '../../lib/useToday';
import { useBadgeClaims } from '../../state/badgeClaims';
import { useCatalog } from '../../state/catalog';
import { useClipPool } from '../../state/community';
import { useGoing } from '../../state/going';
import { useMemories } from '../../state/memories';
import { useQuests } from '../../state/quests';
import { useRatings } from '../../state/ratings';
import { useReactions } from '../../state/reactions';
import { useSocial } from '../../state/social';
import { useLoves } from '../../state/useLoves';
import { useWeekends } from '../../state/weekends';
import type { Unlock } from './BadgeCelebration';
import { milestoneKey, milestones, pinKey, unclaimed } from './milestones';
import { citiesOf, passport as makePassport } from './passport';
import { bestStreakOf } from '../quests/daily';
import { useDailyQuests } from '../quests/useDailyQuests';

/**
 * Everything your badges need, in one place, for the Profile tab and the
 * festival-mode Profile alike: festival pins (from shared videos), side
 * quests, milestones, which ones are earned but not claimed yet, and the
 * unlock to show when you claim one.
 */
export function useProfileBadges() {
  const social = useSocial();
  const me = social.profile;
  const catalog = useCatalog();
  // Daily quests: your best streak and glow level earn badges too.
  const daily = useDailyQuests();
  const today = useToday();
  const { going } = useGoing();
  const { forYou } = useWeekends();
  const { memories } = useMemories();
  const { ratings } = useRatings();
  const { reactions } = useReactions();
  const pool = useClipPool();
  const kept = useMemo(() => yourClipCount(yourClips(pool.clips, reactions)), [pool.clips, reactions]);
  const loves = useLoves();

  // Festival pins: from the videos you've shared, filmed at a festival on its dates.
  const { badges } = useBadges(me?.uid);
  const goingFestivals = useMemo(() => groupFestivals(catalog.festivals.map(forYou), going, today).going, [catalog.festivals, forYou, going, today]);
  const collect = useMemo(() => toCollect(goingFestivals, badges, today), [goingFestivals, badges, today]);

  // Your festival passport (planning and been there), which some milestones count.
  const passport = useMemo(
    () => makePassport({ festivals: catalog.festivals.map(forYou), going, memories, badges: badges.map((b) => b.festivalId), loves, today }),
    [catalog.festivals, forYou, going, memories, badges, loves, today],
  );
  const standing = useStanding(me?.uid);
  const marks = useMemo(
    () =>
      milestones({
        been: passport.been.length,
        cities: citiesOf([...passport.been, ...passport.planning]),
        moments: memories.length,
        kept,
        rated: Object.keys(ratings).length,
        bass: Object.entries(ratings).filter(([id, r]) => {
          const a = isWarm(r) ? catalog.artist(id) : undefined;
          return !!a && (a.sound.dubstep ?? 0) + (a.sound.riddim ?? 0) >= 0.5;
        }).length,
        founder: standing?.founder,
        streak: bestStreakOf(daily.book),
        glow: daily.level.glow,
      }),
    [passport, memories.length, kept, ratings, catalog, standing?.founder, daily.book, daily.level.glow],
  );
  // Side quests: done ones come from the log, so they stay done.
  const quests = useQuests();
  const questList = useMemo(() => questBadges(quests.progress, quests.log), [quests.progress, quests.log]);
  const earned = badges.length + marks.filter((m) => m.earned).length + questList.filter((m) => m.earned).length;

  // Earned but not claimed: a banner, a New tag, and the unlock when you claim one.
  const { claimed, claim } = useBadgeClaims();
  const unclaimedKeys = useMemo(
    () =>
      claimed
        ? unclaimed([...badges.map((b) => pinKey(b.festivalId)), ...questList.filter((m) => m.earned).map((m) => milestoneKey(m.id)), ...marks.filter((m) => m.earned).map((m) => milestoneKey(m.id))], claimed)
        : [],
    [claimed, badges, marks, questList],
  );
  const [unlock, setUnlock] = useState<Unlock | undefined>();
  const unlockFor = (key: string): Unlock | undefined => {
    if (key.startsWith('pin:')) {
      const f = catalog.festival(key.slice(4));
      return f ? { kind: 'pin', festival: f } : undefined;
    }
    const m = [...questList, ...marks].find((x) => milestoneKey(x.id) === key);
    return m ? { kind: 'milestone', milestone: m } : undefined;
  };
  const claimNext = () => {
    for (const key of unclaimedKeys) {
      const u = unlockFor(key);
      if (u) {
        setUnlock(u);
        return;
      }
      claim(key);
    }
  };
  const finishUnlock = () => {
    if (!unlock) return;
    claim(unlock.kind === 'pin' ? pinKey(unlock.festival.id) : milestoneKey(unlock.milestone.id));
    setUnlock(undefined);
  };

  return { badges, collect, passport, marks, questList, earned, kept, unclaimedKeys, unlock, setUnlock, claimNext, finishUnlock };
}

export type ProfileBadges = ReturnType<typeof useProfileBadges>;
