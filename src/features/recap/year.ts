import type { Artist, Festival } from '../../data/models';
import { SOUND_LABEL } from '../../data/models';
import { isOver } from '../festivals/shelves';
import type { CardLine, CardSection, PlanCard } from '../plan/share';
import { isWarm, type Ratings } from '../taste/ratings';
import type { SoundShare } from '../taste/lean';

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
};

/** Most lines per section on the year card. */
export const YEAR_LINES = 5;

const inYear = (day: string | undefined, year: number) => !!day && Number(day.slice(0, 4)) === year;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export type YearStats = {
  been: Festival[];
  coming: Festival[];
  videos: number;
  clips: number;
  loved: number;
  rated: number;
  top: { artist: Artist; videos: number }[];
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

  return { been, coming, videos: memories.length, clips, loved: lovedIds.length, rated, top };
}

/** Whether there's anything to show for the year yet. */
export function hasYear(s: YearStats): boolean {
  return s.been.length + s.coming.length + s.videos + s.clips + s.rated > 0;
}

export function yearCard(i: YearInput): PlanCard | undefined {
  const s = yearStats(i);
  if (!hasYear(s)) return undefined;
  const sections: CardSection[] = [];
  const cut = (heading: string, lines: CardLine[]) => sections.push({ heading, lines: lines.slice(0, YEAR_LINES), more: Math.max(0, lines.length - YEAR_LINES) });

  if (s.been.length) cut('Festivals', s.been.map((f) => ({ name: f.name, where: f.dates, star: false })));
  if (s.coming.length) cut(s.been.length ? 'Still to come' : 'Festivals ahead', s.coming.map((f) => ({ name: f.name, where: f.dates, star: false })));
  if (s.top.length) cut('Your top artists', s.top.map((t) => ({ name: t.artist.name, where: t.videos ? plural(t.videos, 'video') : undefined, star: false })));
  if (i.sounds.length) sections.push({ heading: 'Your sound', lines: i.sounds.slice(0, 3).map((x) => ({ name: SOUND_LABEL[x.tag], where: `${x.percent}%`, star: false })), more: 0 });

  const numbers: CardLine[] = [];
  const festivals = s.been.length + s.coming.length;
  if (festivals) numbers.push({ name: 'Festivals', where: String(festivals), star: false });
  if (s.videos) numbers.push({ name: 'Videos filmed', where: String(s.videos), star: false });
  if (s.clips) numbers.push({ name: 'Live clips watched', where: String(s.clips), star: false });
  if (s.loved) numbers.push({ name: 'Artists you love', where: String(s.loved), star: false });
  if (s.rated) numbers.push({ name: 'Artists rated', where: String(s.rated), star: false });
  if (numbers.length) sections.push({ heading: 'By the numbers', lines: numbers, more: 0 });

  const soFar = i.today.getFullYear() === i.year && i.today.getMonth() < 11;
  return { title: `Your ${i.year}`, subtitle: soFar ? 'Your festival year so far' : 'Your festival year', sections };
}

/** The year as a message. */
export function yearText(card: PlanCard): string {
  const parts = [`My ${card.title.replace(/^Your /, '')} on Afterglow`];
  for (const s of card.sections) {
    parts.push('', s.heading);
    for (const l of s.lines) parts.push(`${l.name}${l.where ? `, ${l.where}` : ''}`);
    if (s.more) parts.push(`and ${s.more} more`);
  }
  parts.push('', 'Made with Afterglow');
  return parts.join('\n');
}
