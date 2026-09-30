import { MUSIC_PROVIDERS, type MusicConnection, type MusicErrorKind, type MusicLibrarySnapshot, type MusicProviderId, type MusicState } from './models';

/**
 * How each service's connection moves through connect, sync, failure and
 * disconnect. Pure, so the rules are tested apart from storage and screens:
 *
 * - A failed sync never touches the last good snapshot.
 * - Expired sign-in marks the service disconnected (connect again) but keeps
 *   the last import in use until you disconnect it.
 * - Disconnecting removes the service entirely: nothing of it stays.
 * - A snapshot is only ever stored under the service it came from.
 */

const base = (provider: MusicProviderId): MusicConnection => ({ provider, connected: false, syncing: false });

export function connected(state: MusicState, provider: MusicProviderId): MusicState {
  const c = state[provider] ?? base(provider);
  return { ...state, [provider]: { ...c, connected: true, error: undefined } };
}

export function syncStarted(state: MusicState, provider: MusicProviderId, now: Date): MusicState {
  const c = state[provider];
  if (!c) return state;
  return { ...state, [provider]: { ...c, syncing: true, lastAttemptAt: now.toISOString() } };
}

export function syncSucceeded(state: MusicState, provider: MusicProviderId, snapshot: MusicLibrarySnapshot): MusicState {
  const c = state[provider];
  // Disconnected while syncing, or a snapshot for another service: drop it.
  if (!c || snapshot.provider !== provider) return state;
  const clean = { ...snapshot, artists: snapshot.artists.filter((a) => a.provider === provider) };
  return { ...state, [provider]: { ...c, connected: true, syncing: false, error: undefined, snapshot: clean } };
}

export function syncFailed(state: MusicState, provider: MusicProviderId, error: MusicErrorKind): MusicState {
  const c = state[provider];
  if (!c) return state;
  return {
    ...state,
    [provider]: { ...c, syncing: false, error, connected: error === 'expired' || error === 'denied' ? false : c.connected },
  };
}

/** A sign-in that didn't finish (you cancelled, said no, or it failed) for a service that wasn't connected yet. */
export function connectFailed(state: MusicState, provider: MusicProviderId, error: MusicErrorKind | undefined): MusicState {
  const c = state[provider];
  if (!c?.snapshot) {
    const { [provider]: _gone, ...rest } = state;
    return rest;
  }
  return { ...state, [provider]: { ...c, syncing: false, error: error ?? c.error } };
}

export function disconnected(state: MusicState, provider: MusicProviderId): MusicState {
  const { [provider]: _gone, ...rest } = state;
  return rest;
}

/** Saved state read back from storage: unknown services, bad records and any in-flight sync are dropped. */
export function cleanMusicState(raw: unknown): MusicState {
  if (!raw || typeof raw !== 'object') return {};
  const out: MusicState = {};
  for (const p of MUSIC_PROVIDERS) {
    const c = (raw as Record<string, unknown>)[p] as Partial<MusicConnection> | undefined;
    if (!c || typeof c !== 'object' || c.provider !== p) continue;
    const snap = c.snapshot;
    const goodSnap =
      snap && typeof snap === 'object' && snap.version === 1 && snap.provider === p && Array.isArray(snap.artists)
        ? { ...snap, artists: snap.artists.filter((a) => a && a.provider === p && typeof a.key === 'string') }
        : undefined;
    out[p] = {
      provider: p,
      connected: c.connected === true,
      syncing: false,
      error: typeof c.error === 'string' ? c.error : undefined,
      lastAttemptAt: typeof c.lastAttemptAt === 'string' ? c.lastAttemptAt : undefined,
      snapshot: goodSnap,
    };
  }
  return out;
}
