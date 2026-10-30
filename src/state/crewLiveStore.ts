import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Which crews you're sharing where you are with, and until when (`crewLive.v1`,
 * per account). Shared by the crew page's switch and the sender (state/crewLive.ts).
 */
export const CREW_LIVE_KEY = 'crewLive.v1';

let sharing: Record<string, number> | undefined;
let loading: Promise<Record<string, number>> | undefined;
export const liveListeners = new Set<() => void>();

export function loadSharing(): Promise<Record<string, number>> {
  if (sharing) return Promise.resolve(sharing);
  loading ??= AsyncStorage.getItem(CREW_LIVE_KEY)
    .then((raw) => {
      const o = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(o)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
      return out;
    })
    .catch(() => ({}))
    .then((s) => {
      sharing ??= s;
      loading = undefined;
      return sharing;
    });
  return loading;
}

export const sharingNow = () => sharing ?? {};

export function setSharing(crewId: string, until: number | undefined) {
  const next = { ...(sharing ?? {}) };
  if (until) next[crewId] = until;
  else delete next[crewId];
  sharing = next;
  liveListeners.forEach((l) => l());
  void AsyncStorage.setItem(CREW_LIVE_KEY, JSON.stringify(next)).catch(() => {});
}

export function forgetCrewLive() {
  sharing = undefined;
  loading = undefined;
}
