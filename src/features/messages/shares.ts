import { CHAT_MAX } from '../social/models';
import { t } from '../../i18n';

/**
 * Something from the app sent in a chat: a festival (optionally with your
 * must-sees there), an artist, a live-set clip or someone's profile. It
 * travels as an ordinary message holding the website link, so it needs
 * nothing new from the server, and a link is still a link anywhere else.
 * Pure.
 */
export type ChatShare =
  | { kind: 'festival'; id: string; picks?: string[] }
  | { kind: 'artist'; id: string }
  | { kind: 'clip'; id: string }
  | { kind: 'profile'; handle: string };

/** Must-sees carried in a link, at most. */
export const SHARE_PICKS_MAX = 5;

const ID = '[A-Za-z0-9_-]{1,80}';
const HANDLE = '[A-Za-z0-9_.]{1,40}';

/** The link for a share on the website (which opens the app's page there). */
export function shareLink(share: ChatShare, webUrl: string): string {
  switch (share.kind) {
    case 'festival': {
      const picks = (share.picks ?? []).slice(0, SHARE_PICKS_MAX);
      return `${webUrl}/festival/${share.id}${picks.length ? `?must=${picks.join(',')}` : ''}`;
    }
    case 'artist':
      return `${webUrl}/artist/${share.id}`;
    case 'clip':
      return `${webUrl}/?clip=${share.id}`;
    case 'profile':
      return `${webUrl}/u/${share.handle}`;
  }
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The first app link in a message, as a share, and the words around it. */
export function parseShare(text: string, webUrl: string): { share: ChatShare; caption: string } | undefined {
  const host = escape(webUrl.replace(/^https?:\/\//, ''));
  const link = new RegExp(`https?://${host}(/[^\\s]*)?`);
  const m = link.exec(text);
  if (!m) return undefined;
  const share = fromPath(m[1] ?? '/');
  if (!share) return undefined;
  const caption = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
  return { share, caption };
}

function fromPath(path: string): ChatShare | undefined {
  let m = new RegExp(`^/festival/(${ID})/?(?:\\?must=((?:${ID})(?:,${ID})*))?$`).exec(path);
  if (m) {
    const picks = m[2]?.split(',').slice(0, SHARE_PICKS_MAX);
    return picks?.length ? { kind: 'festival', id: m[1], picks } : { kind: 'festival', id: m[1] };
  }
  m = new RegExp(`^/artist/(${ID})/?$`).exec(path);
  if (m) return { kind: 'artist', id: m[1] };
  m = new RegExp(`^/?\\?clip=(${ID})$`).exec(path);
  if (m) return { kind: 'clip', id: m[1] };
  m = new RegExp(`^/u/(${HANDLE})/?$`).exec(path);
  if (m) return { kind: 'profile', handle: m[1] };
  return undefined;
}

/** The message that carries a share: your words (if any), then the link, within a message's length. */
export function shareMessageText(share: ChatShare, note: string, webUrl: string): string {
  const link = shareLink(share, webUrl);
  const room = CHAT_MAX - link.length - 1;
  const words = note.trim().slice(0, Math.max(0, room)).trim();
  return words ? `${words}\n${link}` : link;
}

/** "a festival", "their must-sees": what was sent, for a chat's preview line. */
export function shareNoun(share: ChatShare): string {
  switch (share.kind) {
    case 'festival':
      return share.picks?.length ? t('must-sees') : t('a festival');
    case 'artist':
      return t('an artist');
    case 'clip':
      return t('a live set');
    case 'profile':
      return t('a profile');
  }
}

/** Where tapping a share goes in the app. */
export function shareRoute(share: ChatShare) {
  switch (share.kind) {
    case 'festival':
      return { pathname: '/festival/[id]' as const, params: share.picks?.length ? { id: share.id, must: share.picks.slice(0, SHARE_PICKS_MAX).join(',') } : { id: share.id } };
    case 'artist':
      return { pathname: '/artist/[id]' as const, params: { id: share.id } };
    case 'clip':
      return { pathname: '/' as const, params: { clip: share.id } };
    case 'profile':
      return { pathname: '/u/[handle]' as const, params: { handle: share.handle } };
  }
}

/** A share as route params for the "Send to" sheet, and back. */
export type ShareParams = { kind?: string; id?: string; picks?: string; handle?: string };

export function shareParams(share: ChatShare): ShareParams {
  if (share.kind === 'profile') return { kind: share.kind, handle: share.handle };
  if (share.kind === 'festival' && share.picks?.length) return { kind: share.kind, id: share.id, picks: share.picks.slice(0, SHARE_PICKS_MAX).join(',') };
  return { kind: share.kind, id: share.id };
}

export function shareFromParams(p: ShareParams): ChatShare | undefined {
  const ok = (s: string | undefined, re: string): s is string => !!s && new RegExp(`^${re}$`).test(s);
  switch (p.kind) {
    case 'festival': {
      if (!ok(p.id, ID)) return undefined;
      const picks = (p.picks ?? '').split(',').filter((x) => ok(x, ID)).slice(0, SHARE_PICKS_MAX);
      return picks.length ? { kind: 'festival', id: p.id, picks } : { kind: 'festival', id: p.id };
    }
    case 'artist':
    case 'clip':
      return ok(p.id, ID) ? { kind: p.kind, id: p.id } : undefined;
    case 'profile':
      return ok(p.handle, HANDLE) ? { kind: 'profile', handle: p.handle } : undefined;
    default:
      return undefined;
  }
}
