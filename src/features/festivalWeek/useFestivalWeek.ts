import { useMemo } from 'react';
import type { Festival } from '../../data/models';
import { useToday } from '../../lib/useToday';
import { useCatalog } from '../../state/catalog';
import { useCrewUpdates } from '../../state/crewUpdates';
import { useCrews } from '../../state/crews';
import { useOpenedDoors } from '../../state/festivalWeek';
import { useGoing } from '../../state/going';
import { useNearby } from '../../state/nearby';
import { useRatings } from '../../state/ratings';
import { useFestivalPlan } from '../plan/useFestivalPlan';
import { warmupPlaylist } from '../plan/warmup';
import { usePrep } from '../prep/usePrep';
import { DOORS, doorFor, festivalWeek, isUnlocked, weekLine, type Door, type WeekFacts } from './week';

/**
 * A festival's week of doors, for one you're going to (as it is for you:
 * pass the festival after `forYou`). Undefined outside its last seven days,
 * or when you're not going.
 */
export function useFestivalWeek(festival: Festival):
  | { until: number; doors: (Door & { unlocked: boolean; opened: boolean })[]; line: string; ready: number }
  | undefined {
  const today = useToday();
  const { isGoing: goingTo } = useGoing();
  const catalog = useCatalog();
  const { ratings } = useRatings();
  const { picks } = useFestivalPlan(festival);
  const prep = usePrep(festival);
  const { crewsAt } = useCrews();
  const { meetSpotFor } = useCrewUpdates();
  const { placeOf } = useNearby();
  const opened = useOpenedDoors(festival.id);
  const week = festivalWeek(festival, today);
  const isGoing = goingTo(festival.id);

  const crew = crewsAt(festival.id)[0];
  const meet = crew ? meetSpotFor(crew.id)?.text : undefined;
  const facts = useMemo<WeekFacts>(() => {
    const warm = warmupPlaylist(picks, catalog.clipsOf);
    return {
      festivalName: festival.name,
      topPicks: picks.filter((p) => p.tier === 'must-see').map((p) => p.artist.name),
      leftToRate: festival.lineup.filter((a) => !ratings[a]).length,
      lineup: festival.lineup.length,
      ...(warm ? { warmup: { url: warm.url, count: warm.artists.length } } : {}),
      clips: festival.lineup.reduce((n, a) => n + catalog.clipsOf(a).length, 0),
      ...(crew ? { crew: { id: crew.id, name: crew.name, people: crew.members.length, ...(meet ? { meetSpot: meet } : {}) } } : {}),
      prep: prep.progress,
      setTimes: !!festival.sets?.length,
      onMap: !!placeOf(festival),
    };
  }, [festival, picks, catalog, ratings, crew, meet, prep.progress, placeOf]);

  if (!week || !isGoing) return undefined;
  const doors = DOORS.map((d) => ({ ...doorFor(d, facts), unlocked: isUnlocked(d, week.until), opened: opened.has(d) }));
  return { until: week.until, doors, line: weekLine(week.until, opened), ready: doors.filter((d) => d.unlocked && !d.opened).length };
}
