import { CHAT_MAX, type CrewMessage } from '../social/models';

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

export type ChatOutboxItem = {
  id: string;
  crewId: string;
  text: string;
  /** When you wrote it (ISO 8601). */
  at: string;
  tries: number;
  refused?: number;
  nextAt?: number;
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
  const ids = new Set(sent.map((m) => m.id));
  const lines: ChatLine[] = sent.filter((m) => !block.has(m.uid)).map((m) => ({ ...m, status: 'sent' as const }));
  if (me)
    for (const o of outbox)
      if (o.crewId === crewId && !ids.has(o.id))
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
  const text = m.text.replace(/\s+/g, ' ');
  return `${who}: ${text.length > 60 ? `${text.slice(0, 59)}…` : text}`;
}

/** "2 new messages". */
export const unreadLine = (n: number) => (n === 1 ? '1 new message' : `${n} new messages`);
