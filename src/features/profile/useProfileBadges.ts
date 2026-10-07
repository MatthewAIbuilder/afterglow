import { useMemo, useState } from 'react';
import { toCollect } from '../badges/badges';
import { useBadges } from '../badges/useBadges';
import { useThrowbacks } from '../badges/useThrowbacks';
import { pastKey } from '../memories/past';
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
import { milestoneKey, milestones, pinKey, throwbackKey, unclaimed } from './milestones';
import { citiesOf, passport as makePassport } from './passport';
import { bestStreakOf } from '../quests/daily';
import { useDailyQuests } from '../quests/useDailyQuests';
import { useSprouts } from '../../state/sprouts';
import { useScouted } from '../../state/scouted';
import { useFinds } from '../../state/finds';
import { useKandi } from '../../state/kandi';
import { collection } from '../sprouts/collection';
import { artistLook } from '../sprouts/artistLook';
import { useGardenDecor } from '../sprouts/useGardenDecor';
import { isHolo } from '../finds/finds';
import { useMyShowcase } from '../sprouts/useMyShowcase';
import { useGardenGlows } from '../sprouts/useGardenGlows';

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
  const sprouts = useSprouts();
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
  // Throwbacks: past festivals added from your camera roll (yours even without a profile).
  const throwbacks = useThrowbacks(undefined);
  const goingFestivals = useMemo(() => groupFestivals(catalog.festivals.map(forYou), going, today).going, [catalog.festivals, forYou, going, today]);
  const collect = useMemo(() => toCollect(goingFestivals, badges, today), [goingFestivals, badges, today]);

  // Your festival passport (planning and been there), which some milestones count.
  const passport = useMemo(
    () => makePassport({ festivals: catalog.festivals.map(forYou), going, memories, badges: badges.map((b) => b.festivalId), loves, today }),
    [catalog.festivals, forYou, going, memories, badges, loves, today],
  );
  const standing = useStanding(me?.uid);
  const scouted = useScouted(social.user?.uid);
  // Collecting: kandi, shinies, stickers, gold, and how much of Your collection you have.
  const { finds } = useFinds();
  const kandi = useKandi();
  const decor = useGardenDecor();
  const showcase = useMyShowcase();
  const glows = useGardenGlows();
  const found = useMemo(() => new Set(finds.filter((f) => f.state === 'found').map((f) => f.creature)), [finds]);
  const book = useMemo(
    () =>
      collection({
        kinds: sprouts.collected,
        artists: sprouts.artists,
        catalogArtists: catalog.artists,
        lookOf: (id) => {
          const a = catalog.artist(id);
          return a ? artistLook(a) : undefined;
        },
        stickers: found,
        holo: finds.filter(isHolo).length,
        kandi: kandi.received,
        decor,
      }),
    [sprouts.collected, sprouts.artists, catalog, found, finds, kandi.received, decor],
  );
  const marks = useMemo(
    () =>
      milestones({
        // Past festivals count as festivals you've been to (each once), and their towns too.
        been: passport.been.length + throwbacks.length,
        cities: citiesOf([...passport.been, ...passport.planning], throwbacks.flatMap((t) => (t.past.city ? [t.past.city] : []))),
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
        bloomed: sprouts.garden.filter((g) => g.kind === 'seedling' && g.stage === 3 && g.shown !== 'seedling').length,
        given: sprouts.gifts.filter((g) => g.claimedBy).length,
        kinds: [...sprouts.collected].filter((k) => k !== 'seedling').length,
        scouted: scouted.length,
        kandi: kandi.received.length,
        shiny: book.shiny,
        stickers: finds.filter((f) => f.state === 'found').length,
        gold: sprouts.artists.filter((a) => a.tier === 3).length,
        collected: book.total ? Math.floor((book.have / book.total) * 100) : 0,
        decor: decor.length,
        pinned: showcase.pinned.length,
        completeSets: book.sets.filter((x) => x.total > 0 && x.have === x.total).length,
        glows: glows.length,
      }),
    [glows.length, decor.length, showcase.pinned.length, book, kandi.received.length, finds, sprouts.artists, scouted.length, passport, throwbacks, memories.length, kept, ratings, catalog, standing?.founder, daily.book, daily.level.glow, sprouts.garden, sprouts.gifts, sprouts.collected],
  );
  // Side quests: done ones come from the log, so they stay done.
  const quests = useQuests();
  const questList = useMemo(() => questBadges(quests.progress, quests.log), [quests.progress, quests.log]);
  const earned = badges.length + throwbacks.length + marks.filter((m) => m.earned).length + questList.filter((m) => m.earned).length;

  // Earned but not claimed: a banner, a New tag, and the unlock when you claim one.
  const { claimed, claim } = useBadgeClaims();
  const unclaimedKeys = useMemo(
    () =>
      claimed
        ? unclaimed([...badges.map((b) => pinKey(b.festivalId)), ...throwbacks.map((t) => throwbackKey(t.key)), ...questList.filter((m) => m.earned).map((m) => milestoneKey(m.id)), ...marks.filter((m) => m.earned).map((m) => milestoneKey(m.id))], claimed)
        : [],
    [claimed, badges, throwbacks, marks, questList],
  );
  const [unlock, setUnlock] = useState<Unlock | undefined>();
  const unlockFor = (key: string): Unlock | undefined => {
    if (key.startsWith('pin:')) {
      const f = catalog.festival(key.slice(4));
      return f ? { kind: 'pin', festival: f } : undefined;
    }
    if (key.startsWith('past:')) {
      const t = throwbacks.find((x) => throwbackKey(x.key) === key);
      return t ? { kind: 'throwback', past: t.past } : undefined;
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
    if (!unlock || unlock.kind === 'sprout' || unlock.kind === 'artistSprout' || unlock.kind === 'decor') return setUnlock(undefined);
    claim(unlock.kind === 'pin' ? pinKey(unlock.festival.id) : unlock.kind === 'throwback' ? throwbackKey(pastKey(unlock.past)) : milestoneKey(unlock.milestone.id));
    setUnlock(undefined);
  };

  return { badges, throwbacks, collect, passport, marks, questList, earned, kept, unclaimedKeys, unlock, setUnlock, claimNext, finishUnlock };
}

export type ProfileBadges = ReturnType<typeof useProfileBadges>;
