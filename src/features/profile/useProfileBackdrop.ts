import type { Profile } from '../social/models';
import { useStanding } from '../standing/useStanding';
import { type BackdropId, shownBackdrop } from './backdrops';

/** The animated background a profile shows right now (a Plus one only while its owner has Plus). */
export function useProfileBackdrop(profile: Profile | null | undefined): BackdropId | undefined {
  const standing = useStanding(profile?.uid);
  if (!profile) return undefined;
  return shownBackdrop(profile.backdrop, profile.uid, !!standing?.plus);
}
