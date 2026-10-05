import { SUPPORT_EMAIL } from '../../config/app';
import type { SocialUser, SupportMessage, SupportTopic } from '../social/models';
import { SUPPORT_TOPICS } from '../social/models';

/**
 * The support account's dashboard, pure: who it is, and the numbers turned
 * into plain sentences and day-by-day bars. Analytics are only counts read
 * from Afterglow's own database: nothing extra is collected about anyone.
 */

/** Signed in as the support account (its email). The dashboard still needs the email confirmed. */
export const isSupportAccount = (user: SocialUser | null | undefined) => !!user?.email && user.email.trim().toLowerCase() === SUPPORT_EMAIL;

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The start of the day `days` days before `now` (phone time), as ISO, for "since" queries. */
export function daysAgo(now: Date, days: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return d.toISOString();
}

export type DayCount = { key: string; label: string; n: number };

/** How many of these moments fall on each of the last `days` days, oldest first (today last). */
export function byDay(moments: readonly string[], days: number, now: Date): DayCount[] {
  const out: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push({ key: dayKey(d), label: `${MONTHS[d.getMonth()]} ${d.getDate()}`, n: 0 });
  }
  const index = new Map(out.map((d, i) => [d.key, i]));
  for (const m of moments) {
    const t = Date.parse(m.split('#')[0]);
    if (!Number.isFinite(t)) continue;
    const i = index.get(dayKey(new Date(t)));
    if (i !== undefined) out[i].n++;
  }
  return out;
}

/** This week (the last 7 days) and the week before, from a day-by-day count of 14 days. */
export function weeks(days: readonly DayCount[]): { thisWeek: number; lastWeek: number } {
  const n = (list: readonly DayCount[]) => list.reduce((a, d) => a + d.n, 0);
  return { thisWeek: n(days.slice(-7)), lastWeek: n(days.slice(-14, -7)) };
}

/** "12 new people this week, 3 more than the week before." */
export function weekLine(noun: { one: string; many: string }, w: { thisWeek: number; lastWeek: number }): string {
  const what = `${w.thisWeek} ${w.thisWeek === 1 ? noun.one : noun.many} this week`;
  const diff = w.thisWeek - w.lastWeek;
  if (!w.lastWeek && !w.thisWeek) return `No ${noun.many} yet this week.`;
  if (diff === 0) return `${what}, the same as the week before.`;
  return `${what}, ${Math.abs(diff)} ${diff > 0 ? 'more' : 'fewer'} than the week before.`;
}

export const topicLabel = (t: SupportTopic) => SUPPORT_TOPICS.find((x) => x.key === t)?.label ?? 'Something else';

export type SupportFilter = 'open' | 'answered' | 'closed' | 'all';
export const inFilter = (m: SupportMessage, f: SupportFilter) => f === 'all' || m.status === f;

/** "2 h ago", "3 days ago", "just now". */
export function agoShort(iso: string, now: number): string {
  const t = Date.parse(iso.split('#')[0]);
  const m = Math.max(0, Math.round((now - t) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** Replies you haven't seen yet: answered after the last time you looked. */
export const unseenReplies = (mine: readonly SupportMessage[], seenAt: number) => mine.filter((m) => m.reply && m.repliedAt && Date.parse(m.repliedAt) > seenAt).length;

/** A mailto link for an address that looks like one (no spaces, brackets or extra @), encoded; undefined otherwise. */
export function mailtoLink(email: string, subject: string): string | undefined {
  const e = email.trim();
  if (e.length > 254 || !/^[^\s@<>()[\]\\,;:"'?&#%/]+@[^\s@<>()[\]\\,;:"'?&#%/]+\.[A-Za-z]{2,}$/.test(e)) return undefined;
  const at = e.lastIndexOf('@');
  return `mailto:${encodeURIComponent(e.slice(0, at))}@${encodeURIComponent(e.slice(at + 1))}?subject=${encodeURIComponent(subject)}`;
}

export { DAY };
