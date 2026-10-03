import type { AdminPresence, AdminVideo } from '../social/models';
import { type DayCount, byDay } from './admin';
import { localDay } from './presence';

/**
 * The dashboard's analytics, pure: who's active and who's drifted away,
 * who came back, and what people made, over a chosen range. Everything is
 * worked out on the support account's phone from records Afterglow already
 * keeps (when accounts opened the app, and when things were shared), so no
 * extra tracking is needed.
 */

export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];
export const RANGE_LABEL: Record<Range, string> = { 7: '7 days', 30: '30 days', 90: '90 days' };

/** Records read back for the charts: twice the longest range, so every range has a "before" to compare with. */
export const HISTORY_DAYS = 180;

const HOUR = 3_600_000;
const time = (iso: string) => Date.parse(iso.split('#')[0]);
const startOfDay = (now: Date, back: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - back).getTime();
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : undefined);

/** How many of these moments fall in the last `days` calendar days (today included). */
export function countIn(moments: readonly string[], days: number, now: Date): number {
  const from = startOfDay(now, days - 1);
  return moments.reduce((n, m) => (time(m) >= from ? n + 1 : n), 0);
}

/** How many fall in the `days` days before that, for "compared with the previous 30 days". */
export function countBefore(moments: readonly string[], days: number, now: Date): number {
  const from = startOfDay(now, 2 * days - 1);
  const to = startOfDay(now, days - 1);
  return moments.reduce((n, m) => {
    const t = time(m);
    return t >= from && t < to ? n + 1 : n;
  }, 0);
}

export type Trend = { now: number; before: number; change?: number };

/** This range against the one before it; `change` in whole percent (absent when there was nothing before). */
export function trend(moments: readonly string[], days: number, now: Date): Trend {
  const a = countIn(moments, days, now);
  const b = countBefore(moments, days, now);
  return { now: a, before: b, ...(b ? { change: Math.round(((a - b) / b) * 100) } : {}) };
}

/** "▲ 12% vs the previous 30 days", "▼ 3", "New", "" when there's nothing either side. */
export function trendLabel(t: Trend, days: number): string {
  if (!t.now && !t.before) return '';
  if (t.change === undefined) return `New in the last ${days} days`;
  if (t.change === 0) return `Same as the ${days} days before`;
  return `${t.change > 0 ? '▲' : '▼'} ${Math.abs(t.change)}% vs the ${days} days before`;
}

/** The running total at the end of each of the last `days` days, today last, ending at `total`. */
export function growth(total: number, moments: readonly string[], days: number, now: Date): DayCount[] {
  const daily = byDay(moments, days, now);
  const out: DayCount[] = [];
  let running = total;
  for (let i = daily.length - 1; i >= 0; i--) {
    out.unshift({ ...daily[i], n: Math.max(0, running) });
    running -= daily[i].n;
  }
  return out;
}

export type Share = { key: string; label: string; n: number; pct: number };

function shares(counts: Map<string, number>, label: (k: string) => string, max: number): Share[] {
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = sorted.slice(0, max);
  const rest = sorted.slice(max).reduce((a, [, n]) => a + n, 0);
  const list = top.map(([key, n]) => ({ key, label: label(key), n, pct: pct(n, total) ?? 0 }));
  if (rest) list.push({ key: 'other', label: 'Other', n: rest, pct: pct(rest, total) ?? 0 });
  return list;
}

const PLATFORM: Record<string, string> = { ios: 'iPhone', android: 'Android', web: 'Website' };
/** "Afterglow 1.0.0 · build 3f2a9c1" → "1.0.0 · 3f2a9c1". */
export const shortVersion = (v: string) => v.replace(/^Afterglow\s*/i, '').replace(' · build ', ' · ') || 'Unknown';

export type Bucket = { key: string; label: string; n: number };

export type PeopleStats = {
  /** Accounts with a last-active record (signed in at least once since it was added). */
  accounts: number;
  withProfile: number;
  onlineHour: number;
  today: number;
  week: number;
  month: number;
  /** Not seen in the last 30 days. */
  inactive: number;
  /** Of this month's people, the share who use it on a typical day (today ÷ this month). */
  stickiness?: number;
  /** Active this week who first came this week, and who'd been before. */
  newThisWeek: number;
  returningThisWeek: number;
  /** When each account was last seen, from today to long ago. */
  buckets: Bucket[];
  /** Of the people active this month. */
  platforms: Share[];
  versions: Share[];
  /** Average days active in the last 30, among this month's people. */
  daysPerMonth?: number;
};

export function peopleStats(list: readonly AdminPresence[], now: Date): PeopleStats {
  const today = startOfDay(now, 0);
  const week = startOfDay(now, 6);
  const month = startOfDay(now, 29);
  const hour = now.getTime() - HOUR;
  const monthKey = localDay(new Date(month));
  const buckets: Bucket[] = [
    { key: 'today', label: 'Today', n: 0 },
    { key: 'week', label: '2 to 7 days ago', n: 0 },
    { key: 'month', label: '8 to 30 days ago', n: 0 },
    { key: 'quarter', label: '1 to 3 months ago', n: 0 },
    { key: 'longer', label: 'Longer ago', n: 0 },
  ];
  const platforms = new Map<string, number>();
  const versions = new Map<string, number>();
  const s = { withProfile: 0, onlineHour: 0, today: 0, week: 0, month: 0, newThisWeek: 0, monthDays: 0 };
  for (const p of list) {
    const seen = time(p.lastSeenAt);
    if (!Number.isFinite(seen)) continue;
    if (p.hasProfile) s.withProfile++;
    if (seen >= hour) s.onlineHour++;
    const b = seen >= today ? 0 : seen >= week ? 1 : seen >= month ? 2 : seen >= startOfDay(now, 89) ? 3 : 4;
    buckets[b].n++;
    if (seen >= today) s.today++;
    if (seen >= week) {
      s.week++;
      if (time(p.firstSeenAt) >= week) s.newThisWeek++;
    }
    if (seen >= month) {
      s.month++;
      s.monthDays += Math.max(1, p.days.filter((d) => d >= monthKey).length);
      const pl = p.platform ?? 'unknown';
      platforms.set(pl, (platforms.get(pl) ?? 0) + 1);
      const v = p.version ? shortVersion(p.version) : 'Unknown';
      versions.set(v, (versions.get(v) ?? 0) + 1);
    }
  }
  return {
    accounts: list.length,
    withProfile: s.withProfile,
    onlineHour: s.onlineHour,
    today: s.today,
    week: s.week,
    month: s.month,
    inactive: list.length - s.month,
    ...(s.month ? { stickiness: pct(s.today, s.month), daysPerMonth: Math.round((s.monthDays / s.month) * 10) / 10 } : {}),
    newThisWeek: s.newThisWeek,
    returningThisWeek: s.week - s.newThisWeek,
    buckets,
    platforms: shares(platforms, (k) => PLATFORM[k] ?? 'Unknown', 4),
    versions: shares(versions, (k) => k, 4),
  };
}

/** How many accounts opened the app on each of the last `days` days (by the days they recorded), today last. */
export function dailyActive(list: readonly AdminPresence[], days: number, now: Date): DayCount[] {
  const out = byDay([], days, now);
  const index = new Map(out.map((d, i) => [d.key, i]));
  for (const p of list) for (const d of p.days) {
    const i = index.get(d);
    if (i !== undefined) out[i].n++;
  }
  return out;
}

const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + n));
};

export type Cohort = {
  label: string;
  /** People whose first visit was that week. */
  size: number;
  /** Came back on another day at all. */
  cameBack?: number;
  /** Came back a week or more after their first day (only once the cohort is that old). */
  afterWeek?: number;
  /** Used it in the last 7 days. */
  activeNow?: number;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (t: number) => {
  const d = new Date(t);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

/**
 * Who came back, by the week they arrived (7-day blocks back from today,
 * newest first): the share who returned on another day, a week or more
 * later, and who are still around this week. Everyone's own first day is
 * the first day on their record, in their own time.
 */
export function retention(list: readonly AdminPresence[], now: Date, weeksBack = 6): Cohort[] {
  const week = startOfDay(now, 6);
  const todayKey = localDay(now);
  const out: Cohort[] = [];
  for (let w = 0; w < weeksBack; w++) {
    const from = startOfDay(now, 7 * w + 6);
    const to = w === 0 ? Infinity : startOfDay(now, 7 * w - 1);
    const members = list.filter((p) => {
      const t = time(p.firstSeenAt);
      return t >= from && t < to;
    });
    let back = 0;
    let later = 0;
    let old = 0;
    let active = 0;
    for (const p of members) {
      const first = p.days[0] ?? localDay(new Date(time(p.firstSeenAt)));
      if (p.days.some((d) => d > first)) back++;
      const weekOn = addDays(first, 7);
      if (weekOn <= todayKey) {
        old++;
        if (p.days.some((d) => d >= weekOn)) later++;
      }
      if (time(p.lastSeenAt) >= week) active++;
    }
    out.push({
      label: `${short(from)} to ${short(Math.min(to === Infinity ? now.getTime() : to - 1, now.getTime()))}`,
      size: members.length,
      ...(members.length ? { cameBack: pct(back, members.length), activeNow: pct(active, members.length) } : {}),
      ...(old ? { afterWeek: pct(later, old) } : {}),
    });
  }
  return out;
}

/** Shares of the day each moment falls in, by hour (0 to 23, the support phone's time). */
export function byHour(moments: readonly string[]): number[] {
  const out = Array.from({ length: 24 }, () => 0);
  for (const m of moments) {
    const t = time(m);
    if (Number.isFinite(t)) out[new Date(t).getHours()]++;
  }
  return out;
}

/** "9 PM", "12 AM". */
export const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;

export type Ranked = { key: string; n: number };

/** The most common values, most first (ties A to Z), at most `max`. */
export function topBy<T>(items: readonly T[], keyOf: (t: T) => string | undefined, max: number): Ranked[] {
  const counts = new Map<string, number>();
  for (const t of items) {
    const k = keyOf(t);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([key, n]) => ({ key, n }));
}

export type ContentStats = {
  videos: Trend;
  creators: number;
  /** Of the people active in the range, the share who shared a video in it. */
  creatorShare?: number;
  perDay: number;
  avgLength?: number;
  likes: Trend;
  comments: Trend;
  follows: Trend;
  crews: Trend;
  /** Likes and comments per video shared in the range. */
  likesPerVideo?: number;
  commentsPerVideo?: number;
  topCreators: (Ranked & { handle?: string })[];
  topArtists: Ranked[];
  topFestivals: Ranked[];
  hours: number[];
  busiestHour?: number;
};

export function contentStats(
  a: { videos: readonly AdminVideo[]; likes: readonly string[]; comments: readonly string[]; follows: readonly string[]; crews: readonly string[] },
  activeInRange: number,
  days: number,
  now: Date,
): ContentStats {
  const from = startOfDay(now, days - 1);
  const vids = a.videos.filter((v) => time(v.createdAt) >= from);
  const videos = trend(
    a.videos.map((v) => v.createdAt),
    days,
    now,
  );
  const creators = new Set(vids.map((v) => v.uid)).size;
  const lengths = vids.map((v) => v.durationSec).filter((x): x is number => typeof x === 'number' && x > 0);
  const likes = trend(a.likes, days, now);
  const comments = trend(a.comments, days, now);
  const handles = new Map(vids.map((v) => [v.uid, v.handle]));
  const hours = byHour(vids.map((v) => v.createdAt));
  const peak = Math.max(...hours);
  return {
    videos,
    creators,
    ...(activeInRange ? { creatorShare: pct(Math.min(creators, activeInRange), activeInRange) } : {}),
    perDay: Math.round((vids.length / days) * 10) / 10,
    ...(lengths.length ? { avgLength: Math.round(lengths.reduce((x, y) => x + y, 0) / lengths.length) } : {}),
    likes,
    comments,
    follows: trend(a.follows, days, now),
    crews: trend(a.crews, days, now),
    ...(vids.length ? { likesPerVideo: Math.round((likes.now / vids.length) * 10) / 10, commentsPerVideo: Math.round((comments.now / vids.length) * 10) / 10 } : {}),
    topCreators: topBy(vids, (v) => v.uid, 5).map((r) => ({ ...r, handle: handles.get(r.key) })),
    topArtists: topBy(vids, (v) => v.artistId, 5),
    topFestivals: topBy(vids, (v) => v.festivalId, 5),
    hours,
    ...(peak > 0 ? { busiestHour: hours.indexOf(peak) } : {}),
  };
}

/** Accounts active in the last `days` days (for "the share of active people who shared"). */
export function activeIn(list: readonly AdminPresence[], days: number, now: Date): number {
  const from = startOfDay(now, days - 1);
  return list.filter((p) => time(p.lastSeenAt) >= from).length;
}

export type Alert = { tone: 'warn' | 'info'; text: string };

/** Things worth a look, in plain words, most urgent first. */
export function alerts(x: { supportOpen: number; reportsOpen: number; people?: PeopleStats; signups: Trend; days: number }): Alert[] {
  const out: Alert[] = [];
  if (x.reportsOpen) out.push({ tone: 'warn', text: `${x.reportsOpen} ${x.reportsOpen === 1 ? 'report needs' : 'reports need'} a look.` });
  if (x.supportOpen) out.push({ tone: 'warn', text: `${x.supportOpen} support ${x.supportOpen === 1 ? 'message is' : 'messages are'} waiting for a reply.` });
  if (x.signups.change !== undefined && x.signups.change <= -30 && x.signups.before >= 5)
    out.push({ tone: 'info', text: `Sign-ups are down ${Math.abs(x.signups.change)}% on the ${x.days} days before.` });
  if (x.signups.change !== undefined && x.signups.change >= 30 && x.signups.now >= 5)
    out.push({ tone: 'info', text: `Sign-ups are up ${x.signups.change}% on the ${x.days} days before.` });
  const p = x.people;
  if (p && p.accounts >= 10 && p.inactive / p.accounts >= 0.5) out.push({ tone: 'info', text: `${pct(p.inactive, p.accounts)}% of accounts haven’t opened the app in a month.` });
  return out;
}
