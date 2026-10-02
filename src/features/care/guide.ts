/**
 * The timing guide in Look after yourself: when effects usually start, peak
 * and wear off, so a stopwatch can say where you probably are and, above
 * all, that not feeling it yet is no reason to take more. Harm reduction
 * only: typical time ranges from harm-reduction guides (DanceSafe, TripSit),
 * the risky mixes, and safety tips. It never says how much to take. The
 * ranges are broad on purpose; bodies, food, and what's really in a pill all
 * change them. Pure; kept on the phone, works with no signal.
 *
 * Reviewed figures before a public launch: see docs/app-store.md.
 */

/** A range in minutes, [earliest, latest]. */
export type Range = readonly [number, number];

export type GuideEntry = {
  id: string;
  name: string;
  /** How it's usually taken, which the timings are for. */
  how: string;
  /** Effects usually start between these minutes after taking it. */
  onset: Range;
  /** Usually strongest until about these minutes after. */
  peak: Range;
  /** Usually worn off by these minutes after. */
  total: Range;
  /** Safety tips, most important first. */
  tips: readonly string[];
};

export const GUIDE: readonly GuideEntry[] = [
  {
    id: 'alcohol',
    name: 'Alcohol',
    how: 'per drink',
    onset: [10, 30],
    peak: [30, 90],
    total: [120, 240],
    tips: ['Your body clears about one standard drink an hour, and nothing speeds that up.', 'Have water between drinks and eat something.'],
  },
  {
    id: 'mdma',
    name: 'MDMA / molly',
    how: 'swallowed',
    onset: [30, 90],
    peak: [90, 180],
    total: [240, 360],
    tips: [
      'It can take up to 2 hours on a full stomach. Taking more because you can’t feel it yet is a common way people get hurt.',
      'Overheating is the biggest danger: take breaks from dancing somewhere cool.',
      'Sip water, about a cup an hour while dancing. More isn’t better.',
      'Some antidepressants and other medicines are dangerous with it.',
    ],
  },
  {
    id: 'cannabis',
    name: 'Cannabis (smoked or vaped)',
    how: 'smoked or vaped',
    onset: [2, 10],
    peak: [15, 45],
    total: [120, 240],
    tips: ['Feeling too high passes. Sit somewhere calm, sip water and eat something.'],
  },
  {
    id: 'edible',
    name: 'Cannabis edible',
    how: 'eaten',
    onset: [30, 120],
    peak: [120, 240],
    total: [360, 720],
    tips: ['Edibles can take 2 hours or more to start. Don’t take more in the meantime.', 'It lasts a lot longer than smoking.'],
  },
  {
    id: 'mushrooms',
    name: 'Mushrooms',
    how: 'eaten',
    onset: [20, 60],
    peak: [90, 150],
    total: [240, 360],
    tips: ['If it gets intense, find a quiet spot and a friend. It passes.'],
  },
  {
    id: 'lsd',
    name: 'LSD / acid',
    how: 'on a tab',
    onset: [30, 90],
    peak: [120, 240],
    total: [480, 720],
    tips: ['It lasts most of the night. Don’t take more because it feels slow to start.', 'If it gets intense, find a quiet spot and a friend. It passes.'],
  },
  {
    id: 'ketamine',
    name: 'Ketamine',
    how: 'snorted',
    onset: [5, 15],
    peak: [15, 30],
    total: [45, 90],
    tips: ['Sit down somewhere safe before it hits: falls and getting lost are common.', 'Stay with a friend.'],
  },
  {
    id: 'cocaine',
    name: 'Cocaine',
    how: 'snorted',
    onset: [2, 5],
    peak: [15, 30],
    total: [30, 60],
    tips: ['It wears off fast, which makes taking more tempting. Keep count.', 'Hard on your heart, especially when you’re hot.'],
  },
  {
    id: 'speed',
    name: 'Speed (amphetamine)',
    how: 'swallowed',
    onset: [20, 60],
    peak: [60, 180],
    total: [240, 480],
    tips: ['Hard on your heart and temperature. Take breaks and sip water.', 'You may not feel tired or hungry: eat something anyway.'],
  },
  {
    id: 'ghb',
    name: 'GHB / G',
    how: 'swallowed',
    onset: [15, 45],
    peak: [45, 90],
    total: [90, 180],
    tips: ['The gap between feeling good and passing out is tiny.', 'Never with alcohol.', 'If someone can’t be woken, call for help straight away.'],
  },
  {
    id: 'nitrous',
    name: 'Nitrous / balloons',
    how: 'inhaled',
    onset: [0, 1],
    peak: [0, 1],
    total: [2, 5],
    tips: ['Sit down first, and never straight from a tank.'],
  },
];

/** Something not in the guide: no timeline, only the general advice. */
export const OTHER_ID = 'other';

/** Pairs that are riskier together than apart (not a full list). */
export const MIXES: readonly { a: string; b: string; why: string }[] = [
  { a: 'ghb', b: 'alcohol', why: 'Both slow your breathing. Together they’re one of the most common reasons people collapse at festivals.' },
  { a: 'ketamine', b: 'alcohol', why: 'Both slow you right down. Together you can pass out and be sick without waking.' },
  { a: 'ketamine', b: 'ghb', why: 'Both slow your breathing. Together they can make you pass out.' },
  { a: 'cocaine', b: 'alcohol', why: 'Together they make a third substance that’s harder on your heart than either.' },
  { a: 'mdma', b: 'alcohol', why: 'Both dry you out and make overheating harder to notice.' },
  { a: 'mdma', b: 'cocaine', why: 'Two stimulants push your heart rate and temperature up together.' },
  { a: 'mdma', b: 'speed', why: 'Two stimulants push your heart rate and temperature up together.' },
  { a: 'cocaine', b: 'speed', why: 'Two stimulants push your heart rate and temperature up together.' },
  { a: 'mdma', b: 'lsd', why: 'Together it can be much more intense than either. Have a sober friend close.' },
  { a: 'mdma', b: 'mushrooms', why: 'Together it can be much more intense than either. Have a sober friend close.' },
];

export const guideEntry = (id: string | undefined): GuideEntry | undefined => GUIDE.find((g) => g.id === id);

/** Risky pairs among what you've started (each pair once). */
export function riskyMixes(ids: readonly string[]): { a: GuideEntry; b: GuideEntry; why: string }[] {
  const have = new Set(ids);
  return MIXES.filter((m) => have.has(m.a) && have.has(m.b)).map((m) => ({ a: guideEntry(m.a)!, b: guideEntry(m.b)!, why: m.why }));
}

/** "30 to 90 min", "4 to 6 h", "45 min to 2 h", "under a minute". */
export function rangeText([lo, hi]: Range): string {
  if (hi <= 1) return 'under a minute';
  const h = (m: number) => {
    const v = Math.round((m / 60) * 2) / 2;
    return `${v % 1 ? v.toFixed(1) : v}`;
  };
  if (hi <= 90) return `${lo} to ${hi} min`;
  if (lo < 60) return `${lo} min to ${h(hi)} h`;
  return `${h(lo)} to ${h(hi)} h`;
}

/** "90 min", "2 h", "1.5 h", "a minute": the latest something usually takes. */
export function upTo(m: number): string {
  if (m <= 1) return 'a minute';
  if (m <= 90) return `${m} min`;
  const v = Math.round((m / 60) * 2) / 2;
  return `${v % 1 ? v.toFixed(1) : v} h`;
}

export type Phase = 'waiting' | 'coming-up' | 'peak' | 'wearing-off' | 'after';
export const PHASES: readonly Phase[] = ['waiting', 'coming-up', 'peak', 'wearing-off', 'after'];

/**
 * Where you probably are, `minutes` after you last took it: a short title,
 * one line of what that means, and how far along the usual window you are
 * (0 to 1, for the bar). Undefined for something not in the guide.
 */
export function phaseAt(entry: GuideEntry | undefined, minutes: number): { phase: Phase; title: string; line: string; progress: number } | undefined {
  if (!entry) return undefined;
  const t = Math.max(0, minutes);
  const progress = Math.min(1, t / entry.total[1]);
  if (t < entry.onset[0])
    return { phase: 'waiting', title: 'Waiting', line: `Usually starts in ${rangeText(entry.onset)}. Not feeling it yet is normal.`, progress };
  if (t < entry.onset[1])
    return { phase: 'coming-up', title: 'Coming up', line: `It can take up to ${upTo(entry.onset[1])}. Wait before taking any more.`, progress };
  if (t < entry.peak[1]) return { phase: 'peak', title: 'Around the strongest', line: 'Take a break somewhere cool, and sip water.', progress };
  if (t < entry.total[1]) return { phase: 'wearing-off', title: 'Wearing off', line: `It usually lasts ${rangeText(entry.total)} in all.`, progress };
  return { phase: 'after', title: 'Should have worn off', line: 'Still feeling strong effects? Tell a friend or find a medic.', progress: 1 };
}

/** Where each phase starts on the bar, as a share of the whole usual window. */
export function phaseMarks(entry: GuideEntry): { onset: number; peak: number; end: number } {
  const all = entry.total[1];
  return { onset: entry.onset[0] / all, peak: entry.onset[1] / all, end: entry.peak[1] / all };
}

/**
 * Taking more now would be too soon: before the latest it usually takes to
 * start (and for a general stopwatch, before 2 hours).
 */
export function tooSoon(entry: GuideEntry | undefined, minutesSinceLast: number): boolean {
  return minutesSinceLast < (entry ? Math.max(entry.onset[1], 15) : 120);
}

/** The warning before logging another one too soon. */
export function tooSoonLine(entry: GuideEntry | undefined, minutesSinceLast: number): string {
  const since = Math.max(0, Math.round(minutesSinceLast));
  const wait = entry ? `${entry.name} can take up to ${upTo(entry.onset[1])} to start` : 'Some things take up to 2 hours to start';
  return `It’s only been ${since} min. ${wait}. Taking more before it’s kicked in is one of the most common ways people get hurt.`;
}

/** A stopwatch face: "4:05", "12:09", "1:05:22". */
export function stopwatchText(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Before you take anything: the general advice that applies to all of it. */
export const BEFORE_ANYTHING: readonly string[] = [
  'Pills and powders are often not what they’re sold as, and fentanyl turns up in both. Test kits from DanceSafe help.',
  'Go slow, and don’t mix. Most emergencies come from taking more too soon or mixing things.',
  'Stay with friends, and tell one of them what you’ve taken.',
  'Medics are there to help, not to get anyone in trouble.',
];

/** Shown above the guide: what it is and isn't. */
export const GUIDE_NOTE = 'Typical times from harm-reduction guides. Everyone’s body is different, food changes things, and what you have may not be what you think. Never a guide to how much to take, and not medical advice.';
