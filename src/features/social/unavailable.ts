import { t } from '../../i18n';

/**
 * What to say when profiles aren't switched on in this copy of Afterglow
 * (no Firebase settings in the build). Pure. On the website that's expected
 * for now, so it points at the phone app; on a phone it means the app was
 * started without its settings, which only the person running it can fix.
 */
export function accountsOff(web: boolean, what: string): { title: string; body: string } {
  const known = KNOWN[what];
  if (known) {
    const [webTitle, phoneBody] = known();
    return web ? { title: webTitle, body: t('Open Afterglow on your phone to use them.') } : { title: t('Accounts aren’t connected'), body: phoneBody };
  }
  return web
    ? { title: `${what} are in the phone app`, body: t('Open Afterglow on your phone to use them.') }
    : { title: t('Accounts aren’t connected'), body: `${what} need Afterglow’s account settings, and this copy of the app started without them.` };
}

/** Each thing callers name, as whole lines (so each language keeps its own word order). */
const KNOWN: Record<string, () => [string, string]> = {
  Accounts: () => [t('Accounts are in the phone app'), t('Accounts need Afterglow’s account settings, and this copy of the app started without them.')],
  Sprouts: () => [t('Sprouts are in the phone app'), t('Sprouts need Afterglow’s account settings, and this copy of the app started without them.')],
  'Friend codes': () => [t('Friend codes are in the phone app'), t('Friend codes need Afterglow’s account settings, and this copy of the app started without them.')],
  'Friends, crews and friend codes': () => [
    t('Friends, crews and friend codes are in the phone app'),
    t('Friends, crews and friend codes need Afterglow’s account settings, and this copy of the app started without them.'),
  ],
  'Videos from the crowd': () => [t('Videos from the crowd are in the phone app'), t('Videos from the crowd need Afterglow’s account settings, and this copy of the app started without them.')],
};
