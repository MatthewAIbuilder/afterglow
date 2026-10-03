import type { QuestId } from '../quests/quests';

/**
 * Milestone badges: a few quiet markers of your festival life, next to the
 * festival pins. Worked out on the phone from what you've done. Pure.
 */
export type MilestoneId = 'first-festival' | 'hopper' | 'ten' | 'first-moment' | 'moments' | 'collector' | 'crate' | 'basshead' | 'road' | 'og' | 'streak7' | 'streak30' | 'neon';

export type Milestone = {
  id: MilestoneId | QuestId;
  /** A side quest (something you did at a festival), not a milestone. */
  quest?: boolean;
  title: string;
  /** How you earn it, in a few words. */
  how: string;
  /** What it means, in a sentence: shown when you open it. */
  about: string;
  current: number;
  target: number;
  earned: boolean;
};

export type MilestoneInput = {
  /** Festivals you've been to (your passport's Been there). */
  been: number;
  /** Different towns among festivals you've been to or are going to. */
  cities: number;
  /** Videos you've filmed. */
  moments: number;
  /** Clips you've saved or liked. */
  kept: number;
  /** Artists you've rated. */
  rated: number;
  /** Artists you love or like whose sound is mostly dubstep or riddim. */
  bass: number;
  /** Your founder number, when you're one of the first 100. */
  founder?: number;
  /** The most days in a row you finished all three daily quests. */
  streak?: number;
  /** Your glow, all told (quests, side quests, badges, secrets). */
  glow?: number;
};

type Spec = { id: MilestoneId; title: string; how: string; about: string; target: number; value: (i: MilestoneInput) => number };

const SPECS: Spec[] = [
  { id: 'first-festival', title: 'First festival', how: 'Go to a festival', about: 'For your first festival on Afterglow: one you marked as going to that’s now over, or one you filmed at.', target: 1, value: (i) => i.been },
  { id: 'first-moment', title: 'First moment', how: 'Film a set', about: 'For the first set you filmed with Afterglow and kept in your Moments.', target: 1, value: (i) => i.moments },
  { id: 'crate', title: 'Crate digger', how: 'Rate 25 artists', about: 'For rating 25 artists. The more you rate, the sharper your matches and your plans get.', target: 25, value: (i) => i.rated },
  { id: 'collector', title: 'Set collector', how: 'Keep 25 clips', about: 'For saving or liking 25 live clips in Discover.', target: 25, value: (i) => i.kept },
  { id: 'basshead', title: 'Basshead', how: 'Love 10 dubstep or riddim artists', about: 'For loving or liking 10 artists whose sound is mostly dubstep or riddim.', target: 10, value: (i) => i.bass },
  { id: 'hopper', title: 'Festival hopper', how: 'Go to 5 festivals', about: 'For going to 5 festivals. Each one you’ve been to counts.', target: 5, value: (i) => i.been },
  { id: 'road', title: 'Road warrior', how: 'Festivals in 3 towns', about: 'For festivals in 3 different towns, ones you’ve been to or are going to.', target: 3, value: (i) => i.cities },
  { id: 'moments', title: 'Moment maker', how: 'Film 25 sets', about: 'For filming 25 sets and keeping them in your Moments.', target: 25, value: (i) => i.moments },
  { id: 'streak7', title: 'On a roll', how: 'A 7-day quest streak', about: 'For finishing all three daily quests seven days in a row.', target: 7, value: (i) => i.streak ?? 0 },
  { id: 'neon', title: 'Neon', how: 'Earn 450 glow', about: 'For reaching glow level 4, Neon: 450 glow from your quests, side quests, badges and secrets.', target: 450, value: (i) => i.glow ?? 0 },
  { id: 'streak30', title: 'Afterglow forever', how: 'A 30-day quest streak', about: 'For finishing all three daily quests every day for a month. That’s devotion.', target: 30, value: (i) => i.streak ?? 0 },
  { id: 'ten', title: '10 festivals', how: 'Go to 10 festivals', about: 'For going to 10 festivals. A proper festival life.', target: 10, value: (i) => i.been },
];

/** Every milestone, earned first (in the usual order), then the rest. Afterglow OG only for founders. */
export function milestones(input: MilestoneInput): Milestone[] {
  const list: Milestone[] = SPECS.map((s) => {
    const current = Math.max(0, Math.min(s.target, s.value(input)));
    return { id: s.id, title: s.title, how: s.how, about: s.about, current, target: s.target, earned: current >= s.target };
  });
  if (input.founder)
    list.unshift({
      id: 'og',
      title: 'Afterglow OG',
      how: `One of the first 100 · #${input.founder}`,
      about: `One of the first 100 people on Afterglow. You’re number ${input.founder}, and nobody else will ever be.`,
      current: 1,
      target: 1,
      earned: true,
    });
  return [...list.filter((m) => m.earned), ...list.filter((m) => !m.earned)];
}

/** The one you're closest to: the most done (as a share), then the smallest goal. */
export function nextMilestone(list: readonly Milestone[]): Milestone | undefined {
  return list
    .filter((m) => !m.earned)
    .sort((a, b) => b.current / b.target - a.current / a.target || a.target - b.target)[0];
}

/** "3 of 5". */
export const progressLine = (m: Milestone) => `${m.current} of ${m.target}`;

/** A badge's key in your claims: festival pins and milestones. */
export const pinKey = (festivalId: string) => `pin:${festivalId}`;
export const milestoneKey = (id: MilestoneId | QuestId) => `ms:${id}`;

/** Earned but not claimed yet, in the order given. */
export function unclaimed(earned: readonly string[], claimed: ReadonlySet<string>): string[] {
  return earned.filter((k, i) => !claimed.has(k) && earned.indexOf(k) === i);
}

/** Stored claims, cleaned: strings only, at most 500. */
export function cleanClaims(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((k): k is string => typeof k === 'string' && /^(pin|ms):[\w-]{1,80}$/.test(k)).slice(-500);
}
