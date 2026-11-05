import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { installKind, type InstallKind } from './installKind';

/**
 * Putting the website on the home screen (docs/install-web-app.md): the part
 * that touches the browser. Website only: on the phone app everything here
 * does nothing and the answer is always `none`.
 *
 * Chrome-family browsers fire `beforeinstallprompt` once, early, so it is
 * caught as the app starts (`startWebInstall`, from the root layout) and held
 * here until someone taps Add to home screen.
 */
type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let held: InstallPromptEvent | null = null;
let justInstalled = false;
let started = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

function onWeb(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

/** The browser's facts, as `installKind` wants them. */
function readKind(): InstallKind {
  if (!onWeb()) return 'none';
  const standalone =
    justInstalled ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return installKind({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints ?? 0, standalone, canPrompt: held !== null });
}

/**
 * Once, as the website starts: catch the browser's install prompt and register
 * the service worker that makes the site installable. Never throws.
 */
export function startWebInstall(): void {
  if (started || !onWeb()) return;
  started = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    held = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    held = null;
    justInstalled = true;
    emit();
  });
  try {
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  } catch {
    // Installing is a nicety: the site works the same without it.
  }
}

/** Show the browser's own install prompt (only when `installKind` is `prompt`). */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = held;
  if (!event) return 'unavailable';
  held = null;
  emit();
  try {
    await event.prompt();
    return (await event.userChoice).outcome;
  } catch {
    return 'unavailable';
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** How this visitor can add Afterglow to their home screen (`none` on the phone app). */
export function useInstallKind(): InstallKind {
  return useSyncExternalStore(subscribe, readKind, () => 'none');
}
