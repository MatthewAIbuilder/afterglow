/**
 * The faces `usePersonFace` has read, kept apart from the hook so tests can
 * forget them without loading the social provider.
 */

/** Someone's face as their avatar draws it. */
export type PersonFace = { name: string; avatarUrl?: string };

/** Faces stay fresh this long. */
export const FACE_FRESH_MS = 10 * 60_000;
export const faces = new Map<string, { at: number; face: PersonFace | null }>();
export const askingFaces = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

export const facesVersion = () => version;
export function facesChanged() {
  version++;
  listeners.forEach((l) => l());
}
export function subscribeFaces(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** For tests: forget every face read. */
export function forgetFaces() {
  faces.clear();
  askingFaces.clear();
  facesChanged();
}
