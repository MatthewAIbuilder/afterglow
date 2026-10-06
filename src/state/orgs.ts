import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { cleanOrg, type Org } from '../features/organizers/organizers';

const STORAGE_KEY = 'orgs.v1';

/**
 * Event organizers' pages, as this phone last read them (kept, so their
 * events still show without signal). A shared store: `OrgSync` fills it, the
 * catalogue adds their published events, and their pages read it.
 */
let orgs: Org[] | undefined;
const listeners = new Set<(o: Org[]) => void>();
let loading: Promise<void> | undefined;

const clean = (raw: unknown): Org[] =>
  Array.isArray(raw) ? raw.map((o) => (o && typeof o === 'object' ? cleanOrg(String((o as { id?: unknown }).id ?? ''), o) : null)).filter((o): o is Org => !!o) : [];

function load() {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => clean(raw ? JSON.parse(raw) : []))
    .catch(() => [] as Org[])
    .then((read) => {
      // Fresh ones read while loading win.
      orgs ??= read;
      listeners.forEach((l) => l(orgs!));
    });
  return loading;
}

/** What the server says now (replaces the kept list). */
export function setOrgs(next: Org[]) {
  if (orgs && JSON.stringify(orgs) === JSON.stringify(next)) return;
  orgs = next;
  listeners.forEach((l) => l(next));
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
}

/** One organizer saved from this phone: shown straight away, before the next read. */
export function rememberOrg(org: Org) {
  const list = orgs ?? [];
  setOrgs(list.some((o) => o.id === org.id) ? list.map((o) => (o.id === org.id ? org : o)) : [...list, org]);
}

/** For tests: forget what's loaded. */
export function forgetOrgs() {
  orgs = undefined;
  loading = undefined;
  listeners.clear();
}

/** Every organizer's page (empty until read). */
export function useOrgs(): Org[] {
  const [o, setO] = useState<Org[]>(orgs ?? []);
  useEffect(() => {
    listeners.add(setO);
    void load().then(() => orgs && setO(orgs));
    return () => {
      listeners.delete(setO);
    };
  }, []);
  return o;
}

/** One organizer's page, if this phone has it. */
export function useOrg(id: string | undefined): Org | undefined {
  const all = useOrgs();
  return id ? all.find((o) => o.id === id) : undefined;
}

/** The organizer the signed-in account runs (its id, keyed by account so another account never sees it), or null. */
let mine: { uid: string; orgId: string | null } | undefined;
const mineListeners = new Set<(m: typeof mine) => void>();
export function setMyOrg(uid: string | undefined, orgId: string | null) {
  const next = uid ? { uid, orgId } : undefined;
  if (mine?.uid === next?.uid && mine?.orgId === next?.orgId) return;
  mine = next;
  mineListeners.forEach((l) => l(next));
}
/** For tests. */
export function forgetMyOrg() {
  mine = undefined;
  mineListeners.clear();
}
/** The organizer this account runs (null when none or not read yet). */
const subscribeMine = (l: () => void) => {
  const f = () => l();
  mineListeners.add(f);
  return () => {
    mineListeners.delete(f);
  };
};
const readMine = () => mine;
export function useMyOrg(uid: string | undefined): string | null {
  const m = useSyncExternalStore(subscribeMine, readMine, readMine);
  return uid && m?.uid === uid ? m.orgId : null;
}
