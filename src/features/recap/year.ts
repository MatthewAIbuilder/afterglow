import type { Artist, Festival } from '../../data/models';
import { SOUND_LABEL } from '../../data/models';
import { isOver } from '../festivals/shelves';
import type { CardLine, CardSection, PlanCard } from '../plan/share';
import { isWarm, type Ratings } from '../taste/ratings';
import type { SoundShare } from '../taste/lean';
import { datesLine } from '../festivals/format';
import { distanceText } from '../care/trail';
import { type SeenSet, type SetVerdict, VERDICT_LABEL } from '../seen/seen';
import type { Notice } from '../notifications/inbox';
import { t, tn } from '../../i18n';

/**
 * Your year on Afterglow: the festivals you went to (and those still to come),
 * your top artists, your sound, and the numbers, as a card to share. Pure,
 * built only from what's on your phone.
 */
export type YearInput = {
  year: number;
  festivals: readonly Festival[];
  going: readonly string[];
  /** Your videos: when they were filmed, where and who. */
  memories: readonly { capturedAt: string; festivalId?: string; artistId?: string }[];
  /** When each clip was last on screen (ms). */
  seen: Readonly<Record<string, number>>;
  ratings: Ratings;
  taste: Record<string, number>;
  informed: Record<string, boolean>;
  /** Your top sounds now (`tasteMix`). */
  sounds: readonly SoundShare[];
  artist: (id: string) => Artist | undefined;
  today: Date;
  /** Sets you saw (rated or said you were at), any year. */
  setsSeen?: readonly SeenSet[];
  /** How far your festival trail says you walked, by festival (meters). */
  walked?: Readonly<Record<string, number>>;
  miles?: boolean;
  /** When each fit check was taken (ms). */
  fits?: readonly number[];
};

/** Most lines per section on the year card. */
export const YEAR_LINES = 5;

const inYear = (day: string | undefined, year: number) => !!day && Number(day.slice(0, 4)) === year;

export type YearStats = {
  been: Festival[];
  coming: Festival[];
  videos: number;
  clips: number;
  loved: number;
  rated: number;
  top: { artist: Artist; videos: number }[];
  /** Sets you saw that year. */
  sets: number;
  /** Who you saw live most (more than once), most first. */
  seenMost: { artist: Artist; times: number }[];
  /** Your set of the year: the latest Unreal (or else Great) one. */
  setOfYear?: { artist: Artist; festival?: Festival; verdict: SetVerdict };
  walkedMeters: number;
  fits: number;
};

export function yearStats(i: YearInput): YearStats {
  const going = new Set(i.going);
  const mine = i.festivals.filter((f) => going.has(f.id) && (inYear(f.startDate, i.year) || inYear(f.endDate, i.year)));
  const byStart = (a: Festival, b: Festival) => (a.startDate ?? '').localeCompare(b.startDate ?? '');
  const been = mine.filter((f) => isOver(f, i.today)).sort(byStart);
  const coming = mine.filter((f) => !isOver(f, i.today)).sort(byStart);
  const memories = i.memories.filter((m) => Number(m.capturedAt.slice(0, 4)) === i.year);
  const start = new Date(i.year, 0, 1).getTime();
  const end = new Date(i.year + 1, 0, 1).getTime();
  const clips = Object.values(i.seen).filter((at) => at >= start && at < end).length;
  const rated = Object.keys(i.ratings).length;
  const lovedIds = Object.keys(i.ratings).filter((id) => isWarm(i.ratings[id]));

  // Top artists: the ones you filmed most, then those you love, then your strongest matches.
  const filmed = new Map<string, number>();
  for (const m of memories) if (m.artistId) filmed.set(m.artistId, (filmed.get(m.artistId) ?? 0) + 1);
  const score = (id: string) => (filmed.get(id) ?? 0) * 3 + (i.ratings[id] === 'love' ? 2 : isWarm(i.ratings[id]) ? 1 : 0) + (i.informed[id] ? (i.taste[id] ?? 0) : 0);
  const candidates = new Set([...filmed.keys(), ...lovedIds, ...Object.keys(i.informed).filter((id) => i.informed[id] && (i.taste[id] ?? 0) >= 0.75)]);
  const top = [...candidates]
    .filter((id) => i.ratings[id] !== 'meh' && i.ratings[id] !== 'pass')
    .map((id) => ({ id, artist: i.artist(id), s: score(id) }))
    .filter((x): x is { id: string; artist: Artist; s: number } => !!x.artist)
    .sort((a, b) => b.s - a.s || a.artist.name.localeCompare(b.artist.name))
    .map((x) => ({ artist: x.artist, videos: filmed.get(x.id) ?? 0 }));

  // Sets you saw that year, who you saw most, and your set of the year.
  const yearSets = (i.setsSeen ?? []).filter((x) => x.at >= start && x.at < end);
  const times = new Map<string, number>();
  for (const x of yearSets) times.set(x.artistId, (times.get(x.artistId) ?? 0) + 1);
  const seenMost = [...times]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .flatMap(([id, n]) => {
      const artist = i.artist(id);
      return artist ? [{ artist, times: n }] : [];
    });
  const best = [...yearSets].sort((a, b) => b.at - a.at).find((x) => x.verdict === 'unreal') ?? [...yearSets].sort((a, b) => b.at - a.at).find((x) => x.verdict === 'great');
  const bestArtist = best ? i.artist(best.artistId) : undefined;
  const setOfYear = best && bestArtist ? { artist: bestArtist, festival: i.festivals.find((f) => f.id === best.festivalId), verdict: best.verdict! } : undefined;
  const yearIds = new Set(mine.map((f) => f.id));
  const walkedMeters = Object.entries(i.walked ?? {}).reduce((n, [id, m]) => n + (yearIds.has(id) ? m : 0), 0);
  const fits = (i.fits ?? []).filter((at) => at >= start && at < end).length;

  return { been, coming, videos: memories.length, clips, loved: lovedIds.length, rated, top, sets: yearSets.length, seenMost, ...(setOfYear ? { setOfYear } : {}), walkedMeters, fits };
}

/** Whether there's anything to show for the year yet. */
export function hasYear(s: YearStats): boolean {
  return s.been.length + s.coming.length + s.videos + s.clips + s.rated + s.sets > 0;
}

export function yearCard(i: YearInput): PlanCard | undefined {
  const s = yearStats(i);
  if (!hasYear(s)) return undefined;
  const sections: CardSection[] = [];
  const cut = (heading: string, lines: CardLine[]) => sections.push({ heading, lines: lines.slice(0, YEAR_LINES), more: Math.max(0, lines.length - YEAR_LINES) });

  if (s.been.length) cut(t('Festivals'), s.been.map((f) => ({ name: f.name, where: datesLine(f), star: false })));
  if (s.coming.length) cut(s.been.length ? t('Still to come') : t('Festivals ahead'), s.coming.map((f) => ({ name: f.name, where: datesLine(f), star: false })));
  if (s.setOfYear) sections.push({ heading: t('Your set of the year'), lines: [{ name: s.setOfYear.artist.name, where: [s.setOfYear.festival?.name, VERDICT_LABEL[s.setOfYear.verdict]].filter(Boolean).join(' · '), star: true }], more: 0 });
  if (s.seenMost.length) cut(t('Seen the most'), s.seenMost.map((x) => ({ name: x.artist.name, where: t('×{n}', { n: x.times }), star: false })));
  if (s.top.length) cut(t('Your top artists'), s.top.map((x) => ({ name: x.artist.name, where: x.videos ? tn(x.videos, '{n} video', '{n} videos') : undefined, star: false })));
  if (i.sounds.length) sections.push({ heading: t('Your sound'), lines: i.sounds.slice(0, 3).map((x) => ({ name: SOUND_LABEL[x.tag], where: `${x.percent}%`, star: false })), more: 0 });

  const numbers: CardLine[] = [];
  const festivals = s.been.length + s.coming.length;
  if (festivals) numbers.push({ name: t('Festivals'), where: String(festivals), star: false });
  if (s.sets) numbers.push({ name: t('Sets you saw'), where: String(s.sets), star: false });
  if (s.walkedMeters >= 100) numbers.push({ name: t('Walked'), where: distanceText(s.walkedMeters, !!i.miles), star: false });
  if (s.fits) numbers.push({ name: t('Fit checks'), where: String(s.fits), star: false });
  if (s.videos) numbers.push({ name: t('Videos filmed'), where: String(s.videos), star: false });
  if (s.clips) numbers.push({ name: t('Live clips watched'), where: String(s.clips), star: false });
  if (s.loved) numbers.push({ name: t('Artists you love'), where: String(s.loved), star: false });
  if (s.rated) numbers.push({ name: t('Artists rated'), where: String(s.rated), star: false });
  if (numbers.length) sections.push({ heading: t('By the numbers'), lines: numbers, more: 0 });

  const soFar = i.today.getFullYear() === i.year && i.today.getMonth() < 11;
  return { title: t('Your {year}', { year: i.year }), subtitle: soFar ? t('Your festival year so far') : t('Your festival year'), sections };
}

/** Whether a year card is for a year still going (its subtitle says "so far"). */
export const isYearSoFar = (card: Pick<PlanCard, 'subtitle'>) => card.subtitle === t('Your festival year so far');

/** The year as a message. */
export function yearText(card: PlanCard): string {
  const year = card.title.match(/\d{4}/)?.[0] ?? card.title.replace(/^Your /, '');
  const parts = [t('My {year} on Afterglow', { year })];
  for (const s of card.sections) {
    parts.push('', s.heading);
    for (const l of s.lines) parts.push(`${l.name}${l.where ? `, ${l.where}` : ''}`);
    if (s.more) parts.push(t('and {n} more', { n: s.more }));
  }
  parts.push('', t('Made with Afterglow'));
  return parts.join('\n');
}

/** Wrapped is news from December 1 to January 15 (for the year just gone). */
export function wrappedNotice(today: Date, hasYearFor: (year: number) => boolean): Notice | undefined {
  const m = today.getMonth();
  const d = today.getDate();
  const year = m === 11 ? today.getFullYear() : m === 0 && d <= 15 ? today.getFullYear() - 1 : undefined;
  if (year === undefined || !hasYearFor(year)) return undefined;
  return {
    id: `wrapped:${year}`,
    kind: 'recap',
    at: new Date(year, 11, 1, 10).getTime(),
    href: `/wrapped/${year}`,
    title: t('Your {year} Wrapped is ready', { year }),
    body: t('Your festivals, the sets you saw, your top artists and your sound. Tap to play it.'),
  };
}
