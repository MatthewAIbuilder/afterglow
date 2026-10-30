import type { Festival } from '../../data/models';
import { stageName } from '../../data/festival';
import { formatTime } from '../festivals/format';
import { clockTime, WALK_MINUTES } from '../plan/route';
import { dayStarts } from '../notifications/setReminders';
import { type CrewMeetup, type CrewMeetupInput, MEETUP_NOTE_MAX, MEETUP_PLACE_MAX } from '../social/models';
import type { CrewDay } from './crewRoute';
import { t } from '../../i18n';

/**
 * Crew meetups, pure: checking one before it's sent, which are coming up,
 * the reminders each phone schedules for them, and meetups the app suggests
 * when the crew splits up.
 */

/** A meetup can be set from a little in the past (you're already late) to a month ahead. */
export const MEETUP_PAST_MS = 60 * 60_000;
export const MEETUP_AHEAD_MS = 30 * 24 * 3600_000;
/** A meetup still shows for this long after its time (people are on their way). */
export const MEETUP_SHOWN_AFTER_MS = 45 * 60_000;
/** The reminder before a meetup. */
export const MEETUP_LEAD_MIN = 15;
export const MEETUP_PREFIX = 'afterglow-meetup:';

const tidy = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max);

/** A meetup ready to send, or what's wrong with it. */
export function cleanMeetupInput(input: CrewMeetupInput, now: number): { ok: true; value: CrewMeetupInput } | { ok: false; why: 'place' | 'time' } {
  const place = tidy(input.place ?? '', MEETUP_PLACE_MAX);
  if (!place) return { ok: false, why: 'place' };
  if (!Number.isFinite(input.atMs) || input.atMs < now - MEETUP_PAST_MS || input.atMs > now + MEETUP_AHEAD_MS) return { ok: false, why: 'time' };
  const note = tidy(input.note ?? '', MEETUP_NOTE_MAX);
  return { ok: true, value: { place, atMs: Math.round(input.atMs / 60_000) * 60_000, ...(note ? { note } : {}) } };
}

/** Meetups still to come (or only just past), soonest first. */
export function upcomingMeetups(list: readonly CrewMeetup[], now: number): CrewMeetup[] {
  return list.filter((m) => Date.parse(m.at) >= now - MEETUP_SHOWN_AFTER_MS).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

const clock = (ms: number) => {
  const d = new Date(ms);
  return formatTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
};
export const meetupTime = (m: Pick<CrewMeetup, 'at'>) => clock(Date.parse(m.at));

export type MeetupReminder = { id: string; at: Date; title: string; body: string; href: string };

/** On every member's phone: 15 minutes before each meetup, and at the time. */
export function meetupReminders(meetups: readonly { crewId: string; crewName: string; meetup: CrewMeetup }[], now: Date): MeetupReminder[] {
  const out: MeetupReminder[] = [];
  for (const { crewId, crewName, meetup } of meetups) {
    const at = Date.parse(meetup.at);
    if (!Number.isFinite(at)) continue;
    const v = { crew: crewName, place: meetup.place, time: clock(at), n: MEETUP_LEAD_MIN };
    const before = new Date(at - MEETUP_LEAD_MIN * 60_000);
    const href = `/crew/${crewId}`;
    if (before.getTime() > now.getTime()) out.push({ id: `${MEETUP_PREFIX}${crewId}:${meetup.id}:before:${at}`, at: before, title: t('Meet {crew} in {n} min', v), body: t('{place} at {time}.', v), href });
    if (at > now.getTime()) out.push({ id: `${MEETUP_PREFIX}${crewId}:${meetup.id}:now:${at}`, at: new Date(at), title: t('Time to meet {crew}', v), body: t('{place}, now.', v), href });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

// ---------------------------------------------------------------------------
// Splitting up, and finding each other again

export type SuggestedMeetup = {
  day: string;
  /** Minutes on the festival-day clock. */
  minute: number;
  atMs?: number;
  place: string;
  /** The sets the crew splits between. */
  split: { artist: string; who: string[] }[];
  /** What's on next together, when the meetup is at its stage. */
  before?: string;
};

/**
 * When the crew splits up for a set (`crewRoute`'s splits), where and when to
 * find each other again: the later of the two sets' ends plus a walk, at the
 * stage of the crew's next set together (or the crew's meeting spot when
 * there's none).
 */
export function suggestMeetups(festival: Festival, days: readonly CrewDay[], meetSpot: string | undefined, nameOf: (uid: string) => string): SuggestedMeetup[] {
  const starts = dayStarts(festival);
  const out: SuggestedMeetup[] = [];
  for (const day of days) {
    for (const split of day.splits) {
      const start = toMin(split.set.start);
      let end = toMin(split.set.end);
      if (end <= start) end += 24 * 60;
      // Where the rest of the crew is meanwhile, and when they leave it.
      const meanwhile = day.stops.find((s) => s.kind === 'set' && s.artist.id === split.during?.id && s.from < end && start < s.to);
      const apart = Math.max(end, meanwhile ? meanwhile.to : end);
      const minute = apart + WALK_MINUTES;
      const next = day.stops.find((s) => s.kind === 'set' && s.from >= apart);
      const place = next && next.kind === 'set' ? stageName(festival, next.set.stageId) : meetSpot;
      if (!place) continue;
      const midnight = starts?.get(day.day);
      out.push({
        day: day.day,
        minute,
        ...(midnight ? { atMs: new Date(midnight.getFullYear(), midnight.getMonth(), midnight.getDate(), 0, minute).getTime() } : {}),
        place,
        split: [{ artist: split.artist.name, who: split.who.map(nameOf) }, ...(split.during ? [{ artist: split.during.name, who: [] as string[] }] : [])],
        ...(next && next.kind === 'set' ? { before: next.artist.name } : {}),
      });
    }
  }
  return out;
}

/** "23:40" on the festival-day clock (after midnight runs past 24:00). */
function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const min = h * 60 + m;
  return min < 7 * 60 ? min + 24 * 60 : min;
}

/** "1:40 AM", from minutes on the festival-day clock. */
export const minuteTime = (minute: number) => formatTime(clockTime(minute));
