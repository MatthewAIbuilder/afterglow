import { describe, expect, it } from '@jest/globals';
import type { CrewMessage } from '../../social/models';
import {
  CHAT_KEEP_MS,
  CHAT_REFUSED_TRIES,
  arrivedLate,
  chatLines,
  chatPreview,
  chatRows,
  cleanChatOutbox,
  cleanMessage,
  dueMessages,
  messageFailed,
  messageSent,
  queueMessage,
  unreadCount,
  unreadLine,
  type ChatOutboxItem,
} from '../chat';

const T = (h: number, m = 0) => new Date(2026, 11, 5, h, m).getTime();
const iso = (t: number) => new Date(t).toISOString();
const msg = (id: string, uid: string, at: number, sentAt = at, text = id): CrewMessage => ({ id, crewId: 'c1', uid, text, at: iso(at), sentAt: iso(sentAt) });
const out = (id: string, at: number, over: Partial<ChatOutboxItem> = {}): ChatOutboxItem => ({ id, crewId: 'c1', text: id, at: iso(at), tries: 0, ...over });

describe('crew chat', () => {
  it('tidies words before sending', () => {
    expect(cleanMessage('  hi  ')).toBe('hi');
    expect(cleanMessage('a\n\n\n\nb')).toBe('a\n\nb');
    expect(cleanMessage('   ')).toBe('');
    expect(cleanMessage('x'.repeat(600))).toHaveLength(500);
  });

  it('the outbox keeps the order things were written, retries with a growing wait, and gives up on refusals', () => {
    let box = queueMessage([], out('b', T(22, 5)));
    box = queueMessage(box, out('a', T(22)));
    expect(box.map((o) => o.id)).toEqual(['a', 'b']);
    box = messageFailed(box, 'a', T(22, 6), false);
    expect(dueMessages(box, T(22, 6)).map((o) => o.id)).toEqual(['b']);
    expect(dueMessages(box, T(22, 6) + 16_000).map((o) => o.id)).toEqual(['a', 'b']);
    for (let i = 0; i < CHAT_REFUSED_TRIES; i++) box = messageFailed(box, 'b', T(22, 6), true);
    expect(dueMessages(box, T(23)).map((o) => o.id)).toEqual(['a']);
    expect(dueMessages(box, T(22) + CHAT_KEEP_MS + 1)).toEqual([]);
    expect(messageSent(box, 'a').map((o) => o.id)).toEqual(['b']);
  });

  it('reads the outbox back carefully', () => {
    expect(cleanChatOutbox([out('a', T(22)), { id: 'x' }, null, { ...out('b', T(22)), text: '   ' }]).map((o) => o.id)).toEqual(['a']);
    expect(cleanChatOutbox('nope')).toEqual([]);
  });

  it('the chat reads in the order things were written, yours waiting included, never blocked people', () => {
    const sent = [msg('m2', 'sam', T(22, 10)), msg('m1', 'maya', T(22), T(22, 30)), msg('m3', 'bad', T(22, 1))];
    const lines = chatLines(sent, [out('m4', T(22, 5)), out('m2', T(22, 10))], 'c1', 'me', ['bad'], T(22, 40));
    expect(lines.map((l) => [l.id, l.status])).toEqual([
      ['m1', 'sent'],
      ['m4', 'waiting'],
      ['m2', 'sent'],
    ]);
    expect(arrivedLate(lines[0])).toBe(true);
    expect(arrivedLate(lines[2])).toBe(false);
  });

  it('counts new messages from others since you last read it', () => {
    const sent = [msg('m1', 'maya', T(22)), msg('m2', 'me', T(22, 5)), msg('m3', 'sam', T(22, 10)), msg('m4', 'bad', T(22, 11))];
    expect(unreadCount(sent, undefined, 'me', ['bad'])).toBe(2);
    expect(unreadCount(sent, T(22, 5), 'me', ['bad'])).toBe(1);
    expect(unreadLine(1)).toBe('1 new message');
    expect(unreadLine(3)).toBe('3 new messages');
  });

  it('groups a day’s messages into runs from the same person', () => {
    const lines = chatLines([msg('a', 'maya', T(22)), msg('b', 'maya', T(22, 2)), msg('c', 'me', T(22, 3)), msg('d', 'maya', T(22, 30))], [], 'c1', 'me', [], T(23));
    const rows = chatRows(lines, 'me', T(23));
    expect(rows[0]).toMatchObject({ kind: 'day', label: 'Today' });
    expect(rows.slice(1).map((r) => (r.kind === 'message' ? [r.line.id, r.mine, r.first, r.last] : r.kind))).toEqual([
      ['a', false, true, false],
      ['b', false, false, true],
      ['c', true, true, true],
      ['d', false, true, true],
    ]);
  });

  it('previews the latest message for a crew’s card', () => {
    expect(chatPreview(msg('a', 'maya', T(22), T(22), 'See you at\nMain Stage'), 'me', () => 'Maya')).toBe('Maya: See you at Main Stage');
    expect(chatPreview(msg('a', 'me', T(22), T(22), 'x'.repeat(80)), 'me', () => 'Maya')).toBe(`You: ${'x'.repeat(59)}…`);
    expect(chatPreview(undefined, 'me', () => '')).toBeUndefined();
  });
});
