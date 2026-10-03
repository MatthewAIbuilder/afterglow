/**
 * Milestone badges: a few quiet markers of your festival life, next to the
 * festival pins. Worked out on the phone from what you've done. Pure.
 */
export type MilestoneId = 'first-festival' | 'hopper' | 'ten' | 'first-moment' | 'moments' | 'collector' | 'crate' | 'basshead' | 'road' | 'og';

export type Milestone = {
  id: MilestoneId;
  title: string;
  /** How you earn it, in a few words. */
  how: string;
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
};

type Spec = { id: MilestoneId; title: string; how: string; target: number; value: (i: MilestoneInput) => number };

const SPECS: Spec[] = [
  { id: 'first-festival', title: 'First festival', how: 'Go to a festival', target: 1, value: (i) => i.been },
  { id: 'first-moment', title: 'First moment', how: 'Film a set', target: 1, value: (i) => i.moments },
  { id: 'crate', title: 'Crate digger', how: 'Rate 25 artists', target: 25, value: (i) => i.rated },
  { id: 'collector', title: 'Set collector', how: 'Keep 25 clips', target: 25, value: (i) => i.kept },
  { id: 'basshead', title: 'Basshead', how: 'Love 10 dubstep or riddim artists', target: 10, value: (i) => i.bass },
  { id: 'hopper', title: 'Festival hopper', how: 'Go to 5 festivals', target: 5, value: (i) => i.been },
  { id: 'road', title: 'Road warrior', how: 'Festivals in 3 towns', target: 3, value: (i) => i.cities },
  { id: 'moments', title: 'Moment maker', how: 'Film 25 sets', target: 25, value: (i) => i.moments },
  { id: 'ten', title: '10 festivals', how: 'Go to 10 festivals', target: 10, value: (i) => i.been },
];

/** Every milestone, earned first (in the usual order), then the rest. Afterglow OG only for founders. */
export function milestones(input: MilestoneInput): Milestone[] {
  const list: Milestone[] = SPECS.map((s) => {
    const current = Math.max(0, Math.min(s.target, s.value(input)));
    return { id: s.id, title: s.title, how: s.how, current, target: s.target, earned: current >= s.target };
  });
  if (input.founder)
    list.unshift({ id: 'og', title: 'Afterglow OG', how: `One of the first 100 · #${input.founder}`, current: 1, target: 1, earned: true });
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
