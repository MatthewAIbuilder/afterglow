/**
 * How a visitor to the website can put Afterglow on their home screen
 * (docs/install-web-app.md). Pure: the browser's facts go in, one answer comes
 * out, so every case is tested.
 *
 * - `installed`: already opened from the home screen. Nothing to offer.
 * - `prompt`: the browser (Chrome, Edge, Samsung Internet) gave us its own
 *   "install" prompt; one tap does it.
 * - `ios-safari`: iPhone or iPad with a browser that can add to the home screen
 *   (Share, then Add to Home Screen). iOS has no install prompt to call.
 * - `ios-other-app`: iPhone or iPad inside another app's own browser
 *   (Instagram, Facebook, TikTok…): those can't add anything, so we say to
 *   open the page in Safari first.
 * - `menu`: an Android browser with no prompt of its own (say, Firefox): its
 *   menu has "Add to Home screen".
 * - `none`: a computer without an install prompt, or not a browser at all.
 */
export type InstallKind = 'installed' | 'prompt' | 'ios-safari' | 'ios-other-app' | 'menu' | 'none';

export type InstallEnv = {
  userAgent: string;
  /** `navigator.maxTouchPoints`: iPadOS 13+ calls itself a Mac, so touch is how to tell. */
  maxTouchPoints: number;
  /** Opened from the home screen: `display-mode: standalone`, or Safari's `navigator.standalone`. */
  standalone: boolean;
  /** The browser fired `beforeinstallprompt` and we are holding it. */
  canPrompt: boolean;
};

/** An in-app browser (a social app's own web view): it can't add to the home screen. */
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|TikTok|musical_ly|BytedanceWebview|Twitter|LinkedInApp|Pinterest|GSA\/|MicroMessenger|Messenger/i;

export function isIOS(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

export function installKind(env: InstallEnv): InstallKind {
  if (env.standalone) return 'installed';
  if (isIOS(env.userAgent, env.maxTouchPoints)) return IN_APP.test(env.userAgent) ? 'ios-other-app' : 'ios-safari';
  if (env.canPrompt) return 'prompt';
  if (/Android/i.test(env.userAgent) && !/; wv\)/.test(env.userAgent)) return 'menu';
  return 'none';
}

/** The card stays away this long after "Not now", then comes back once. */
export const INSTALL_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

/** Whether "Not now" is still in effect. `at` is when it was pressed (ms), if ever. Pure. */
export function snoozed(at: number | undefined, now: number): boolean {
  return typeof at === 'number' && Number.isFinite(at) && now - at < INSTALL_SNOOZE_MS && now >= at;
}
