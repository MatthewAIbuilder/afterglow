import { MUSIC_PROVIDERS, PROVIDER_NAME, type MusicConnection, type MusicProviderId, type MusicState } from './models';
import type { MusicAvailability } from './service';

/**
 * Words for connected music, on the Music connections screen and My Sound.
 * Pure. Never claims a connection that isn't there: every state (not set up,
 * not connected, reading, synced, failed, expired) says exactly what's true.
 */

export function syncedAgo(iso: string, now: Date): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const min = Math.max(0, Math.round((now.getTime() - then) / 60_000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return `on ${new Date(then).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export type ConnectionAction = 'connect' | 'sync' | 'disconnect';

export type ConnectionView = {
  /** One line under the service's name. */
  line: string;
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

export function connectionView(
  provider: MusicProviderId,
  c: MusicConnection | undefined,
  availability: MusicAvailability,
  now: Date,
  /** Of this service's artists, how many are on Afterglow's lineups. */
  onLineups?: number,
): ConnectionView {
  const name = PROVIDER_NAME[provider];
  const snap = c?.snapshot;
  const canDisconnect = !!c;
  if (!availability.ok) {
    return {
      line: snap ? `${UNAVAILABLE[availability.reason]} Your last import is still used.` : UNAVAILABLE[availability.reason],
      tone: 'quiet',
      canDisconnect,
      busy: false,
    };
  }
  if (!c) return { line: 'Not connected', tone: 'quiet', primary: { action: 'connect', label: 'Connect' }, canDisconnect, busy: false };
  if (c.syncing) {
    return { line: snap ? 'Syncing your library…' : 'Reading your library…', tone: 'good', canDisconnect, busy: true };
  }
  const kept = snap ? ' Your last import is still used.' : '';
  if (c.error === 'expired') {
    return { line: `Sign-in expired. Connect again to keep it up to date.${kept}`, tone: 'warn', primary: { action: 'connect', label: 'Connect again' }, canDisconnect, busy: false };
  }
  if (c.error === 'denied') {
    return { line: `${name} didn’t give access. Connect again to allow it.${kept}`, tone: 'warn', primary: { action: 'connect', label: 'Connect again' }, canDisconnect, busy: false };
  }
  if (c.error) {
    const why = c.error === 'rate-limited' ? `${name} is busy. Try again in a few minutes.` : 'Couldn’t sync just now.';
    return { line: `${why}${kept || ' Try again.'}`, tone: 'warn', primary: { action: 'sync', label: 'Try again' }, canDisconnect, busy: false };
  }
  if (!snap) return { line: 'Connected. Sync to bring in your library.', tone: 'good', primary: { action: 'sync', label: 'Sync' }, canDisconnect, busy: false };
  const n = snap.artists.length;
  const parts = [
    'Connected',
    `${n} ${n === 1 ? 'artist' : 'artists'}`,
    onLineups !== undefined && n > 0 ? `${onLineups} on Afterglow` : undefined,
    `synced ${syncedAgo(snap.syncedAt, now)}`,
  ].filter(Boolean);
  return { line: parts.join(' · '), tone: 'good', primary: { action: 'sync', label: 'Sync now' }, canDisconnect, busy: false };
}

/** A library with fewer Afterglow artists than this gets a note on My Sound. */
export const LITTLE_LIBRARY = 3;

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
