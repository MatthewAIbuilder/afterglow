import type { QuestId } from '../quests/quests';
import { t } from '../../i18n';

/**
 * Milestone badges: a few quiet markers of your festival life, next to the
 * festival pins. Worked out on the phone from what you've done. Pure.
 */
export type MilestoneId = 'first-festival' | 'hopper' | 'ten' | 'first-moment' | 'moments' | 'collector' | 'crate' | 'basshead' | 'road' | 'og' | 'streak7' | 'streak30' | 'neon' | 'green' | 'giver' | 'gardener' | 'scout' | 'kandi' | 'lucky' | 'hunter' | 'golden' | 'halfway' | 'lit' | 'display' | 'complete' | 'glowing' | 'roamer';

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
  /** Plain sprouts you've grown to bloom. */
  bloomed?: number;
  /** Sprouts you gave that someone picked up. */
  given?: number;
  /** Sprout kinds in your garden (not counting plain ones). */
  kinds?: number;
  /** Festivals whose set times you sent and Afterglow put live. */
  scouted?: number;
  /** Kandi in your garden that people gave you. */
  kandi?: number;
  /** Shiny artist collectibles you have. */
  shiny?: number;
  /** Stickers you've found in the wild. */
  stickers?: number;
  /** Different festival places among the stickers you've found (porta potty, water, charging…). */
  places?: number;
  /** Artist collectibles you've filmed up to gold. */
  gold?: number;
  /** How much of Your collection you have, in percent. */
  collected?: number;
  /** Decorations in your garden's sky. */
  decor?: number;
  /** Cards pinned to your showcase. */
  pinned?: number;
  /** Sets in Your collection you've completed. */
  completeSets?: number;
  /** Glows visitors left on your garden. */
  glows?: number;
};

type Spec = { id: MilestoneId; title: string; how: string; about: string; target: number; value: (i: MilestoneInput) => number };

const SPECS: Spec[] = [
  { id: 'first-festival', title: t('First festival'), how: t('Go to a festival'), about: t('For your first festival on Afterglow: one you marked as going to that’s now over, or one you filmed at.'), target: 1, value: (i) => i.been },
  { id: 'first-moment', title: t('First moment'), how: t('Film a set'), about: t('For the first set you filmed with Afterglow and kept in your Moments.'), target: 1, value: (i) => i.moments },
  { id: 'crate', title: t('Crate digger'), how: t('Rate 25 artists'), about: t('For rating 25 artists. The more you rate, the sharper your matches and your plans get.'), target: 25, value: (i) => i.rated },
  { id: 'collector', title: t('Set collector'), how: t('Keep 25 clips'), about: t('For saving or liking 25 live clips in Discover.'), target: 25, value: (i) => i.kept },
  { id: 'basshead', title: t('Basshead'), how: t('Love 10 dubstep or riddim artists'), about: t('For loving or liking 10 artists whose sound is mostly dubstep or riddim.'), target: 10, value: (i) => i.bass },
  { id: 'hopper', title: t('Festival hopper'), how: t('Go to 5 festivals'), about: t('For going to 5 festivals. Each one you’ve been to counts.'), target: 5, value: (i) => i.been },
  { id: 'road', title: t('Road warrior'), how: t('Festivals in 3 towns'), about: t('For festivals in 3 different towns, ones you’ve been to or are going to.'), target: 3, value: (i) => i.cities },
  { id: 'moments', title: t('Moment maker'), how: t('Film 25 sets'), about: t('For filming 25 sets and keeping them in your Moments.'), target: 25, value: (i) => i.moments },
  { id: 'streak7', title: t('On a roll'), how: t('A 7-day quest streak'), about: t('For finishing all three daily quests seven days in a row.'), target: 7, value: (i) => i.streak ?? 0 },
  { id: 'neon', title: 'Neon', how: t('Earn 450 glow'), about: t('For reaching glow level 4, Neon: 450 glow from your quests, side quests, badges and secrets.'), target: 450, value: (i) => i.glow ?? 0 },
  { id: 'streak30', title: t('Afterglow forever'), how: t('A 30-day quest streak'), about: t('For finishing all three daily quests every day for a month. That’s devotion.'), target: 30, value: (i) => i.streak ?? 0 },
  { id: 'green', title: t('Green thumb'), how: t('Grow a sprout to bloom'), about: t('For growing a sprout all the way to bloom: festival days, giving, filming and watching sets all help.'), target: 1, value: (i) => i.bloomed ?? 0 },
  { id: 'giver', title: t('Kind soul'), how: t('Give 10 sprouts'), about: t('For giving 10 sprouts that people picked up. PLUR in action.'), target: 10, value: (i) => i.given ?? 0 },
  { id: 'gardener', title: t('Gardener'), how: t('Collect 8 sprout kinds'), about: t('For a garden with eight kinds of sprout in it, grown yourself or given to you.'), target: 8, value: (i) => i.kinds ?? 0 },
  { id: 'scout', title: t('Set scout'), how: t('Send set times that go live'), about: t('For sending a festival’s set times that Afterglow checked and put live for everyone. Thank you: every plan there became a schedule.'), target: 1, value: (i) => i.scouted ?? 0 },
  { id: 'kandi', title: t('Kandi collector'), how: t('Be given 5 kandi'), about: t('For five kandi bracelets in your garden, each one made for you by someone you met.'), target: 5, value: (i) => i.kandi ?? 0 },
  { id: 'lucky', title: t('Lucky'), how: t('Find a shiny collectible'), about: t('For a shiny collectible: one in twelve come out in rare colours. Pure luck, and it’s yours.'), target: 1, value: (i) => i.shiny ?? 0 },
  { id: 'hunter', title: t('Sticker hunter'), how: t('Find 5 stickers'), about: t('For finding five Afterglow stickers out in the wild and scanning them.'), target: 5, value: (i) => i.stickers ?? 0 },
  { id: 'roamer', title: t('Around the grounds'), how: t('Find stickers from 5 different places'), about: t('For finding stickers in five different corners of a festival: the loos, the water station, the charging tent and wherever else they hide.'), target: 5, value: (i) => i.places ?? 0 },
  { id: 'golden', title: t('Gold standard'), how: t('Film an artist 10 times'), about: t('For filming the same artist ten times: their collectible turned gold.'), target: 1, value: (i) => i.gold ?? 0 },
  { id: 'halfway', title: t('Halfway there'), how: t('Collect half of everything'), about: t('For collecting half of everything in Your collection: sprouts, collectibles, stickers and kandi.'), target: 50, value: (i) => i.collected ?? 0 },
  { id: 'lit', title: t('Under the lights'), how: t('Earn 3 garden decorations'), about: t('For three decorations in your garden’s sky, each earned by something you did: giving, festival days, luck, kandi, filming.'), target: 3, value: (i) => i.decor ?? 0 },
  { id: 'display', title: t('On display'), how: t('Pin 3 cards to your profile'), about: t('For a full showcase: three of your collectible cards pinned to your profile for everyone visiting to see.'), target: 3, value: (i) => i.pinned ?? 0 },
  { id: 'complete', title: t('Set complete'), how: t('Complete a set in Your collection'), about: t('For completing a whole set in Your collection: every one of them, nothing left in silhouette.'), target: 1, value: (i) => i.completeSets ?? 0 },
  { id: 'glowing', title: t('Glowing garden'), how: t('Get 10 glows on your garden'), about: t('For ten glows left on your garden by people who visited it and liked what they saw.'), target: 10, value: (i) => i.glows ?? 0 },
  { id: 'ten', title: t('10 festivals'), how: t('Go to 10 festivals'), about: t('For going to 10 festivals. A proper festival life.'), target: 10, value: (i) => i.been },
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
      how: t('One of the first 100 · #{n}', { n: input.founder }),
      about: t('One of the first 100 people on Afterglow. You’re number {n}, and nobody else will ever be.', { n: input.founder }),
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
export const progressLine = (m: Milestone) => t('{current} of {target}', { current: m.current, target: m.target });

/** A badge's key in your claims: festival pins and milestones. */
export const pinKey = (festivalId: string) => `pin:${festivalId}`;
export const milestoneKey = (id: MilestoneId | QuestId) => `ms:${id}`;
/** A throwback pin's claim key, from its past event's key. */
export const throwbackKey = (key: string) => `past:${key}`;

/** Earned but not claimed yet, in the order given. */
export function unclaimed(earned: readonly string[], claimed: ReadonlySet<string>): string[] {
  return earned.filter((k, i) => !claimed.has(k) && earned.indexOf(k) === i);
}

/** Stored claims, cleaned: strings only, at most 500. */
export function cleanClaims(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((k): k is string => typeof k === 'string' && /^(pin|ms):[\w-]{1,80}$/.test(k)).slice(-500);
}
