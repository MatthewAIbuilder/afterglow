import { useEffect } from 'react';
import { startWebInstall } from './webInstall';

/** Draws nothing. On the website, catches the browser's install prompt and registers the service worker as the app starts. */
export function WebInstallSetup() {
  useEffect(() => {
    startWebInstall();
  }, []);
  return null;
}
