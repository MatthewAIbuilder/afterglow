import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { haptic } from '../../lib/haptics';
import { setGuestView } from '../../state/adminView';
import { rememberAccount } from '../../state/savedAccounts';
import { useSocial } from '../../state/social';
import { isSupportAccount } from '../admin/admin';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../social/service';
import type { SavedAccount } from './saved';
import { forgetPassword, readPassword, savePassword } from './vault';
import { t } from '../../i18n';

export type SwitchResult = { ok: true } | { ok: false; needsPassword: true; problem?: string } | { ok: false; needsPassword?: false; problem: string };

/**
 * Switching between accounts saved on this phone. Signing in to another
 * account replaces the one you're in, and only once it worked, so a wrong
 * password never leaves you signed out. A saved password that stops
 * working is forgotten and asked for again. After a switch the app starts
 * again from the top (the support account lands on its dashboard).
 */
export function useSwitchAccount() {
  const social = useSocial();
  const { service, releasePush } = social;
  const signedInAs = social.user?.uid;
  const [busy, setBusy] = useState<string | undefined>();

  /** Sign in as `email` and save it; `password` typed, or undefined to use the saved one. */
  const signInAs = useCallback(
    async (target: { uid?: string; email: string }, password: string | undefined, remember: boolean): Promise<SwitchResult> => {
      const saved = password === undefined && target.uid ? await readPassword(target.uid) : null;
      const pw = password ?? saved;
      if (!pw) return { ok: false, needsPassword: true };
      setBusy(target.uid ?? target.email);
      try {
        // The account you're leaving stops sending its notifications to this phone.
        if (signedInAs && signedInAs !== target.uid) await releasePush();
        const user = await service.signIn(target.email, pw);
        if (remember) await savePassword(user.uid, pw).catch(() => {});
        await rememberAccount({ uid: user.uid, email: user.email ?? target.email.trim().toLowerCase(), savedAt: new Date().toISOString() });
        haptic.settle();
        setGuestView(false);
        return { ok: true };
      } catch (e) {
        const kind = socialErrorKind(e);
        if (saved && (kind === 'wrong-password' || kind === 'no-account')) {
          if (target.uid) await forgetPassword(target.uid);
          return { ok: false, needsPassword: true, problem: t('The saved password didn’t work. Type it again.') };
        }
        return { ok: false, problem: SOCIAL_ERROR_COPY[kind] };
      } finally {
        setBusy(undefined);
      }
    },
    [service, signedInAs, releasePush],
  );

  /** After a switch: start again from the top, over whatever was open. */
  const startOver = useCallback((supportNext: boolean) => {
    if (router.canDismiss()) router.dismissAll();
    router.replace(supportNext ? '/admin' : '/');
  }, []);

  const switchTo = useCallback(
    async (a: SavedAccount, password?: string, remember = true) => {
      const r = await signInAs(a, password, remember);
      if (r.ok) startOver(isSupportAccount({ uid: a.uid, email: a.email }));
      return r;
    },
    [signInAs, startOver],
  );

  const addAccount = useCallback(
    async (email: string, password: string, remember: boolean) => {
      const r = await signInAs({ email }, password, remember);
      if (r.ok) startOver(isSupportAccount({ uid: '', email }));
      return r;
    },
    [signInAs, startOver],
  );

  /** Saves the account you're in, checking the password by signing in again (harmless: same account). */
  const saveCurrent = useCallback(
    async (password: string, remember: boolean) => {
      const u = social.user;
      if (!u?.email) return { ok: false, problem: SOCIAL_ERROR_COPY.unknown } as SwitchResult;
      return signInAs({ uid: u.uid, email: u.email }, password, remember);
    },
    [social.user, signInAs],
  );

  return { busy, switchTo, addAccount, saveCurrent };
}
