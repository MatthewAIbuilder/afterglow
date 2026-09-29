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
  if (min < 1) return 'just now';
  if (min < 60) return `${min} ${min === 1 ? 'minute' : 'minutes'} ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return `on ${new Date(then).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
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
  'not-set-up': 'Not available in this version of Afterglow yet.',
  'needs-full-app': 'Needs the full version of Afterglow. It can’t connect in this preview.',
  'not-on-this-device': 'Not available on this device.',
};

const PART: Record<MusicLibraryGap, string> = {
  saved: 'saved songs',
  followed: 'followed artists',
  top: 'top artists',
  recent: 'recent listening',
};

const listed = (parts: string[]) => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);

const LABEL: Record<ConnectionStatus, string> = {
  unavailable: 'Not available',
  'not-connected': 'Not connected',
  connecting: 'Connecting',
  connected: 'Connected',
  syncing: 'Syncing',
  synced: 'Synced',
  reauthorize: 'Sign in again',
  failed: 'Sync failed',
};

/** What a sign-in that didn't finish says, once, under the card. Cancelling says nothing. */
export function connectProblem(provider: MusicProviderId, reason: MusicErrorKind | 'cancelled' | undefined): string | undefined {
  const name = PROVIDER_NAME[provider];
  switch (reason) {
    case undefined:
    case 'cancelled':
      return undefined;
    case 'denied':
      return `${name} didn’t connect: access wasn’t allowed. You can try again any time.`;
    case 'network':
      return `Couldn’t reach ${name}. Check your connection and try again.`;
    case 'rate-limited':
      return `${name} is busy right now. Try again in a few minutes.`;
    case 'unavailable':
      return UNAVAILABLE['not-set-up'];
    default:
      return `${name} didn’t connect. Try again.`;
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
    stats.push({ value: syncedAgo(snap.syncedAt, now), label: 'Last synced' });
    stats.push({ value: String(n), label: n === 1 ? 'artist analyzed' : 'artists analyzed' });
    if (n > 0 && reach.upcoming !== undefined) stats.push({ value: String(reach.upcoming), label: 'on upcoming festivals' });
    if (n === 0) notes.push(`Your ${name} library had no saved songs, followed artists or top artists to read yet.`);
    else if (reach.matched === 0) notes.push(`None of these artists play Afterglow’s lineups yet, so your map grows from what you do here.`);
    const gaps = MUSIC_SIGNAL_SOURCES.filter((g) => snap.gaps.includes(g));
    if (n > 0 && gaps.length) notes.push(`${name} didn’t share your ${listed(gaps.map((g) => PART[g]))} this time, so this uses the rest.`);
  }
  const kept = snap ? ' Your last import is still used until you disconnect.' : '';

  switch (status) {
    case 'unavailable':
      return {
        ...base,
        headline: name,
        detail: `${UNAVAILABLE[(availability as Exclude<MusicAvailability, { ok: true }>).reason]}${snap ? ' Your last import is still used.' : ''}`,
        stats,
        tone: 'quiet',
      };
    case 'not-connected':
      return { ...base, headline: 'Not connected', detail: 'Start your map from the artists you already play.', tone: 'quiet', primary: { action: 'connect', label: `Connect ${name}` } };
    case 'connecting':
      return { ...base, headline: `Connecting to ${name}…`, detail: `Finish signing in on ${name}’s page.`, stats, tone: 'good', busy: true };
    case 'connected':
      return { ...base, headline: `Connected to ${name}`, detail: 'Ready to bring in your library.', tone: 'good', primary: { action: 'sync', label: 'Sync now' } };
    case 'syncing':
      return { ...base, headline: snap ? 'Syncing your library…' : 'Reading your library…', detail: 'This takes a few seconds.', stats, tone: 'good', busy: true };
    case 'synced':
      return { ...base, headline: `Connected to ${name}`, stats, notes, tone: 'good', primary: { action: 'sync', label: 'Sync now' } };
    case 'reauthorize':
      return {
        ...base,
        headline: c?.error === 'denied' ? `${name} didn’t allow access` : `${name} needs you to sign in again`,
        detail: `${c?.error === 'denied' ? 'Sign in again to allow Afterglow to read your library.' : 'Access ended or was removed.'}${kept}`,
        stats,
        tone: 'warn',
        primary: { action: 'connect', label: 'Sign in again' },
      };
    case 'failed': {
      const why =
        c?.error === 'rate-limited'
          ? `${name} is busy right now. Try again in a few minutes.`
          : c?.error === 'network'
            ? `Couldn’t reach ${name}. Check your connection and try again.`
            : 'Something went wrong reading your library. Try again.';
      return { ...base, headline: 'Couldn’t sync your library', detail: `${why}${kept}`, stats, notes, tone: 'warn', primary: { action: 'sync', label: 'Try again' } };
    }
  }
}

/** A library with fewer Afterglow artists than this gets a note on My Sound (and doesn't yet replace the starting guess). */
export const LITTLE_LIBRARY = PRIOR_YIELDS_AT;

export type MusicNote = { text: string; action?: 'connect' | 'open' };

const names = (ps: MusicProviderId[]) => ps.map((p) => PROVIDER_NAME[p]).join(' and ');

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
  if (syncing) return { text: `Bringing in your ${PROVIDER_NAME[syncing.provider]} library…` };
  const failed = conns.find((c) => c.error);
  if (failed) {
    const name = PROVIDER_NAME[failed.provider];
    const kept = failed.snapshot ? ' Your map still uses your last import.' : '';
    const text =
      failed.error === 'expired' || failed.error === 'denied'
        ? `${name} needs you to connect again.${kept}`
        : `Couldn’t sync ${name}.${kept || ' Try again from Music connections.'}`;
    return { text, action: 'open' };
  }
  const synced = conns.filter((c) => c.snapshot).map((c) => c.provider);
  if (synced.length) {
    if (ownSignal || matched >= LITTLE_LIBRARY) return undefined;
    return {
      text:
        matched === 0
          ? `None of your ${names(synced)} artists play Afterglow’s lineups yet, so your map grows from what you do here.`
          : `Only ${matched} of your ${names(synced)} artists ${matched === 1 ? 'plays' : 'play'} Afterglow’s lineups so far. React to clips to place more.`,
    };
  }
  if (conns.length || ownSignal) return undefined;
  const offer = MUSIC_PROVIDERS.filter((p) => availability[p]?.ok);
  if (!offer.length) return undefined;
  return { text: `Connect ${names(offer).replace(' and ', ' or ')} to start your map from what you already play.`, action: 'connect' };
}
