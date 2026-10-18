import { describe, expect, it } from '@jest/globals';
import { cleanPushAddress, isExpoPushToken, PUSH_BATCH, PUSH_TOKENS_MAX, pushMessages, pushText, updatePushKind, withToken } from '../push';

const tok = (n: number | string) => `ExponentPushToken[${n}]`;

describe('push addresses', () => {
  it('only Expo push tokens count', () => {
    expect(isExpoPushToken(tok('abc'))).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[abc]')).toBe(true);
    expect(isExpoPushToken('https://evil.example')).toBe(false);
    expect(isExpoPushToken('ExponentPushToken[]')).toBe(false);
    expect(isExpoPushToken(42)).toBe(false);
  });

  it('a stored address is checked: bad tokens left out, the language defaults to English', () => {
    expect(cleanPushAddress({ tokens: [tok(1), 'nope', tok(1)], lang: 'es' })).toEqual({ tokens: [tok(1)], lang: 'es' });
    expect(cleanPushAddress({ tokens: [tok(1)], lang: 'fr' })).toEqual({ tokens: [tok(1)], lang: 'en' });
    expect(cleanPushAddress({ tokens: ['nope'] })).toBeUndefined();
    expect(cleanPushAddress(null)).toBeUndefined();
  });

  it('a new phone joins the end; the oldest go past five phones; the same one never twice', () => {
    expect(withToken([tok(1), tok(2)], tok(1))).toEqual([tok(2), tok(1)]);
    const many = Array.from({ length: PUSH_TOKENS_MAX }, (_, i) => tok(i));
    expect(withToken(many, tok('new'))).toEqual([...many.slice(1), tok('new')]);
  });
});

describe('what a push says', () => {
  it('crew chat: the crew on top, who said it; a 1-to-1 chat: just them', () => {
    expect(pushText({ kind: 'chat', from: 'Maya', room: 'Bass bunch', text: 'at the ferris wheel', more: 0 }, 'en')).toEqual({ title: 'Bass bunch', body: 'Maya: at the ferris wheel' });
    expect(pushText({ kind: 'chat', from: 'Maya', text: 'hi', more: 2 }, 'en')).toEqual({ title: 'Maya', body: 'hi (+2 more)' });
  });

  it('a long message is cut short', () => {
    const { body } = pushText({ kind: 'chat', from: 'Maya', text: 'a'.repeat(400), more: 0 }, 'en');
    expect(body.length).toBeLessThanOrEqual(141);
    expect(body.endsWith('…')).toBe(true);
  });

  it('crew updates, the meeting spot, invites and support replies', () => {
    const u = (update: Parameters<typeof updatePushKind>[0], extra = {}) => pushText({ kind: 'update', from: 'Sam', room: 'Crew', update: updatePushKind(update), ...extra }, 'en').body;
    expect(u({ kind: 'checkin', care: 'help' })).toBe('Sam: come find me');
    expect(u({ kind: 'checkin', care: 'ok' })).toBe('Sam is OK');
    expect(u({ kind: 'checkin', lost: true })).toBe('Sam can’t find the crew');
    expect(u({ kind: 'checkin' }, { stage: 'Main Stage' })).toBe('Sam is at Main Stage');
    expect(u({ kind: 'checkin' })).toBe('Sam checked in');
    expect(u({ kind: 'video' })).toBe('Sam sent a video');
    expect(u({ kind: 'reply' }, { note: 'omw' })).toBe('Sam: omw');
    expect(pushText({ kind: 'meet', from: 'Sam', room: 'Crew', text: 'big tree' }, 'en').body).toBe('Sam set the meeting spot: big tree');
    expect(pushText({ kind: 'invite', from: 'Sam', room: 'Crew' }, 'en').body).toBe('Sam invited you to Crew');
    expect(pushText({ kind: 'support', text: 'Fixed it!' }, 'en')).toEqual({ title: 'Afterglow support', body: 'Fixed it!' });
  });

  it('each person hears it in their own phone’s language', () => {
    expect(pushText({ kind: 'update', from: 'Sam', room: 'Crew', update: 'help' }, 'es').body).toBe('Sam: ven a buscarme');
    const msgs = pushMessages(
      [
        { tokens: [tok('en1'), tok('en2')], lang: 'en' },
        { tokens: [tok('es1')], lang: 'es' },
      ],
      { kind: 'update', from: 'Sam', room: 'Crew', update: 'ok' },
      '/crew/c1',
    );
    expect(msgs).toHaveLength(2);
    expect(msgs.find((m) => m.to.includes(tok('es1')))?.body).toBe('Sam está bien');
    expect(msgs.find((m) => m.to.includes(tok('en1')))).toMatchObject({ to: [tok('en1'), tok('en2')], body: 'Sam is OK', data: { href: '/crew/c1' } });
  });

  it('packs at most a hundred phones in a message', () => {
    const tokens = Array.from({ length: PUSH_BATCH + 1 }, (_, i) => tok(i));
    const msgs = pushMessages(tokens.map((t) => ({ tokens: [t], lang: 'en' as const })), { kind: 'support', text: 'hi' }, '/support');
    expect(msgs.map((m) => m.to.length)).toEqual([PUSH_BATCH, 1]);
  });
});
