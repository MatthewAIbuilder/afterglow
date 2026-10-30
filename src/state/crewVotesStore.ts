import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanVotes, type Vote } from '../features/crews/votes';

/** Your votes per crew on this phone (`crewVotes.v1`, per account), shared by every screen (state/crewVotes.ts). */
export const CREW_VOTES_KEY = 'crewVotes.v1';

export type Draft = { lineup: Record<string, Vote>; clashes: Record<string, string>; dirty: boolean };
export let drafts: Record<string, Draft> | undefined;
let loading: Promise<Record<string, Draft>> | undefined;
export const listeners = new Set<() => void>();

export function load(): Promise<Record<string, Draft>> {
  if (drafts) return Promise.resolve(drafts);
  loading ??= AsyncStorage.getItem(CREW_VOTES_KEY)
    .then((raw) => {
      const o = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const out: Record<string, Draft> = {};
      for (const [crewId, d] of Object.entries(o)) {
        const v = cleanVotes('me', d);
        if (v) out[crewId] = { lineup: v.lineup, clashes: v.clashes, dirty: !!(d as { dirty?: unknown }).dirty };
      }
      return out;
    })
    .catch(() => ({}))
    .then((d) => {
      drafts ??= d;
      loading = undefined;
      return drafts;
    });
  return loading;
}

export function keep(crewId: string, draft: Draft) {
  drafts = { ...(drafts ?? {}), [crewId]: draft };
  listeners.forEach((l) => l());
  void AsyncStorage.setItem(CREW_VOTES_KEY, JSON.stringify(drafts)).catch(() => {});
}

export function forgetCrewVotes() {
  drafts = undefined;
  loading = undefined;
}

