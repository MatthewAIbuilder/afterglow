import { useEffect } from 'react';
import { rememberAccount, useSavedAccounts } from '../../state/savedAccounts';
import { useSocial } from '../../state/social';

/**
 * Keeps a saved account's name, @handle and photo up to date while you're
 * signed in to it, so the switcher shows who's who. Only accounts already
 * saved; renders nothing.
 */
export function SavedAccountSync() {
  const social = useSocial();
  const saved = useSavedAccounts();
  const uid = social.user?.uid;
  const p = social.profile;
  const known = !!uid && !!saved?.some((a) => a.uid === uid);
  useEffect(() => {
    if (!known || !uid || !social.user?.email) return;
    void rememberAccount({ uid, email: social.user.email, savedAt: new Date().toISOString(), ...(p ? { name: p.displayName, handle: p.handle, ...(p.avatarUrl ? { avatarUrl: p.avatarUrl } : {}) } : {}) });
  }, [known, uid, social.user?.email, p]);
  return null;
}
