import { useEffect, useSyncExternalStore } from 'react';
import { useSocialMaybe } from '../../state/social';
import { askingFaces, FACE_FRESH_MS, faces, facesChanged, facesVersion, type PersonFace, subscribeFaces } from './faces';

/**
 * Someone's name and photo, read once and kept for a while, shared by every
 * place showing them (Discover's cards ask for the same person over and
 * over). Undefined until read, when signed out, when profiles aren't set up
 * or when they have no profile.
 */
export function usePersonFace(uid: string | undefined): PersonFace | undefined {
  const social = useSocialMaybe();
  const ok = !!social?.availability.ok && !!social?.user;
  const service = social?.service;
  useSyncExternalStore(subscribeFaces, facesVersion);
  useEffect(() => {
    if (!ok || !uid || !service) return;
    const hit = faces.get(uid);
    if ((hit && Date.now() - hit.at < FACE_FRESH_MS) || askingFaces.has(uid)) return;
    askingFaces.add(uid);
    service
      .profileOf(uid)
      .then((p) => {
        faces.set(uid, { at: Date.now(), face: p ? { name: p.displayName, avatarUrl: p.avatarUrl } : null });
        facesChanged();
      })
      .catch(() => {})
      .finally(() => askingFaces.delete(uid));
  }, [ok, uid, service]);
  return ok && uid ? (faces.get(uid)?.face ?? undefined) : undefined;
}
