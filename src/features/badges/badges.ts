import type { Festival } from '../../data/models';
import { festivalMark } from '../profile/profileView';
import type { SharedMemory } from '../social/models';
import { runsOf } from '../festivals/when';
import { type PastEvent, pastKey } from '../memories/past';
import { LOCALE, months, t, tn } from '../../i18n';

/**
 * Festival badges, pure: a collectible enamel pin for every festival, earned
 * by sharing a video tagged with that festival and filmed there, on its
 * dates (from the video's own time; the morning after the last day counts,
 * since nights run past midnight). Worked out from the videos someone has
 * shared, so anyone can see anyone's badges and nobody can just claim one.
 */

export type Badge = {
  festivalId: string;
  /** When the first video that earned it was filmed (ISO). */
  earnedAt: string;
  /** How many shared videos were filmed there. */
  videos: number;
  /** The first of them, to watch from the badge. */
  firstId: string;
};

/** "YYYY-MM-DD" for a moment, in this phone's time. */
const localDay = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dayAfter = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const n = new Date(y, m - 1, d + 1);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

/** Filmed during the festival: on one of its days (either weekend), or the morning after one. */
export function filmedThere(festival: Pick<Festival, 'startDate' | 'endDate' | 'weekends'>, capturedAt: string): boolean {
  const day = localDay(capturedAt);
  if (!day) return false;
  return runsOf(festival as Festival).some((r) => day >= r.start && day <= dayAfter(r.end));
}

/** The badges a set of shared videos earn, the most recently earned first. */
export function earnedBadges(memories: readonly SharedMemory[], festivalOf: (id: string) => Festival | undefined): Badge[] {
  const byFestival = new Map<string, SharedMemory[]>();
  for (const m of memories) {
    const f = m.festivalId ? festivalOf(m.festivalId) : undefined;
    if (!f || !filmedThere(f, m.capturedAt)) continue;
    byFestival.set(f.id, [...(byFestival.get(f.id) ?? []), m]);
  }
  return [...byFestival.entries()]
    .map(([festivalId, list]) => {
      const first = [...list].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))[0];
      return { festivalId, earnedAt: first.capturedAt, videos: list.length, firstId: first.id };
    })
    .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
}

/** Festivals you're going to that aren't over and whose badge you haven't earned: the ones to collect. */
export function toCollect(going: readonly Festival[], earned: readonly Badge[], today: Date): Festival[] {
  const have = new Set(earned.map((b) => b.festivalId));
  const day = localDay(today.toISOString()) ?? '';
  return going.filter((f) => !have.has(f.id) && runsOf(f).some((r) => dayAfter(r.end) >= day));
}

/**
 * What a festival's pin shows: a scene that says which festival it is,
 * picked from its name and place (an eye for Cyclops Cove, a daisy for EDC,
 * a skyline for Austin, an infinity sign for Eternal, a clock for Countdown,
 * palms for the beach, mesas for the desert…), in its own enamel colours,
 * with its name and city in the rim and its dates on the ribbon.
 */
export type PinTheme = 'eye' | 'daisy' | 'skyline' | 'infinity' | 'clock' | 'fireworks' | 'beach' | 'desert' | 'lake' | 'castle' | 'sound' | 'dino';
/** The gold behind the round pin: sun rays, scallops, a star, or none. */
export type PinBacking = 'rays' | 'scallop' | 'star' | 'none';

export type PinPalette = {
  /** The sky, top to bottom. */
  sky: readonly [string, string];
  /** The scene's main colour, and a second one. */
  accent: string;
  accent2: string;
  /** The ground, sea or buildings. */
  ground: string;
  /** The rim's enamel band and the ribbon. */
  rim: string;
  ribbon: string;
};

export type PinLook = {
  theme: PinTheme;
  backing: PinBacking;
  palette: PinPalette;
  /** Around the rim: "CYCLOPS COVE 4 · BOCA RATON". */
  rimText: string;
  /** On the ribbon: "DEC 4–6 · 2026", or the year, or nothing. */
  ribbon?: string;
  /** For screen readers and small places: "CC4". */
  mark: string;
  /** A throwback (a past festival added from your camera roll): rose gold instead of gold, "THROWBACK" on the ribbon. */
  finish?: 'throwback';
};

/** Which scene: the first theme whose words appear in the festival's name or place. */
const THEME_WORDS: readonly [PinTheme, RegExp][] = [
  // Lost Lands is the dinosaur festival (a T. rex and a long neck by a smoking volcano), wherever it is.
  ['dino', /lost lands|dino|jurassic|prehistor/i],
  ['eye', /cyclops|\beye\b|vision/i],
  ['daisy', /\bedc\b|daisy|flower|bloom/i],
  ['infinity', /eternal|infinit|forever/i],
  ['clock', /countdown|midnight|clock/i],
  ['fireworks', /\bnye\b|new year/i],
  ['castle', /kingdom|castle|tomorrowland|realm/i],
  ['beach', /beach|cove|boca|miami|island|coast|bay\b|shore|ocean|sea\b|key west/i],
  ['desert', /desert|canyon|mesa|valley|coachella|arizona|vegas|sahara|dune/i],
  ['lake', /lake|forest|woods|mountain|pine|camp|river/i],
  ['skyline', /city|austin|chicago|york|downtown|metro|ultra|urban|limits/i],
];
const FALLBACK: readonly PinTheme[] = ['sound', 'fireworks', 'beach', 'lake', 'desert'];

/** Hand-picked enamel colours for each scene, two of each, so neighbours differ. */
export const PALETTES: Record<PinTheme, readonly PinPalette[]> = {
  eye: [
    { sky: ['#1B1464', '#0E7C86'], accent: '#5BE3B5', accent2: '#FFD166', ground: '#0B3D5C', rim: '#14123A', ribbon: '#0E7C86' },
    { sky: ['#3A0CA3', '#F72585'], accent: '#4CC9F0', accent2: '#FFE38A', ground: '#240046', rim: '#1A0B3B', ribbon: '#7209B7' },
  ],
  daisy: [
    { sky: ['#12005E', '#6A1B9A'], accent: '#FFFFFF', accent2: '#FFD166', ground: '#1F0A4D', rim: '#160A3A', ribbon: '#C2185B' },
    { sky: ['#0A2463', '#3E92CC'], accent: '#FDF0D5', accent2: '#FF7EB6', ground: '#0A1A40', rim: '#0B1638', ribbon: '#D81B60' },
  ],
  infinity: [
    { sky: ['#05051A', '#2B1055'], accent: '#FFE38A', accent2: '#FF7EB6', ground: '#120A2E', rim: '#0D0A24', ribbon: '#5A189A' },
    { sky: ['#0B0B2B', '#3C096C'], accent: '#E0AAFF', accent2: '#FFD166', ground: '#10002B', rim: '#0B0820', ribbon: '#7B2CBF' },
  ],
  clock: [
    { sky: ['#03045E', '#0077B6'], accent: '#F1F5F9', accent2: '#FF4D6D', ground: '#023E8A', rim: '#03023A', ribbon: '#C9184A' },
    { sky: ['#1A1A2E', '#16213E'], accent: '#E9ECEF', accent2: '#4CC9F0', ground: '#0F3460', rim: '#0E0E1F', ribbon: '#E94560' },
  ],
  fireworks: [
    { sky: ['#0B0A2E', '#2A1A5E'], accent: '#FFD166', accent2: '#4CC9F0', ground: '#0B0A2E', rim: '#0A0920', ribbon: '#3A0CA3' },
    { sky: ['#10002B', '#240046'], accent: '#FF7EB6', accent2: '#FFE38A', ground: '#10002B', rim: '#0B0018', ribbon: '#9D4EDD' },
  ],
  beach: [
    { sky: ['#FF7E5F', '#FEB47B'], accent: '#FFE66D', accent2: '#FF6B6B', ground: '#0F4C75', rim: '#2B1A3D', ribbon: '#FF6B6B' },
    { sky: ['#F72585', '#FFB86B'], accent: '#FFF3B0', accent2: '#FF5D8F', ground: '#1B4965', rim: '#2A0E30', ribbon: '#E63973' },
  ],
  desert: [
    { sky: ['#FF9E00', '#FF4800'], accent: '#FFF1C1', accent2: '#2D6A4F', ground: '#9C3D10', rim: '#3B1206', ribbon: '#D9480F' },
    { sky: ['#F4A261', '#E76F51'], accent: '#FFF3D6', accent2: '#2A9D8F', ground: '#8A3B12', rim: '#33140A', ribbon: '#C8553D' },
  ],
  lake: [
    { sky: ['#1D3557', '#A8DADC'], accent: '#F1FAEE', accent2: '#2A9D8F', ground: '#1B4332', rim: '#0D1F2D', ribbon: '#2D6A4F' },
    { sky: ['#22223B', '#9A8C98'], accent: '#F2E9E4', accent2: '#52B788', ground: '#081C15', rim: '#141428', ribbon: '#40916C' },
  ],
  castle: [
    { sky: ['#240046', '#C77DFF'], accent: '#FFE38A', accent2: '#FF7EB6', ground: '#3C096C', rim: '#1B0033', ribbon: '#7B2CBF' },
    { sky: ['#03045E', '#90E0EF'], accent: '#FFF3B0', accent2: '#F72585', ground: '#023E8A', rim: '#020236', ribbon: '#0077B6' },
  ],
  skyline: [
    { sky: ['#FF6F59', '#43AA8B'], accent: '#FFE66D', accent2: '#FF6F59', ground: '#1B263B', rim: '#141B2A', ribbon: '#BF4342' },
    { sky: ['#7209B7', '#F77F00'], accent: '#FCBF49', accent2: '#F72585', ground: '#14213D', rim: '#10172B', ribbon: '#D62828' },
  ],
  dino: [
    { sky: ['#0B2027', '#40798C'], accent: '#F6F1D1', accent2: '#7FB069', ground: '#0B3D2E', rim: '#081C15', ribbon: '#2D6A4F' },
    { sky: ['#2B0F1E', '#A63D40'], accent: '#FFE38A', accent2: '#8DB580', ground: '#1B1A17', rim: '#140B0B', ribbon: '#BC4749' },
  ],
  sound: [
    { sky: ['#10002B', '#5A189A'], accent: '#C77DFF', accent2: '#4CC9F0', ground: '#10002B', rim: '#0B0018', ribbon: '#7B2CBF' },
    { sky: ['#03071E', '#370617'], accent: '#FFBA08', accent2: '#F48C06', ground: '#03071E', rim: '#03030F', ribbon: '#9D0208' },
  ],
};
const BACKINGS: readonly PinBacking[] = ['rays', 'scallop', 'star', 'rays', 'none'];
const MONTHS = months(true).map((m) => m.toUpperCase());

/** A small, steady hash, so a festival's pin always looks the same. */
export function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The scene for a festival, from the words in its name and place. */
export function themeOf(festival: Pick<Festival, 'id' | 'name' | 'location'>): PinTheme {
  const words = `${festival.name} ${festival.location ?? ''}`;
  return THEME_WORDS.find(([, re]) => re.test(words))?.[0] ?? FALLBACK[hashOf(festival.id) % FALLBACK.length];
}

/** "DEC 4–6 · 2026", "DEC 31–JAN 1 · 2027", or just the year. */
export function ribbonText(festival: Pick<Festival, 'startDate' | 'endDate' | 'weekends'>): string | undefined {
  const start = festival.weekends?.[0]?.start ?? festival.startDate;
  if (!start) return undefined;
  const end = festival.weekends?.[festival.weekends.length - 1]?.end ?? festival.endDate ?? start;
  const m1 = MONTHS[Number(start.slice(5, 7)) - 1];
  const m2 = MONTHS[Number(end.slice(5, 7)) - 1];
  const d1 = Number(start.slice(8, 10));
  const d2 = Number(end.slice(8, 10));
  const year = end.slice(0, 4);
  if (end === start) return t('{month} {day} · {year}', { month: m1, day: d1, year });
  if (m1 === m2) return t('{month} {day1}–{day2} · {year}', { month: m1, day1: d1, day2: d2, year });
  return t('{month1} {day1}–{month2} {day2} · {year}', { month1: m1, day1: d1, month2: m2, day2: d2, year });
}

/** The town from a festival's place: "Sunset Cove Amphitheater, Boca Raton" -> "BOCA RATON". */
export function cityOf(location: string | undefined): string | undefined {
  return townOf(location)?.toUpperCase();
}

/** US states and countries that can end a place, after the town. */
const REGIONS = new RegExp(
  '^(' +
    [
      'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming', 'ontario', 'quebec', 'british columbia', 'alberta',
      'usa', 'u\\.s\\.a\\.', 'united states', 'canada', 'mexico', 'uk', 'united kingdom', 'england',
      '[a-z]{2}',
    ].join('|') +
    ')$',
  'i',
);

/**
 * The town as written: "Sunset Cove Amphitheater, Boca Raton" -> "Boca Raton", "Austin, Texas" -> "Austin",
 * "NOS Events Center, San Bernardino, CA" -> "San Bernardino" (states and countries at the end are skipped).
 */
export function townOf(location: string | undefined): string | undefined {
  const parts = (location ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  while (parts.length > 1 && REGIONS.test(parts[parts.length - 1])) parts.pop();
  return parts.length ? parts[parts.length - 1] : undefined;
}

/** How a festival's pin looks: its scene from its name and place, colours and backing from its id. */
export function pinLook(festival: Pick<Festival, 'id' | 'name' | 'location' | 'startDate' | 'endDate' | 'weekends'>): PinLook {
  const h = hashOf(festival.id);
  const theme = themeOf(festival);
  const options = PALETTES[theme];
  const name = festival.name.replace(/\s+20\d\d$/, '').toUpperCase();
  const city = cityOf(festival.location);
  const ribbon = ribbonText(festival);
  return {
    theme,
    backing: BACKINGS[Math.floor(h / 11) % BACKINGS.length],
    palette: options[Math.floor(h / 101) % options.length],
    rimText: city && !name.includes(city) ? `${name} · ${city}` : name,
    ...(ribbon ? { ribbon } : {}),
    mark: festivalMark(festival.name),
  };
}

/** "Earned Dec 5, 2026 · 3 videos". */
export function earnedLine(b: Badge): string {
  const d = new Date(b.earnedAt);
  const when = d.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' });
  return tn(b.videos, 'Earned {date} · {n} video', 'Earned {date} · {n} videos', { date: when });
}

/** The words that go with a shared badge: "I collected the Cyclops Cove 4 badge on Afterglow." and a link. */
export function badgeShareText(festivalName: string, link: string, mine: boolean, handle?: string): string {
  const words = mine
    ? t('I collected the {festival} badge on Afterglow. Only people who filmed there get one.', { festival: festivalName })
    : handle
      ? t('@{handle} collected the {festival} badge on Afterglow. Only people who filmed there get one.', { handle, festival: festivalName })
      : t('Collected: the {festival} badge on Afterglow. Only people who filmed there get one.', { festival: festivalName });
  return `${words}\n${link}`;
}

/** What a festival pin is, in a sentence. */
export function pinAbout(festival: Pick<Festival, 'name'>, collected: boolean): string {
  return collected
    ? t('Earned by filming a set at {festival}, on its dates. Every festival has its own pin, drawn from its name and where it is.', { festival: festival.name })
    : t('Film a set at {festival}, on its dates, to collect its pin. Every festival has its own, drawn from its name and where it is.', { festival: festival.name });
}

/**
 * Throwback badges: festivals from before Afterglow, added with a video from
 * your camera roll and tagged with that festival and year. Same scene as the
 * festival's own pin (from its name and town, or the same festival on
 * Afterglow), in rose gold, with "THROWBACK · 2024" on the ribbon: the gold
 * ones stay for filming there, on its dates.
 */
export type ThrowbackBadge = {
  key: string;
  past: PastEvent;
  /** When the first video was filmed (ISO). */
  earnedAt: string;
  videos: number;
  /** The first video's id (a memory on the phone, or a shared video). */
  firstId: string;
};

export function throwbackBadges(videos: readonly { id: string; capturedAt: string; past?: PastEvent }[]): ThrowbackBadge[] {
  const byKey = new Map<string, { past: PastEvent; list: { id: string; capturedAt: string }[] }>();
  for (const v of videos) {
    if (!v.past) continue;
    const k = pastKey(v.past);
    const entry = byKey.get(k) ?? { past: v.past, list: [] };
    entry.list.push(v);
    byKey.set(k, entry);
  }
  return [...byKey.entries()]
    .map(([key, { past, list }]) => {
      const first = [...list].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))[0];
      return { key, past, earnedAt: first.capturedAt, videos: list.length, firstId: first.id };
    })
    .sort((a, b) => b.past.year - a.past.year || b.earnedAt.localeCompare(a.earnedAt));
}

/** A throwback badge's page id: "past:edc-orlando-2024". */
export const THROWBACK = 'past:';
export const throwbackId = (key: string) => `${THROWBACK}${key}`;

/** The words that go with a shared throwback. */
export function throwbackShareText(p: PastEvent, link: string, mine: boolean, handle?: string): string {
  const words = mine
    ? t('I was at {festival} {year}. A throwback badge on Afterglow.', { festival: p.name, year: p.year })
    : handle
      ? t('@{handle} was at {festival} {year}. A throwback badge on Afterglow.', { handle, festival: p.name, year: p.year })
      : t('Throwback to {festival} {year}. A throwback badge on Afterglow.', { festival: p.name, year: p.year });
  return `${words}\n${link}`;
}

/** A past festival as a pin's festival: the same festival on Afterglow keeps its scene and colours. */
export const pastPinFestival = (p: PastEvent) => ({ id: p.seriesId ?? `past-${pastKey({ name: p.name, year: 0 })}`, name: p.name, location: p.city ?? '' });

export function throwbackLook(p: PastEvent): PinLook {
  return { ...pinLook(pastPinFestival(p)), ribbon: t('THROWBACK · {year}', { year: p.year }), finish: 'throwback' };
}

/** "Filmed Jul 14, 2024 · 3 videos". */
export function throwbackLine(b: ThrowbackBadge): string {
  const when = new Date(b.earnedAt).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' });
  return tn(b.videos, 'Filmed {date} · {n} video', 'Filmed {date} · {n} videos', { date: when });
}

/** What a throwback pin is, in a sentence. */
export function throwbackAbout(p: PastEvent): string {
  return t('A throwback to {festival} {year}, added from a video in your camera roll. Rose gold for the festivals you went to before Afterglow; gold ones are for filming there live.', { festival: p.name, year: p.year });
}
