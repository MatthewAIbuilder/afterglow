import { useEffect, useRef } from 'react';
import { useShowLevel } from '../../state/showLevel';
import { useSocial } from '../../state/social';
import { isSupportAccount } from '../admin/admin';
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
 *
 * The level is your account's (`useDailyQuests`: glow earned on this phone
 * while signed in to it, never below what the account already shows). It's
 * only sent when it's higher than what the account shows (read fresh), never
 * lowered or removed by itself (only the switch removes it), and never sent
 * to the support account.
 */
export function LevelSync() {
  const social = useSocial();
  const uid = social.user?.uid;
  const has = !!social.profile;
  const support = isSupportAccount(social.user);
  const show = useShowLevel();
  const daily = useDailyQuests();
  const level = daily.level.level;
  const sent = useRef<string | undefined>(undefined);
  const ready = social.availability.ok && !!uid && has && !support && show !== undefined && daily.ready;
  // null: take it off (the switch is off); undefined: nothing to send.
  const want = show === false ? null : level >= LEVEL_SHOWN_FROM ? level : undefined;
  useEffect(() => {
    if (!ready || !uid || want === undefined) return;
    const key = `${uid}:${want}`;
    if (sent.current === key) return;
    const t = setTimeout(() => {
      sent.current = key;
      const send = async () => {
        if (want !== null) {
          // Read fresh: another phone may have sent a higher level since.
          const published = (await social.service.standingOf(uid)).level ?? 0;
          if (published >= want) {
            patchStanding(uid, (s) => ({ ...s, level: published }));
            return;
          }
        }
        await social.service.setLevel(want);
        patchStanding(uid, (s) => {
          const { level: _old, ...rest } = s;
          return want ? { ...rest, level: want } : rest;
        });
      };
      send().catch(() => {
        // Tried again when something changes (signal back, a new level).
        if (sent.current === key) sent.current = undefined;
      });
    }, SETTLE_MS);
    return () => clearTimeout(t);
  }, [ready, uid, want, social.service]);
  return null;
}
