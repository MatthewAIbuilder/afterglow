import type { Festival } from '../../data/models';
import { t } from '../../i18n';
import { PARTNER_NOTE, shopNotes, stayLinkOf } from '../partners/partners';

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
  /** A partner link under the item while it isn't ticked: where to stay, or where to buy it. */
  link?: { url: string; label: string };
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
  /** Shop links for pack items (item id -> https link); none by default. */
  shop?: Readonly<Record<string, string>>;
};

/** Enough of the lineup rated to shape a good plan. */
export const RATED_ENOUGH = 10;

const PACK = [
  { id: 'id', label: t('Photo ID') },
  { id: 'power', label: t('Phone charger or power bank') },
  { id: 'earplugs', label: t('Earplugs') },
  { id: 'water', label: t('Refillable water bottle') },
  { id: 'sun', label: t('Sunscreen and sunglasses') },
  { id: 'rain', label: t('Something for the rain') },
  { id: 'meet', label: t('A meeting spot if you lose your friends') },
];

export function prepChecklist(i: PrepInput): PrepSection[] {
  const tick = (id: string) => i.ticked.has(id);
  const enough = Math.min(RATED_ENOUGH, i.lineup);
  const plan: PrepItem[] = [
    {
      id: 'rate',
      label: t('Rate the lineup'),
      detail: i.lineup ? t('{n} of {total} rated', { n: i.rated, total: i.lineup }) : undefined,
      auto: true,
      done: i.lineup > 0 && i.rated >= enough,
      action: 'tune',
    },
    { id: 'stars', label: t('Star your must-sees'), detail: i.stars ? t('{n} starred', { n: i.stars }) : undefined, auto: true, done: i.stars > 0, action: 'festival' },
    ...(i.remindersPossible
      ? [{ id: 'reminders', label: t('Turn on reminders before each set'), auto: true, done: i.remindersOn, action: 'festival' as const }]
      : []),
  ];
  const multiDay = !!i.festival.startDate && !!i.festival.endDate && i.festival.endDate > i.festival.startDate;
  const before: PrepItem[] = [
    { id: 'ticket', label: t('Get your ticket'), done: tick('ticket'), ...(i.festival.links?.tickets ? { action: 'tickets' as const } : {}) },
    {
      id: 'travel',
      label: multiDay ? t('Sort travel and a place to stay') : t('Sort how you’re getting there and back'),
      done: tick('travel'),
      ...(stayLinkOf(i.festival) ? { link: { url: stayLinkOf(i.festival)!, label: t('Places to stay nearby') } } : {}),
    },
  ];
  const pack: PrepItem[] = PACK.map((p) => {
    const url = i.shop?.[p.id];
    return { ...p, done: tick(p.id), ...(url ? { link: { url, label: t('Shop') } } : {}) };
  });
  return [
    { title: t('Your plan'), items: plan },
    { title: t('Before you go'), items: before },
    { title: t('Pack'), items: pack },
  ];
}

/**
 * The commission notices a section needs, for the partner links it shows:
 * where to stay and partner ticket links ("Before you go"), shop links (Pack).
 */
export function sectionNotes(section: PrepSection, festival: Festival): string[] {
  const shop = section.items.filter((x) => x.link && x.id !== 'travel').map((x) => x.link!.url);
  const partner = section.items.some((x) => (x.id === 'travel' && !!x.link) || (x.action === 'tickets' && !!festival.links?.ticketsPartner));
  return [...(partner ? [PARTNER_NOTE] : []), ...shopNotes(shop)];
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
