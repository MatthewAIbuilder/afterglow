import type { Festival, FestivalPhase, SetTime } from './models';

/** Lookups within one festival's own data. Pure; no catalogue needed. */

export const stageName = (festival: Festival, stageId: string) =>
  festival.stages.find((s) => s.id === stageId)?.name ?? '';

export const setFor = (festival: Festival, artistId: string): SetTime | undefined =>
  festival.sets?.find((s) => s.artistId === artistId);

/** A lineup until set times are published, then a timetable. */
export const festivalPhase = (festival: Festival): FestivalPhase => (festival.sets?.length ? 'timetable' : 'lineup');
