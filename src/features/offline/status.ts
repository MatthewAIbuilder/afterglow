/**
 * Whether you're offline, from what the phone reports. Pure. Unknown counts
 * as online (the app never cries wolf); either "not connected" or "connected
 * but the internet isn't reachable" (festival Wi-Fi with no way out) counts
 * as offline.
 */
export type NetworkLike = { isConnected?: boolean | null; isInternetReachable?: boolean | null };

export const isOffline = (s: NetworkLike) => s.isConnected === false || s.isInternetReachable === false;

/** Offline only counts after this long, so a blip in a tunnel doesn't flash a notice. */
export const OFFLINE_AFTER_MS = 2500;
/** "Back online" shows this long, then goes. */
export const BACK_ONLINE_MS = 2500;

export type Notice = 'offline' | 'back' | undefined;

export const NOTICE_TEXT: Record<'offline' | 'back', string> = {
  offline: 'No signal · your plan, lineups and route still work',
  back: 'Back online',
};
