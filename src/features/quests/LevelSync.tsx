import { useEffect, useRef } from 'react';
import { useShowLevel } from '../../state/showLevel';
import { useSocial } from '../../state/social';
import { patchStanding } from '../standing/useStanding';
import { LEVEL_SHOWN_FROM } from './daily';
import { useDailyQuests } from './useDailyQuests';

/** How long the level must stay put before it's sent. */
const SETTLE_MS = 3000;

/**
 * Keeps your glow level on your profile for others to see: sent a few
 * seconds after it changes, removed when you switch it off in Edit profile.
 * Renders nothing. Each value is tried once a session, so a database whose
 * rules don't know levels yet is never asked again and again.
 */
export function LevelSync() {
  const social = useSocial();
  const uid = social.user?.uid;
  const has = !!social.profile;
  const show = useShowLevel();
  const daily = useDailyQuests();
  const level = daily.level.level;
  const sent = useRef<string | undefined>(undefined);
  const ready = social.availability.ok && !!uid && has && show !== undefined && daily.ready;
  const want = show && level >= LEVEL_SHOWN_FROM ? level : null;
  useEffect(() => {
    if (!ready || !uid) return;
    const key = `${uid}:${want}`;
    if (sent.current === key) return;
    const t = setTimeout(() => {
      sent.current = key;
      social.service
        .setLevel(want)
        .then(() =>
          patchStanding(uid, (s) => {
            const { level: _old, ...rest } = s;
            return want ? { ...rest, level: want } : rest;
          }),
        )
        .catch(() => {});
    }, SETTLE_MS);
    return () => clearTimeout(t);
  }, [ready, uid, want, social.service]);
  return null;
}
