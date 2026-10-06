import {
  MUSIC_PROVIDERS,
  MUSIC_SIGNAL_SOURCES,
  PROVIDER_NAME,
  type MusicConnection,
  type MusicErrorKind,
  type MusicLibraryGap,
  type MusicProviderId,
  type MusicState,
} from './models';
import { PRIOR_YIELDS_AT } from '../taste/engine';
import type { MusicAvailability } from './service';
import { months, t, tn } from '../../i18n';

/**
 * Words for connected music, on the Music connections screen and My Sound.
 * Pure. Never claims a connection that isn't there: every state (not set up,
 * not connected, reading, synced, failed, expired) says exactly what's true.
 */

/** "just now", "1 minute ago", "12 minutes ago", "3 hours ago", "yesterday", "4 days ago", "on Sep 12". */
export function syncedAgo(iso: string, now: Date): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const min = Math.max(0, Math.round((now.getTime() - then) / 60_000));
  if (min < 1) return t('just now');
  if (min < 60) return tn(min, '{n} minute ago', '{n} minutes ago');
  const h = Math.round(min / 60);
  if (h < 24) return tn(h, '{n} hour ago', '{n} hours ago');
  const d = Math.round(h / 24);
  if (d === 1) return t('yesterday');
  if (d < 7) return t('{n} days ago', { n: d });
  const day = new Date(then);
  return t('on {date}', { date: t('{month} {day}', { month: months(true)[day.getMonth()], day: day.getDate() }) });
}

/**
 * Where one service stands, as the screen shows it:
 * - unavailable: this build can't connect (not set up, Expo Go, wrong device)
 * - not-connected, connecting (the sign-in sheet is open), connected (no import yet)
 * - syncing, synced
 * - reauthorize: access expired, was removed, or wasn't given: sign in again
 * - failed: the last sync didn't work (network, busy, unknown)
 */
export type ConnectionStatus = 'unavailable' | 'not-connected' | 'connecting' | 'connected' | 'syncing' | 'synced' | 'reauthorize' | 'failed';

export function connectionStatus(c: MusicConnection | undefined, availability: MusicAvailability, connecting: boolean): ConnectionStatus {
  if (connecting) return 'connecting';
  if (!availability.ok) return 'unavailable';
  if (!c) return 'not-connected';
  if (c.syncing) return 'syncing';
  if (c.error === 'expired' || c.error === 'denied') return 'reauthorize';
  if (c.error) return 'failed';
  return c.snapshot ? 'synced' : 'connected';
}

export type ConnectionStat = { value: string; label: string };

export type ConnectionView = {
  status: ConnectionStatus;
  /** The short status in the pill: "Synced", "Sync failed". */
  label: string;
  /** The card's main line: "Connected to Spotify". */
  headline: string;
  /** What's going on, or what to do. */
  detail?: string;
  /** Last synced, artists analyzed, on upcoming festivals (only once there's an import). */
  stats: ConnectionStat[];
  /** Quiet extra facts: a library with nothing in it, or parts the service didn't share. */
  notes: string[];
  /** warn: something needs you; good: working; quiet: nothing going on. */
  tone: 'quiet' | 'good' | 'warn';
  /** The main button, if any. */
  primary?: { action: 'connect' | 'sync'; label: string };
  /** Offer "Disconnect & remove imported music data". */
  canDisconnect: boolean;
  busy: boolean;
};

const UNAVAILABLE: Record<Exclude<MusicAvailability, { ok: true }>['reason'], string> = {
  'not-set-up': t('Not available in this version of Afterglow yet.'),
  'needs-full-app': t('Needs the full version of Afterglow. It can’t connect in this preview.'),
  'not-on-this-device': t('Not available on this device.'),
};

const PART: Record<MusicLibraryGap, string> = {
  saved: t('saved songs'),
  followed: t('followed artists'),
  top: t('top artists'),
  recent: t('recent listening'),
};

const listed = (parts: string[]) => (parts.length < 2 ? parts.join('') : t('{list} and {last}', { list: parts.slice(0, -1).join(', '), last: parts[parts.length - 1] }));

const LABEL: Record<ConnectionStatus, string> = {
  unavailable: t('Not available'),
  'not-connected': t('Not connected'),
  connecting: t('Connecting'),
  connected: t('Connected'),
  syncing: t('Syncing'),
  synced: t('Synced'),
  reauthorize: t('Sign in again'),
  failed: t('Sync failed'),
};

/** What a sign-in that didn't finish says, once, under the card. Cancelling says nothing. */
export function connectProblem(provider: MusicProviderId, reason: MusicErrorKind | 'cancelled' | undefined): string | undefined {
  const name = PROVIDER_NAME[provider];
  switch (reason) {
    case undefined:
    case 'cancelled':
      return undefined;
    case 'denied':
      return t('{service} didn’t connect: access wasn’t allowed. You can try again any time.', { service: name });
    case 'network':
      return t('Couldn’t reach {service}. Check your connection and try again.', { service: name });
    case 'rate-limited':
      return t('{service} is busy right now. Try again in a few minutes.', { service: name });
    case 'unavailable':
      return UNAVAILABLE['not-set-up'];
    default:
      return t('{service} didn’t connect. Try again.', { service: name });
  }
}

export function connectionView(
  provider: MusicProviderId,
  c: MusicConnection | undefined,
  availability: MusicAvailability,
  now: Date,
  reach: {
    /** The sign-in sheet is open. */
    connecting?: boolean;
    /** Of this service's artists, how many Afterglow has. */
    matched?: number;
    /** Of those, how many play an upcoming festival. */
    upcoming?: number;
  } = {},
): ConnectionView {
  const name = PROVIDER_NAME[provider];
  const status = connectionStatus(c, availability, !!reach.connecting);
  const snap = c?.snapshot;
  const base = { status, label: LABEL[status], stats: [] as ConnectionStat[], notes: [] as string[], canDisconnect: !!c, busy: false };

  const stats: ConnectionStat[] = [];
  const notes: string[] = [];
  if (snap) {
    const n = snap.artists.length;
    stats.push({ value: syncedAgo(snap.syncedAt, now), label: t('Last synced') });
    stats.push({ value: String(n), label: n === 1 ? t('artist analyzed') : t('artists analyzed') });
    if (n > 0 && reach.upcoming !== undefined) stats.push({ value: String(reach.upcoming), label: t('on upcoming festivals') });
    if (n === 0) notes.push(t('Your {service} library had no saved songs, followed artists or top artists to read yet.', { service: name }));
    else if (reach.matched === 0) notes.push(t('None of these artists play Afterglow’s lineups yet, so your map grows from what you do here.'));
    const gaps = MUSIC_SIGNAL_SOURCES.filter((g) => snap.gaps.includes(g));
    if (n > 0 && gaps.length) notes.push(t('{service} didn’t share your {parts} this time, so this uses the rest.', { service: name, parts: listed(gaps.map((g) => PART[g])) }));
  }
  const kept = snap ? ` ${t('Your last import is still used until you disconnect.')}` : '';

  switch (status) {
    case 'unavailable':
      return {
        ...base,
        headline: name,
        detail: `${UNAVAILABLE[(availability as Exclude<MusicAvailability, { ok: true }>).reason]}${snap ? ` ${t('Your last import is still used.')}` : ''}`,
        stats,
        tone: 'quiet',
      };
    case 'not-connected':
      return { ...base, headline: t('Not connected'), detail: t('Start your map from the artists you already play.'), tone: 'quiet', primary: { action: 'connect', label: t('Connect {service}', { service: name }) } };
    case 'connecting':
      return { ...base, headline: t('Connecting to {service}…', { service: name }), detail: t('Finish signing in on {service}’s page.', { service: name }), stats, tone: 'good', busy: true };
    case 'connected':
      return { ...base, headline: t('Connected to {service}', { service: name }), detail: t('Ready to bring in your library.'), tone: 'good', primary: { action: 'sync', label: t('Sync now') } };
    case 'syncing':
      return { ...base, headline: snap ? t('Syncing your library…') : t('Reading your library…'), detail: t('This takes a few seconds.'), stats, tone: 'good', busy: true };
    case 'synced':
      return { ...base, headline: t('Connected to {service}', { service: name }), stats, notes, tone: 'good', primary: { action: 'sync', label: t('Sync now') } };
    case 'reauthorize':
      return {
        ...base,
        headline: c?.error === 'denied' ? t('{service} didn’t allow access', { service: name }) : t('{service} needs you to sign in again', { service: name }),
        detail: `${c?.error === 'denied' ? t('Sign in again to allow Afterglow to read your library.') : t('Access ended or was removed.')}${kept}`,
        stats,
        tone: 'warn',
        primary: { action: 'connect', label: t('Sign in again') },
      };
    case 'failed': {
      const why =
        c?.error === 'rate-limited'
          ? t('{service} is busy right now. Try again in a few minutes.', { service: name })
          : c?.error === 'network'
            ? t('Couldn’t reach {service}. Check your connection and try again.', { service: name })
            : t('Something went wrong reading your library. Try again.');
      return { ...base, headline: t('Couldn’t sync your library'), detail: `${why}${kept}`, stats, notes, tone: 'warn', primary: { action: 'sync', label: t('Try again') } };
    }
  }
}

/** A library with fewer Afterglow artists than this gets a note on My Sound (and doesn't yet replace the starting guess). */
export const LITTLE_LIBRARY = PRIOR_YIELDS_AT;

export type MusicNote = { text: string; action?: 'connect' | 'open' };

/** The services
 in the app's language: "Spotify and Apple Music" ("Spotify or Apple Music" with `or`). */
const namesSaid = (ps: MusicProviderId[], or = false) => {
  const all = ps.map((p) => PROVIDER_NAME[p]);
  if (all.length < 2) return all.join('');
  const list = all.slice(0, -1).join(', ');
  const last = all[all.length - 1];
  return or ? t('{list} or {last}', { list, last }) : t('{list} and {last}', { list, last });
};

/**
 * My Sound's quiet note about connected music, or nothing. `ownSignal`: you've
 * already reacted or rated here, so a nudge to connect isn't needed.
 */
export function musicNote(input: {
  state: MusicState;
  availability: Record<MusicProviderId, MusicAvailability>;
  /** Library artists Afterglow has. */
  matched: number;
  ownSignal: boolean;
}): MusicNote | undefined {
  const { state, availability, matched, ownSignal } = input;
  const conns = MUSIC_PROVIDERS.map((p) => state[p]).filter((c): c is MusicConnection => !!c);
  const syncing = conns.find((c) => c.syncing);
  if (syncing) return { text: t('Bringing in your {service} library…', { service: PROVIDER_NAME[syncing.provider] }) };
  const failed = conns.find((c) => c.error);
  if (failed) {
    const name = PROVIDER_NAME[failed.provider];
    const kept = failed.snapshot ? ` ${t('Your map still uses your last import.')}` : '';
    const text =
      failed.error === 'expired' || failed.error === 'denied'
        ? `${t('{service} needs you to sign in again.', { service: name })}${kept}`
        : `${t('Couldn’t sync {service}.', { service: name })}${kept || ` ${t('Try again from Music connections.')}`}`;
    return { text, action: 'open' };
  }
  const synced = conns.filter((c) => c.snapshot).map((c) => c.provider);
  if (synced.length) {
    if (ownSignal || matched >= LITTLE_LIBRARY) return undefined;
    return {
      text:
        matched === 0
          ? t('None of your {services} artists play Afterglow’s lineups yet, so your map grows from what you do here.', { services: namesSaid(synced) })
          : tn(matched, 'Only {n} of your {services} artists plays Afterglow’s lineups so far. React to clips to place more.', 'Only {n} of your {services} artists play Afterglow’s lineups so far. React to clips to place more.', { services: namesSaid(synced) }),
    };
  }
  if (conns.length || ownSignal) return undefined;
  const offer = MUSIC_PROVIDERS.filter((p) => availability[p]?.ok);
  if (!offer.length) return undefined;
  return { text: t('Connect {services} to start your map from what you already play.', { services: namesSaid(offer, true) }), action: 'connect' };

}
