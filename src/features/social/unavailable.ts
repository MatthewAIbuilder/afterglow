/**
 * What to say when profiles aren't switched on in this copy of Afterglow
 * (no Firebase settings in the build). Pure. On the website that's expected
 * for now, so it points at the phone app; on a phone it means the app was
 * started without its settings, which only the person running it can fix.
 */
export function accountsOff(web: boolean, what: string): { title: string; body: string } {
  return web
    ? { title: `${what} are in the phone app`, body: 'Open Afterglow on your phone to use them.' }
    : { title: 'Accounts aren’t connected', body: `${what} need Afterglow’s account settings, and this copy of the app started without them.` };
}
