import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { FriendCard } from '../features/friends/qr';
import { cleanPendingInvite, type Invitee, newInvitees } from '../features/invites/invites';
import { inviteListeners, inviterOf, invitesOf, notifyInvites } from './invitesStore';
import { notifyNow } from '../lib/notifyNow';
import { useFriendAdds } from './friendAdds';
import { useSocial } from './social';
import { t } from '../i18n';

/**
 * Invites (features/invites): the link someone opened before they had a
 * profile (kept on this phone, `pendingInvite.v1`), recorded once they make
 * one (`InviteClaim` in the root layout); and, for you, the friends who joined
 * from your link (`useMyInvites`, with a notification for each new one) and
 * who invited you (`useMyInviter`, for the "Came with @…" badge).
 */
export const PENDING_INVITE_KEY = 'pendingInvite.v1';
const SEEN_KEY = 'invitesSeen.v1';
/** A profile made this long before the link was opened is an old account, not someone the link brought. */
const NEW_PROFILE_SLACK_MS = 60 * 60 * 1000;
const INVITES_MAX = 200;

/** Someone without a profile opened your invite link on this phone: kept until they have one. */
export async function rememberInvite(card: FriendCard): Promise<void> {
  await AsyncStorage.setItem(PENDING_INVITE_KEY, JSON.stringify({ card, at: Date.now() })).catch(() => {});
}

/**
 * Records the invite once you have a profile (made after the link was opened),
 * then makes you friends with whoever invited you. Draws nothing.
 */
export function InviteClaim() {
  const social = useSocial();
  const { add } = useFriendAdds();
  const uid = social.user?.uid;
  const madeAt = social.profile?.createdAt;
  const service = social.service;
  useEffect(() => {
    if (!uid || !madeAt || claiming) return;
    claiming = true;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(PENDING_INVITE_KEY).catch(() => null);
        const pending = raw ? cleanPendingInvite(JSON.parse(raw), Date.now()) : undefined;
        if (!pending) {
          if (raw) await AsyncStorage.removeItem(PENDING_INVITE_KEY).catch(() => {});
          return;
        }
        const made = Date.parse(madeAt);
        // Your own link, or an account that was already here: nothing to record (a friend link still makes friends).
        const counts = pending.card.uid !== uid && (!Number.isFinite(made) || made >= pending.at - NEW_PROFILE_SLACK_MS);
        if (counts) await service.claimInvite(pending.card.uid);
        // Done either way (recording is once ever, so a repeat is harmless): forget the link, make friends.
        await AsyncStorage.removeItem(PENDING_INVITE_KEY).catch(() => {});
        if (pending.card.uid !== uid) void add(pending.card);
        invalidateInviter();
      } catch {
        // No signal: tried again next time.
      } finally {
        claiming = false;
      }
    })();
  }, [uid, madeAt, service, add]);
  return null;
}

/** One claim at a time, however often the profile refreshes. */
let claiming = false;

// Who joined from your link, and who invited you, per account (state/invitesStore.ts).
const listeners = inviteListeners;
const notify = notifyInvites;

/** Friends who joined from your invite link (newest first), loaded when there's a profile and again when the app comes back. */
export function useMyInvites(): { invitees: Invitee[]; count: number; loaded: boolean } {
  const social = useSocial();
  const uid = social.profile ? social.user?.uid : undefined;
  const [, bump] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setTick((n) => n + 1));
    return () => {
      listeners.delete(l);
      sub.remove();
    };
  }, []);
  useEffect(() => {
    if (!uid) return;
    let live = true;
    social.service
      .myInvites(INVITES_MAX)
      .then(async (list) => {
        if (!live) return;
        invitesOf.set(uid, list);
        notify();
        // A notification for each friend new since you last looked (not the first time ever on this phone).
        const raw = await AsyncStorage.getItem(`${SEEN_KEY}:${uid}`).catch(() => null);
        const seen = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
        const fresh = raw ? newInvitees(list, seen) : [];
        await AsyncStorage.setItem(`${SEEN_KEY}:${uid}`, JSON.stringify(list.map((i) => i.uid))).catch(() => {});
        if (raw) {
          for (const i of fresh.slice(0, 3)) {
            const p = await social.service.profileOf(i.uid).catch(() => null);
            if (p) void notifyNow(`invite-joined:${i.uid}`, t('{name} joined from your invite 🎉', { name: p.displayName }), t('You’re friends now. Every friend who joins counts towards your rewards.'), `/u/${p.handle}`);
          }
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [uid, social.service, tick]);
  const invitees = uid ? (invitesOf.get(uid) ?? []) : [];
  return { invitees, count: invitees.length, loaded: !!uid && invitesOf.has(uid) };
}

function invalidateInviter() {
  inviterOf.clear();
  notify();
}

/** The @handle of whoever invited you, when you joined from someone's link. */
export function useMyInviter(): string | undefined {
  const social = useSocial();
  const uid = social.profile ? social.user?.uid : undefined;
  // Bumped when anything changes (an invite just recorded clears who invited you, to read it again).
  const [version, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  useEffect(() => {
    if (!uid || inviterOf.has(uid)) return;
    let live = true;
    social.service
      .myInviter()
      .then(async (x) => {
        const p = x ? await social.service.profileOf(x.by).catch(() => null) : null;
        if (!live) return;
        inviterOf.set(uid, p?.handle ?? null);
        notify();
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [uid, social.service, version]);
  return uid ? (inviterOf.get(uid) ?? undefined) : undefined;
}
