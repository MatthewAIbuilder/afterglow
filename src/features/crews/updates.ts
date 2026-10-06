import type { Festival } from '../../data/models';
import { setFor, stageName } from '../../data/festival';
import { CREW_NOTE_MAX, CREW_STAGE_MAX, type Crew, type CrewUpdate, type CrewUpdateInput } from '../social/models';
import { LANGUAGE, t } from '../../i18n';

/**
 * Crew updates, pure: who in your crews posted what and when, how it reads,
 * and the outbox that holds your own updates until there's signal.
 *
 * Time is the point. Every update carries when it happened on the phone
 * (`at`: filmed, or tapped). That's the time shown, and the one that decides
 * what's newest: a video filmed at 4:05 PM beats one filmed at 3:00 PM even
 * if the 3:00 PM one only gets through at 5:00 PM. When an update reached the
 * crew long after it happened, the app says so ("Sent 3:00 PM, reached the
 * crew 5:02 PM"), so nobody walks to a stage their friend left two hours ago.
 */

/** Updates older than this (by when they happened) aren't shown: a festival day, with room for a late night. */
export const UPDATES_WINDOW_MS = 36 * 3600 * 1000;
/** An update that reached the crew this much later than it happened is called late. */
export const LATE_AFTER_MS = 10 * 60 * 1000;
/** At most this many updates are read per crew. */
export const UPDATES_MAX = 100;

const ms = (iso: string) => Date.parse(iso);

/** "4:05 PM", in the phone's time. */
export function clock(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  if (LANGUAGE === 'es') return `${h}:${String(m).padStart(2, '0')}`;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** "Just now", "12 min ago", "2 h ago", "1 h 20 min ago". */
export function ago(iso: string, now: number): string {
  const m = Math.max(0, Math.floor((now - ms(iso)) / 60000));
  if (m < 1) return t('Just now');
  if (m < 60) return t('{m} min ago', { m });
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h < 3 && r ? t('{h} h {m} min ago', { h, m: r }) : t('{h} h ago', { h });
}

/** Newest first by when it happened; ties by when it arrived, then id, so the order never flickers. */
export const byHappened = (a: CrewUpdate, b: CrewUpdate) => ms(b.at) - ms(a.at) || ms(b.sentAt) - ms(a.sentAt) || a.id.localeCompare(b.id);

/** The same update posted to two crews counts once (same id, same person). */
function unique(updates: readonly CrewUpdate[]): CrewUpdate[] {
  const seen = new Set<string>();
  return updates.filter((u) => {
    const k = `${u.uid}/${u.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export type Story = {
  uid: string;
  /** Their updates, newest first (by when they happened). */
  updates: CrewUpdate[];
  latest: CrewUpdate;
  /** Something newer than what you last saw from them. */
  fresh: boolean;
};

/** A reply to someone's update, not news of where someone is. */
export const isReply = (u: Pick<CrewUpdate, 'kind'>) => u.kind === 'reply';

/**
 * One story per crewmate with an update in the window: their updates newest
 * first. Never you, never anyone blocked or no longer in the crew it was
 * posted to. Replies only count when they answer one of yours (others'
 * replies stay under the update they answer). Fresh stories first, then the
 * most recent.
 */
export function crewStories(
  updates: readonly CrewUpdate[],
  crews: readonly Crew[],
  { me, blocked = [], seen = {}, now }: { me?: string; blocked?: readonly string[]; seen?: Record<string, number>; now: number },
): Story[] {
  const inCrew = new Map(crews.map((c) => [c.id, new Set(c.members)]));
  const mine = new Set(updates.filter((u) => u.uid === me && !isReply(u)).map((u) => `${u.crewId}/${u.id}`));
  const kept = unique(updates).filter(
    (u) =>
      u.uid !== me &&
      !blocked.includes(u.uid) &&
      inCrew.get(u.crewId)?.has(u.uid) &&
      now - ms(u.at) <= UPDATES_WINDOW_MS &&
      (!isReply(u) || mine.has(`${u.crewId}/${u.replyTo}`)),
  );
  const byUid = new Map<string, CrewUpdate[]>();
  for (const u of kept) byUid.set(u.uid, [...(byUid.get(u.uid) ?? []), u]);
  return [...byUid.entries()]
    .map(([uid, list]) => {
      const sorted = [...list].sort(byHappened);
      return { uid, updates: sorted, latest: sorted[0], fresh: ms(sorted[0].at) > (seen[uid] ?? 0) };
    })
    .sort((a, b) => Number(b.fresh) - Number(a.fresh) || byHappened(a.latest, b.latest));
}

/** "Main Stage · SLANDER": where an update was, when known. */
export function updatePlace(u: Pick<CrewUpdate, 'stage' | 'note'>, artistName?: string): string {
  return [u.stage, artistName].filter(Boolean).join(' · ');
}

/** "Updated 4:05 PM · Main Stage · SLANDER", the line under a crewmate's story ("Replied 4:12 PM" for a reply). */
export function updateLine(u: CrewUpdate, artistName?: string): string {
  if (isReply(u)) return t('Replied {time}', { time: clock(u.at) });
  if (u.lost) return t('Can’t find the crew · {time}', { time: clock(u.at) });
  if (u.care === 'help') return t('Not feeling great · {time}', { time: clock(u.at) });
  if (u.care === 'ok') return t('I’m OK · {time}', { time: clock(u.at) });
  if (u.kind === 'photo') {
    const where = updatePlace(u, artistName);
    return `${t('Photo {time}', { time: clock(u.at) })}${where ? ` · ${where}` : ''}`;
  }
  const place = updatePlace(u, artistName);
  return `${t('Updated {time}', { time: clock(u.at) })}${place ? ` · ${place}` : ''}`;
}

/** An update that took a while to get through: "Sent 3:00 PM, reached the crew 5:02 PM". Nothing when it arrived promptly. */
export function lateLine(u: Pick<CrewUpdate, 'at' | 'sentAt'>): string | undefined {
  return ms(u.sentAt) - ms(u.at) >= LATE_AFTER_MS ? t('Sent {time}, reached the crew {arrived}', { time: clock(u.at), arrived: clock(u.sentAt) }) : undefined;
}

/** "Last update 3:00 PM · 2 h ago": how fresh a crewmate's latest news is. */
export function lastUpdateLine(u: CrewUpdate, now: number): string {
  return t('Last update {time} · {ago}', { time: clock(u.at), ago: ago(u.at, now) });

}

/** Where an artist plays at this festival, from the set times, when known. */
export function stageOf(festival: Festival, artistId: string | undefined): string | undefined {
  if (!artistId) return undefined;
  const set = setFor(festival, artistId);
  return set ? stageName(festival, set.stageId).slice(0, CREW_STAGE_MAX) : undefined;
}

/** Quick check-ins: one tap each, so they get through on the weakest signal. */
export const CHECK_INS = ['I’m here', 'Meet at our spot', 'Getting water', 'Phone’s dying', 'Heading out'] as const;

/** A check-in's words, tidied: one line, at most CREW_NOTE_MAX. */
export const cleanNote = (raw: string) => raw.replace(/\s+/g, ' ').trim().slice(0, CREW_NOTE_MAX);

/**
 * Your own updates waiting for signal. Each keeps the time it happened and
 * its id from the moment you tapped, so a send that finally gets through
 * hours later still says when it happened, and a send repeated after a
 * dropped connection lands once.
 */
export type OutboxItem = {
  id: string;
  /** The crews it goes to (every crew you're in at that festival). Ones it reached are taken off. */
  crewIds: string[];
  input: CrewUpdateInput;
  /** A video also being shared to Discover: wait for that upload and point at it, rather than uploading twice. */
  memoryId?: string;
  tries: number;
  /** How many times a crew refused it outright (not counting tries that failed for want of signal). */
  refused?: number;
  /** It already reached at least one of its crews. */
  reachedSome?: boolean;
  /** When it was put in the outbox (ms). */
  queuedAt: number;
  /** The account that wrote it: only that account ever sends it (older items without one are held until they expire). */
  uid?: string;
};

/** Updates still waiting after this long are dropped: old news by then. */
export const OUTBOX_KEEP_MS = 24 * 3600 * 1000;
/** At most this many updates wait at once (oldest dropped). */
export const OUTBOX_MAX = 30;

/** A fresh id for an update, made on the phone. */
export const updateId = (now: number, rand: () => number = Math.random) =>
  `u${now.toString(36)}${Math.floor(rand() * 36 ** 6).toString(36).padStart(6, '0')}`;

/** Add an update to the outbox, keeping it bounded and in the order things happened. */
export function enqueue(outbox: readonly OutboxItem[], item: OutboxItem): OutboxItem[] {
  return [...outbox.filter((o) => o.id !== item.id), item].sort((a, b) => ms(a.input.at) - ms(b.input.at)).slice(-OUTBOX_MAX);
}

/**
 * It reached these crews (or, with `reached` false, is no longer going to them): take them off; an item
 * with no crews left leaves the outbox.
 */
export function delivered(outbox: readonly OutboxItem[], id: string, crewIds: readonly string[], reached = true): OutboxItem[] {
  return outbox.flatMap((o) => {
    if (o.id !== id) return [o];
    const left = o.crewIds.filter((c) => !crewIds.includes(c));
    return left.length ? [{ ...o, crewIds: left, reachedSome: o.reachedSome || (reached && o.crewIds.length > left.length) }] : [];
  });
}

/** One more failed try. */
export const failed = (outbox: readonly OutboxItem[], id: string): OutboxItem[] => outbox.map((o) => (o.id === id ? { ...o, tries: o.tries + 1 } : o));

/** A crew refused it once more (also a try, for the back-off). */
export const refusedOnce = (outbox: readonly OutboxItem[], id: string): OutboxItem[] =>
  outbox.map((o) => (o.id === id ? { ...o, tries: o.tries + 1, refused: (o.refused ?? 0) + 1 } : o));

/**
 * A send the server refused (not a dropped connection) is tried this many
 * times, then let go, so one bad update (a reply to one that was deleted)
 * never holds up the rest.
 */
export const REFUSED_TRIES = 3;

/** Wait between tries: 15 s, 30 s, 1 min, then every 2 min. */
export const retryDelay = (tries: number) => Math.min(120_000, 15_000 * 2 ** Math.max(0, tries));

/** A saved outbox read back safely: malformed or stale items dropped, oldest first. */
export function cleanOutbox(raw: unknown, now: number): OutboxItem[] {
  if (!Array.isArray(raw)) return [];
  const items = raw.filter((o): o is OutboxItem => {
    if (!o || typeof o !== 'object') return false;
    const i = o as OutboxItem;
    return (
      typeof i.id === 'string' &&
      Array.isArray(i.crewIds) &&
      i.crewIds.length > 0 &&
      i.crewIds.every((c) => typeof c === 'string') &&
      !!i.input &&
      (i.input.kind === 'video' || i.input.kind === 'checkin' || (i.input.kind === 'photo' && typeof i.input.thumbUri === 'string') || (i.input.kind === 'reply' && typeof i.input.replyTo === 'string')) &&
      typeof i.input.at === 'string' &&
      Number.isFinite(ms(i.input.at)) &&
      typeof i.input.festivalId === 'string' &&
      typeof i.queuedAt === 'number' &&
      now - i.queuedAt <= OUTBOX_KEEP_MS
    );
  });
  return items.map((i) => ({ ...i, tries: typeof i.tries === 'number' ? i.tries : 0, refused: typeof i.refused === 'number' ? i.refused : undefined })).sort((a, b) => ms(a.input.at) - ms(b.input.at)).slice(-OUTBOX_MAX);
}

/** "Waiting for signal · 2 updates" and the like, for your own pending updates. */
export function outboxLine(outbox: readonly OutboxItem[]): string | undefined {
  if (!outbox.length) return undefined;
  const oldest = outbox[0];
  return outbox.length === 1
    ? `Waiting for signal · your ${clock(oldest.input.at)} update will send itself`
    : `Waiting for signal · ${outbox.length} updates from ${clock(oldest.input.at)} will send themselves`;
}

/** Last seen per crewmate: the newest `at` you've watched from them. */
export function markSeen(seen: Record<string, number>, story: Story): Record<string, number> {
  const t = ms(story.latest.at);
  return (seen[story.uid] ?? 0) >= t ? seen : { ...seen, [story.uid]: t };
}

/** Crews worth showing updates for: festivals not over (or undated), so a past festival's crew goes quiet. */
export function liveCrews(crews: readonly Crew[], festival: (id: string) => Festival | undefined, today: Date): Crew[] {
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return crews.filter((c) => {
    const f = festival(c.festivalId);
    if (!f) return false;
    // The day after it ends still counts: nights run past midnight.
    const end = f.endDate ?? f.startDate;
    if (!end) return true;
    const after = new Date(`${end}T12:00:00`);
    after.setDate(after.getDate() + 1);
    const last = `${after.getFullYear()}-${String(after.getMonth() + 1).padStart(2, '0')}-${String(after.getDate()).padStart(2, '0')}`;
    return day <= last;
  });
}

/** Each member's newest update in one crew (by when it happened; replies say nothing of where they are), members in the crew's order. */
export function latestPerMember(updates: readonly CrewUpdate[], members: readonly string[]): { uid: string; latest?: CrewUpdate }[] {
  return members.map((uid) => ({ uid, latest: [...updates].filter((u) => u.uid === uid && !isReply(u)).sort(byHappened)[0] }));
}

/** Quick replies: one tap, like check-ins. */
export const QUICK_REPLIES = ['On my way', 'Be there in 10', 'Save me a spot', 'Where exactly?', 'Can’t make it'] as const;

/** The replies to one update in its crew, oldest first (a conversation reads down), never from anyone blocked. */
export function repliesTo(updates: readonly CrewUpdate[], target: Pick<CrewUpdate, 'id' | 'crewId'>, blocked: readonly string[] = []): CrewUpdate[] {
  return unique(updates)
    .filter((u) => isReply(u) && u.crewId === target.crewId && u.replyTo === target.id && !blocked.includes(u.uid))
    .sort((a, b) => -byHappened(a, b));
}

/** "2 replies · Maya: On my way", the latest answer to one of your updates. */
export function repliesLine(replies: readonly CrewUpdate[], nameOf: (uid: string) => string): string | undefined {
  const last = replies[replies.length - 1];
  if (!last) return undefined;
  const count = replies.length === 1 ? '1 reply' : `${replies.length} replies`;
  return `${count} · ${nameOf(last.uid)}: ${last.note ?? ''}`;
}

/** The update a reply answers, when it's still here. */
export const answered = (updates: readonly CrewUpdate[], reply: CrewUpdate) =>
  reply.replyTo ? updates.find((u) => u.crewId === reply.crewId && u.id === reply.replyTo) : undefined;

/** Crew-only videos you uploaded, per crew (update ids), so they can be removed once you're out of that crew. */
export type SentVideos = Record<string, string[]>;
/** At most this many are remembered per crew (oldest dropped). */
export const SENT_VIDEOS_MAX = 200;

export const withSentVideo = (sent: SentVideos, crewId: string, id: string): SentVideos => ({
  ...sent,
  [crewId]: [...(sent[crewId] ?? []).filter((x) => x !== id), id].slice(-SENT_VIDEOS_MAX),
});

/** A saved list read back safely. */
export function cleanSentVideos(raw: unknown): SentVideos {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: SentVideos = {};
  for (const [crewId, ids] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(ids)) continue;
    const kept = ids.filter((x): x is string => typeof x === 'string').slice(-SENT_VIDEOS_MAX);
    if (kept.length) out[crewId] = kept;
  }
  return out;
}
