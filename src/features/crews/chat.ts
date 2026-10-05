import { CHAT_MAX, type CrewMessage } from '../social/models';
import { WEB_URL } from '../../config/app';
import { parseShare, shareNoun } from '../messages/shares';

/**
 * A crew's chat, worked out on the phone. Pure.
 *
 * Messages you write go into an outbox first (kept on this phone), stamped
 * with when you wrote them, and send themselves when there's signal, like
 * crew updates. The chat shows them in the order they were written, so a
 * message held back by festival signal lands where it belongs and says it
 * arrived late.
 */

/** How many of each crew's newest messages are followed live. */
export const CHAT_WATCH = 150;
/** At most this many messages wait for signal. */
export const CHAT_OUTBOX_MAX = 50;
/** A message still waiting after this long is given up (it says so). */
export const CHAT_KEEP_MS = 24 * 3600 * 1000;
/** A message the crew keeps refusing (you left, or it was removed) is given up after this many tries. */
export const CHAT_REFUSED_TRIES = 3;
/** Arriving this long after it was written counts as late. */
export const CHAT_LATE_MS = 10 * 60 * 1000;
/** Messages from the same person within this long sit together. */
export const RUN_GAP_MS = 5 * 60 * 1000;

/** Short messages for a festival, a tap away when the box is empty. */
export const QUICK_MESSAGES = ['On my way', 'Where are you?', 'Meet at our spot', 'Water break', 'This set is amazing'] as const;

/** The chat rules everyone agrees to by starting or joining a crew. */
export const CHAT_RULES = [
  'Crews are invite only. Only invite people you know.',
  'Be kind. No harassment, threats or hate.',
  'Don’t share someone else’s private details or photos without asking.',
  'No selling tickets, drugs or anything else.',
  'Report anything that breaks the community guidelines. The crew’s starter can remove messages and people.',
] as const;

/** The rules for a 1-to-1 chat (shown at the top, like a crew's). */
export const DM_RULES = [
  'Only friends who follow each other can chat.',
  'Be kind. No harassment, threats or hate.',
  'Don’t share someone else’s private details or photos without asking.',
  'No selling tickets, drugs or anything else.',
  'Report anything that breaks the community guidelines, or block them to stop their messages.',
] as const;

export type ChatOutboxItem = {
  id: string;
  crewId: string;
  text: string;
  /** When you wrote it (ISO 8601). */
  at: string;
  tries: number;
  refused?: number;
  nextAt?: number;
  /** The account that wrote it (only that account sends it). */
  uid?: string;
};

/** A message as the chat shows it: sent, waiting for signal, or given up. */
export type ChatLine = CrewMessage & { status: 'sent' | 'waiting' | 'failed' };

const ms = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

/** A message's id, made on the phone so a retry never doubles it. */
export const messageId = (now: number, rand: () => number = Math.random) =>
  `m${now.toString(36)}${Math.floor(rand() * 36 ** 6).toString(36).padStart(6, '0')}`;

/** Words tidied for sending: spaces trimmed, at most CHAT_MAX. Empty means nothing to send. */
export const cleanMessage = (raw: string) => raw.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, CHAT_MAX);

/** Add a message to the outbox, in the order they were written, bounded. */
export function queueMessage(outbox: readonly ChatOutboxItem[], item: ChatOutboxItem): ChatOutboxItem[] {
  return [...outbox.filter((o) => o.id !== item.id), item].sort((a, b) => ms(a.at) - ms(b.at)).slice(-CHAT_OUTBOX_MAX);
}

/** It reached the crew. */
export const messageSent = (outbox: readonly ChatOutboxItem[], id: string) => outbox.filter((o) => o.id !== id);

/** It didn't: no signal waits again (15 s doubling to 2 min); a refusal counts towards giving up. */
export function messageFailed(outbox: readonly ChatOutboxItem[], id: string, now: number, refused: boolean): ChatOutboxItem[] {
  return outbox.map((o) => {
    if (o.id !== id) return o;
    const tries = o.tries + 1;
    return { ...o, tries, ...(refused ? { refused: (o.refused ?? 0) + 1 } : {}), nextAt: now + Math.min(15_000 * 2 ** (tries - 1), 120_000) };
  });
}

/** Messages to try now, oldest first: not given up, and due. */
export const dueMessages = (outbox: readonly ChatOutboxItem[], now: number) =>
  outbox.filter((o) => !gaveUp(o, now) && (o.nextAt ?? 0) <= now);

/** A message the crew kept refusing, or that waited too long. */
export const gaveUp = (o: ChatOutboxItem, now: number) => (o.refused ?? 0) >= CHAT_REFUSED_TRIES || now - ms(o.at) > CHAT_KEEP_MS;

/** The outbox read back from storage: anything malformed dropped. */
export function cleanChatOutbox(raw: unknown): ChatOutboxItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatOutboxItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== 'string' || typeof o.crewId !== 'string' || typeof o.text !== 'string' || typeof o.at !== 'string') continue;
    const text = cleanMessage(o.text);
    if (!text || !Number.isFinite(Date.parse(o.at))) continue;
    out.push({
      id: o.id,
      crewId: o.crewId,
      text,
      at: o.at,
      tries: typeof o.tries === 'number' && o.tries >= 0 ? o.tries : 0,
      ...(typeof o.refused === 'number' && o.refused > 0 ? { refused: o.refused } : {}),
      ...(typeof o.nextAt === 'number' ? { nextAt: o.nextAt } : {}),
      ...(typeof o.uid === 'string' ? { uid: o.uid } : {}),
    });
  }
  return out.slice(-CHAT_OUTBOX_MAX);
}

/** When you last read each crew's chat (ms), read back from storage. */
export function cleanChatRead(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  return out;
}

/**
 * The chat as it reads: messages that reached the crew and yours still
 * waiting, in the order they were written (oldest first); nothing from people
 * you've blocked.
 */
export function chatLines(sent: readonly CrewMessage[], outbox: readonly ChatOutboxItem[], crewId: string, me: string | undefined, blocked: readonly string[], now: number): ChatLine[] {
  const block = new Set(blocked);
  // Still in the outbox means Afterglow hasn't confirmed it, even if the phone's own copy of the chat
  // already shows it (Firestore shows a write straight away and sends it when it can): it's waiting.
  // Only your own account's (another account on this phone may have some waiting too).
  const yours = outbox.filter((o) => o.crewId === crewId && (!o.uid || o.uid === me));
  const waiting = new Set(me ? yours.map((o) => o.id) : []);
  const lines: ChatLine[] = sent.filter((m) => !block.has(m.uid) && !waiting.has(m.id)).map((m) => ({ ...m, status: 'sent' as const }));
  if (me)
    for (const o of yours)
        lines.push({ id: o.id, crewId, uid: me, text: o.text, at: o.at, sentAt: o.at, status: gaveUp(o, now) ? 'failed' : 'waiting' });
  return lines.sort((a, b) => ms(a.at) - ms(b.at) || a.id.localeCompare(b.id));
}

/** Messages from others that reached the crew after you last read it. */
export function unreadCount(sent: readonly CrewMessage[], lastRead: number | undefined, me: string | undefined, blocked: readonly string[]): number {
  const block = new Set(blocked);
  return sent.filter((m) => m.uid !== me && !block.has(m.uid) && ms(m.sentAt) > (lastRead ?? 0)).length;
}

/** Did it arrive well after it was written? */
export const arrivedLate = (m: Pick<CrewMessage, 'at' | 'sentAt'>) => ms(m.sentAt) - ms(m.at) >= CHAT_LATE_MS;

/** A message held up this long tells you once it finally gets through. */
export const DELAY_NOTICE_MS = 60_000;

/** "18 min", "1 h 5 min": how long something was held up. */
export function heldFor(heldMs: number): string {
  const m = Math.max(1, Math.round(heldMs / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

const clockOf = (t: number) => {
  const d = new Date(t);
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

/** Under a late message: "Sent 8:02 PM · reached the crew 8:20 PM". */
export const lateNote = (m: Pick<CrewMessage, 'at' | 'sentAt'>) => `Sent ${clockOf(ms(m.at))} · reached the crew ${clockOf(ms(m.sentAt))}`;

/** Yours waiting for signal, as one line, saying they keep the time you wrote them. */
export function waitingLine(waiting: readonly Pick<ChatOutboxItem, 'at'>[]): string | undefined {
  if (!waiting.length) return undefined;
  const first = Math.min(...waiting.map((w) => ms(w.at)));
  return waiting.length === 1
    ? `Waiting for signal. Your message sends by itself as soon as there’s a bar, still marked ${clockOf(first)}.`
    : `Waiting for signal. ${waiting.length} messages send by themselves as soon as there’s a bar, still marked from ${clockOf(first)}.`;
}

/** Once yours finally got through: "Your 2 messages reached the crew, held up 18 min by signal." */
export function deliveryLine(count: number, heldMs: number): string {
  return `${count === 1 ? 'Your message' : `Your ${count} messages`} reached the crew, held up ${heldFor(heldMs)} by signal.`;
}

/**
 * Crewmates' messages that just got through after being held up: arrived in
 * the last `withinMs` but written `CHAT_LATE_MS` or more before. They slot in
 * at the time they were written, higher up the chat, so they're pointed out.
 */
export function justArrivedLate(sent: readonly CrewMessage[], me: string | undefined, blocked: readonly string[], now: number, withinMs = 10 * 60_000): CrewMessage[] {
  const block = new Set(blocked);
  return sent
    .filter((m) => m.uid !== me && !block.has(m.uid) && arrivedLate(m) && now - ms(m.sentAt) <= withinMs)
    .sort((a, b) => ms(a.at) - ms(b.at));
}

/** "Maya’s message from 8:02 PM just got through, held up 18 min by signal." */
export function arrivedLateLine(m: CrewMessage, name: string): string {
  return `${name}’s message from ${clockOf(ms(m.at))} just got through, held up ${heldFor(ms(m.sentAt) - ms(m.at))} by signal.`;
}

/** A line in the chat list: a day heading, or a message with where it sits in its run. */
export type ChatRow =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'message'; key: string; line: ChatLine; mine: boolean; first: boolean; last: boolean };

/** "Today", "Yesterday", or "Sat, Dec 5". */
export function dayLabel(at: number, now: number): string {
  const d = new Date(at);
  const today = new Date(now);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(today) - start(d)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** The chat as rows: a heading each day, and runs of messages from the same person close together. */
export function chatRows(lines: readonly ChatLine[], me: string | undefined, now: number): ChatRow[] {
  const rows: ChatRow[] = [];
  let lastDay = '';
  lines.forEach((line, i) => {
    const t = ms(line.at);
    const day = new Date(t).toDateString();
    if (day !== lastDay) {
      rows.push({ kind: 'day', key: `day:${day}`, label: dayLabel(t, now) });
      lastDay = day;
    }
    const prev = lines[i - 1];
    const next = lines[i + 1];
    const together = (a?: ChatLine, b?: ChatLine) =>
      !!a && !!b && a.uid === b.uid && Math.abs(ms(b.at) - ms(a.at)) <= RUN_GAP_MS && new Date(ms(a.at)).toDateString() === new Date(ms(b.at)).toDateString();
    rows.push({ kind: 'message', key: line.id, line, mine: line.uid === me, first: !together(prev, line), last: !together(line, next) });
  });
  return rows;
}

/** "Maya: see you at Main Stage" for a crew's card. */
export function chatPreview(m: Pick<CrewMessage, 'uid' | 'text'> | undefined, me: string | undefined, nameOf: (uid: string) => string): string | undefined {
  if (!m) return undefined;
  const who = m.uid === me ? 'You' : nameOf(m.uid);
  // Something sent from the app reads as what it is, not as a link.
  const shared = parseShare(m.text, WEB_URL);
  const text = (shared ? shared.caption || `Sent ${shareNoun(shared.share)}` : m.text).replace(/\s+/g, ' ');
  return `${who}: ${text.length > 60 ? `${text.slice(0, 59)}…` : text}`;
}

/** "2 new messages". */
export const unreadLine = (n: number) => (n === 1 ? '1 new message' : `${n} new messages`);

/**
 * Who has read up to a message of yours: crewmates (never you) whose last
 * read reached it. Both times come from the server, so phones' clocks never
 * matter.
 */
export function seenBy(m: Pick<CrewMessage, 'sentAt'>, reads: Readonly<Record<string, string>>, members: readonly string[], me: string | undefined): string[] {
  const at = ms(m.sentAt);
  return members.filter((u) => u !== me && reads[u] && ms(reads[u]) >= at);
}

/** Under your latest message: "Delivered", "Seen by Maya", "Seen by Maya and Sam", "Seen by everyone". */
export function seenLine(seen: readonly string[], others: number, nameOf: (uid: string) => string): string {
  if (!seen.length) return 'Delivered';
  if (others > 1 && seen.length >= others) return 'Seen by everyone';
  const names = seen.map(nameOf);
  if (names.length <= 2) return `Seen by ${names.join(' and ')}`;
  return `Seen by ${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}
