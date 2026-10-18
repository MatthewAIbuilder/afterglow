import { tIn, type Language } from '../../i18n';

/**
 * Push notifications from one phone to another, through Expo's push service
 * (no server of our own: the user chose this on 2026-10-18). Each phone keeps
 * its push address (an Expo push token) in the places that may reach it: in
 * each crew and 1-to-1 chat it's in (only the people there can read it), and
 * on its own (`pushTokens/{uid}`, read by people you follow both ways and by
 * Afterglow support). The sender's phone builds the words in each person's
 * own language and hands them to Expo. Pure: wording, checks and packing.
 */

/** What this phone last registered (account, address, language, rooms, day), so it isn't written again on every launch. */
export const PUSH_REGISTERED_KEY = 'pushRegistered.v1';
export type PushRegistered = { uid: string; token: string; lang: string; rooms: string; day: string };

/** The stored registration, checked. */
export function readPushRegistered(raw: string | null): PushRegistered | undefined {
  try {
    const r = raw ? (JSON.parse(raw) as Partial<PushRegistered>) : undefined;
    return r && typeof r.uid === 'string' && isExpoPushToken(r.token) && typeof r.lang === 'string' && typeof r.rooms === 'string' && typeof r.day === 'string' ? (r as PushRegistered) : undefined;
  } catch {
    return undefined;
  }
}

export const PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
/** Expo takes at most this many messages in one request. */
export const PUSH_BATCH = 100;
/** Phones one account keeps push addresses for (the oldest go first). */
export const PUSH_TOKENS_MAX = 5;
/** The longest bit of someone's message shown in a notification. */
export const PUSH_TEXT_MAX = 140;

/** What happened, for the people a push goes to. `from` is the sender's display name, `room` the crew's name. */
export type PushEvent =
  | { kind: 'chat'; from: string; room?: string; text: string; more: number }
  | { kind: 'update'; from: string; room: string; update: 'help' | 'ok' | 'lost' | 'checkin' | 'video' | 'photo' | 'reply'; stage?: string; note?: string }
  | { kind: 'meet'; from: string; room: string; text: string }
  | { kind: 'invite'; from: string; room: string }
  | { kind: 'support'; text: string };

/** Someone's push addresses and the language their phone speaks. */
export type PushAddress = { tokens: string[]; lang: Language };

export type ExpoPushMessage = { to: string[]; title: string; body: string; data: { href: string }; sound: 'default'; priority: 'high' };

export const isExpoPushToken = (x: unknown): x is string => typeof x === 'string' && x.length <= 200 && /^Expo(nent)?PushToken\[[^\]\s]+\]$/.test(x);

/** A stored push address, checked (anything malformed is left out). */
export function cleanPushAddress(data: unknown): PushAddress | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const { tokens, lang } = data as { tokens?: unknown; lang?: unknown };
  const good = Array.isArray(tokens) ? [...new Set(tokens.filter(isExpoPushToken))].slice(-PUSH_TOKENS_MAX) : [];
  if (!good.length) return undefined;
  return { tokens: good, lang: lang === 'es' ? 'es' : 'en' };
}

/** Your phone's address added to the ones kept (newest last, at most `PUSH_TOKENS_MAX`). */
export function withToken(tokens: readonly string[], token: string): string[] {
  return [...tokens.filter((x) => x !== token && isExpoPushToken(x)), token].slice(-PUSH_TOKENS_MAX);
}

const short = (text: string) => {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length > PUSH_TEXT_MAX ? `${one.slice(0, PUSH_TEXT_MAX - 1).trimEnd()}…` : one;
};

/** The notification's title and words, in `lang`. */
export function pushText(e: PushEvent, lang: Language): { title: string; body: string } {
  const t = (english: string, vars?: Record<string, string | number>) => tIn(lang, english, vars);
  switch (e.kind) {
    case 'chat': {
      const text = short(e.text);
      const body = e.more > 0 ? t('{text} (+{n} more)', { text, n: e.more }) : text;
      // A crew: its name on top and who said it; a 1-to-1 chat: just them.
      return e.room ? { title: e.room, body: t('{name}: {text}', { name: e.from, text: body }) } : { title: e.from, body };
    }
    case 'update': {
      const body =
        e.update === 'help'
          ? t('{name}: come find me', { name: e.from })
          : e.update === 'ok'
            ? t('{name} is OK', { name: e.from })
            : e.update === 'lost'
              ? t('{name} can’t find the crew', { name: e.from })
              : e.update === 'video'
                ? t('{name} sent a video', { name: e.from })
                : e.update === 'photo'
                  ? t('{name} sent a photo', { name: e.from })
                  : e.update === 'reply'
                    ? t('{name}: {text}', { name: e.from, text: short(e.note ?? '') })
                    : e.stage
                      ? t('{name} is at {stage}', { name: e.from, stage: e.stage })
                      : t('{name} checked in', { name: e.from });
      return { title: e.room, body };
    }
    case 'meet':
      return { title: e.room, body: t('{name} set the meeting spot: {text}', { name: e.from, text: short(e.text) }) };
    case 'invite':
      return { title: 'Afterglow', body: t('{name} invited you to {crew}', { name: e.from, crew: e.room }) };
    case 'support':
      return { title: t('Afterglow support'), body: short(e.text) };
  }
}

/**
 * The messages to send for one event: one per language, each carrying that
 * language's addresses (in batches Expo accepts), opening `href` when tapped.
 */
export function pushMessages(addresses: readonly PushAddress[], event: PushEvent, href: string): ExpoPushMessage[] {
  const byLang = new Map<Language, Set<string>>();
  for (const a of addresses) for (const tk of a.tokens) (byLang.get(a.lang) ?? byLang.set(a.lang, new Set()).get(a.lang)!).add(tk);
  const out: ExpoPushMessage[] = [];
  for (const [lang, tokens] of byLang) {
    const { title, body } = pushText(event, lang);
    const all = [...tokens];
    for (let i = 0; i < all.length; i += PUSH_BATCH) out.push({ to: all.slice(i, i + PUSH_BATCH), title, body, data: { href }, sound: 'default', priority: 'high' });
  }
  return out;
}

/** The update kinds that become a push, from a crew update. */
export function updatePushKind(u: { kind: string; care?: string; lost?: boolean }): Extract<PushEvent, { kind: 'update' }>['update'] {
  if (u.kind === 'checkin') return u.care === 'help' ? 'help' : u.care === 'ok' ? 'ok' : u.lost ? 'lost' : 'checkin';
  return u.kind === 'video' || u.kind === 'photo' || u.kind === 'reply' ? u.kind : 'checkin';
}
