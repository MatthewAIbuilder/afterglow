import type { Festival } from '../../data/models';

/**
 * Getting ready for a festival you're going to: what the app can see you've
 * done (rated the lineup, starred your must-sees, reminders on) and what only
 * you know (ticket, travel, what to pack), as one checklist. Pure.
 */
export type PrepItem = {
  id: string;
  label: string;
  detail?: string;
  /** Done because of something you did in the app (not ticked by hand). */
  auto?: boolean;
  done: boolean;
  /** Where to do it in the app, for items the app can see. */
  action?: 'tune' | 'festival' | 'tickets';
};
export type PrepSection = { title: string; items: PrepItem[] };

export type PrepInput = {
  festival: Festival;
  /** Artists on the lineup you've rated, and how many there are. */
  rated: number;
  lineup: number;
  stars: number;
  /** Set reminders can be switched on (set times out, dates line up), and whether they are. */
  remindersPossible: boolean;
  remindersOn: boolean;
  /** Items you ticked yourself. */
  ticked: ReadonlySet<string>;
};

/** Enough of the lineup rated to shape a good plan. */
export const RATED_ENOUGH = 10;

const PACK = [
  { id: 'id', label: 'Photo ID' },
  { id: 'power', label: 'Phone charger or power bank' },
  { id: 'earplugs', label: 'Earplugs' },
  { id: 'water', label: 'Refillable water bottle' },
  { id: 'sun', label: 'Sunscreen and sunglasses' },
  { id: 'rain', label: 'Something for the rain' },
  { id: 'meet', label: 'A meeting spot if you lose your friends' },
];

export function prepChecklist(i: PrepInput): PrepSection[] {
  const tick = (id: string) => i.ticked.has(id);
  const enough = Math.min(RATED_ENOUGH, i.lineup);
  const plan: PrepItem[] = [
    {
      id: 'rate',
      label: 'Rate the lineup',
      detail: i.lineup ? `${i.rated} of ${i.lineup} rated` : undefined,
      auto: true,
      done: i.lineup > 0 && i.rated >= enough,
      action: 'tune',
    },
    { id: 'stars', label: 'Star your must-sees', detail: i.stars ? `${i.stars} starred` : undefined, auto: true, done: i.stars > 0, action: 'festival' },
    ...(i.remindersPossible
      ? [{ id: 'reminders', label: 'Turn on reminders before each set', auto: true, done: i.remindersOn, action: 'festival' as const }]
      : []),
  ];
  const multiDay = !!i.festival.startDate && !!i.festival.endDate && i.festival.endDate > i.festival.startDate;
  const before: PrepItem[] = [
    { id: 'ticket', label: 'Get your ticket', done: tick('ticket'), ...(i.festival.links?.tickets ? { action: 'tickets' as const } : {}) },
    { id: 'travel', label: multiDay ? 'Sort travel and a place to stay' : 'Sort how you’re getting there and back', done: tick('travel') },
  ];
  const pack: PrepItem[] = PACK.map((p) => ({ ...p, done: tick(p.id) }));
  return [
    { title: 'Your plan', items: plan },
    { title: 'Before you go', items: before },
    { title: 'Pack', items: pack },
  ];
}

/** How many are done, of how many. */
export function prepProgress(sections: readonly PrepSection[]): { done: number; total: number } {
  const items = sections.flatMap((s) => s.items);
  return { done: items.filter((x) => x.done).length, total: items.length };
}

/** Clean what was stored: festival id -> ticked item ids. */
export function cleanPrep(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(raw)) if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === 'string').slice(0, 50);
  return out;
}
