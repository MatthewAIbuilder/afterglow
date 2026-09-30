import type { Artist, Festival, SoundTag } from '../../data/models';
import { SOUND_LABEL } from '../../data/models';
import { whereWhen } from '../festivals/format';
import { isOver } from '../festivals/shelves';
import type { Notice } from '../notifications/inbox';
import type { CardLine, CardSection, PlanCard } from '../plan/share';
import { daysUntil } from '../festivals/when';
import { toShares } from '../taste/lean';
import { isWarm, type Ratings } from '../taste/ratings';

/**
 * Your festival, looked back on: once a festival is over, a card of what it
 * was for you, built only from what you did in the app (your videos there,
 * the sets you starred, the artists you love on its lineup). Pure. It shares
 * the plan card's look, so it goes out as a picture or as text.
 */
export type RecapInput = {
  festival: Festival;
  /** You said you were going. */
  going: boolean;
  /** Your videos tagged to this festival: who and which night. */
  memories: readonly { artistId?: string; night?: string }[];
  /** Artists you starred there. */
  stars: ReadonlySet<string>;
  ratings: Ratings;
  taste: Record<string, number>;
  artist: (id: string) => Artist | undefined;
  today: Date;
};

/** Most artists on the card. */
export const RECAP_ARTISTS = 6;

/** Whether there's a recap for you: the festival is over and you were part of it. */
export function hasRecap(i: Pick<RecapInput, 'festival' | 'going' | 'memories' | 'stars' | 'today'>): boolean {
  return isOver(i.festival, i.today) && (i.going || i.memories.length > 0 || i.stars.size > 0);
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Your artists there, strongest first: filmed, then starred, then loved; your match breaks ties. */
export function recapArtists(i: RecapInput): { artist: Artist; videos: number; starred: boolean; rating?: 'love' | 'like' }[] {
  const onLineup = new Set(i.festival.lineup);
  const videos = new Map<string, number>();
  for (const m of i.memories) if (m.artistId && onLineup.has(m.artistId)) videos.set(m.artistId, (videos.get(m.artistId) ?? 0) + 1);
  const ids = new Set([
    ...videos.keys(),
    ...[...i.stars].filter((a) => onLineup.has(a)),
    ...i.festival.lineup.filter((a) => isWarm(i.ratings[a])),
  ]);
  return [...ids]
    .map((id) => {
      const artist = i.artist(id);
      const r = i.ratings[id];
      const rating = r === 'love' || r === 'like' ? r : undefined;
      const v = videos.get(id) ?? 0;
      const starred = i.stars.has(id);
      const score = v * 3 + (starred ? 2 : 0) + (rating === 'love' ? 2 : rating === 'like' ? 1 : 0) + (i.taste[id] ?? 0);
      return artist ? { artist, videos: v, starred, rating, score } : undefined;
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.score - a.score)
    .map(({ score: _score, ...rest }) => rest);
}

/** The recap as a card: your artists, your nights, your sound there, and the numbers. Undefined when there's none. */
export function festivalRecap(i: RecapInput): PlanCard | undefined {
  if (!hasRecap(i)) return undefined;
  const artists = recapArtists(i);
  const sections: CardSection[] = [];

  if (artists.length) {
    const lines: CardLine[] = artists.slice(0, RECAP_ARTISTS).map((a) => ({
      name: a.artist.name,
      star: a.starred,
      where: [a.videos ? plural(a.videos, 'video') : '', a.rating === 'love' ? 'loved' : a.rating === 'like' ? 'liked' : ''].filter(Boolean).join(' · ') || undefined,
    }));
    sections.push({ heading: 'Your artists', lines, more: Math.max(0, artists.length - RECAP_ARTISTS) });
  }

  // Nights you filmed, in the festival's order.
  const perNight = new Map<string, number>();
  for (const m of i.memories) if (m.night) perNight.set(m.night, (perNight.get(m.night) ?? 0) + 1);
  if (perNight.size > 1) {
    const order = (d: string) => (i.festival.days.indexOf(d) === -1 ? 99 : i.festival.days.indexOf(d));
    const nights = [...perNight].sort((a, b) => order(a[0]) - order(b[0]));
    sections.push({ heading: 'Your nights', lines: nights.map(([night, n]) => ({ name: night, where: plural(n, 'video'), star: false })), more: 0 });
  }

  // Your sound there: the sounds of your artists, weighted as ranked.
  const weights: Partial<Record<SoundTag, number>> = {};
  artists.slice(0, 12).forEach((a, rank) => {
    const w = 1 / (1 + rank * 0.25);
    for (const [tag, v] of Object.entries(a.artist.sound) as [SoundTag, number][]) weights[tag] = (weights[tag] ?? 0) + v * w;
  });
  const shares = toShares(weights).slice(0, 3);
  if (shares.length) sections.push({ heading: 'Your sound there', lines: shares.map((s) => ({ name: SOUND_LABEL[s.tag], where: `${s.percent}%`, star: false })), more: 0 });

  const numbers: CardLine[] = [];
  if (i.memories.length) numbers.push({ name: 'Videos filmed', where: String(i.memories.length), star: false });
  const starred = [...i.stars].filter((a) => i.festival.lineup.includes(a)).length;
  if (starred) numbers.push({ name: 'Sets starred', where: String(starred), star: false });
  const loved = i.festival.lineup.filter((a) => isWarm(i.ratings[a])).length;
  if (loved) numbers.push({ name: 'Artists you love there', where: String(loved), star: false });
  if (numbers.length) sections.push({ heading: 'By the numbers', lines: numbers, more: 0 });

  return { title: i.festival.name, subtitle: `${whereWhen(i.festival)} · Your recap`, sections };
}

/** The recap as a message. */
export function recapText(card: PlanCard): string {
  const parts = [`My ${card.title}`, card.subtitle.replace(/ · Your recap$/, '')];
  for (const s of card.sections) {
    parts.push('', s.heading);
    for (const l of s.lines) parts.push(`${l.star ? '★ ' : ''}${l.name}${l.where ? `, ${l.where}` : ''}`);
    if (s.more) parts.push(`and ${s.more} more`);
  }
  parts.push('', 'Made with Afterglow');
  return parts.join('\n');
}

/** Recaps are news for this many days after the festival ends. */
export const RECAP_NEWS_DAYS = 60;

/** The bell: "Your recap of X is ready", for festivals with a recap that ended lately. */
export function recapNotices(festivals: readonly Festival[], today: Date): Notice[] {
  return festivals
    .filter((f) => {
      const sinceEnd = daysUntil({ ...f, startDate: f.endDate ?? f.startDate }, today);
      return sinceEnd !== undefined && sinceEnd < 0 && -sinceEnd <= RECAP_NEWS_DAYS;
    })
    .map((f) => ({
      id: `recap:${f.id}`,
      kind: 'recap' as const,
      festivalId: f.id,
      href: `/recap/${f.id}`,
      title: `Your recap of ${f.name} is ready`,
      body: 'Your artists, nights and sound there, ready to share.',
    }));
}
