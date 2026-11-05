/*
 * Afterglow's service worker (docs/install-web-app.md).
 *
 * For now it only makes the website installable and ready for web push later.
 * It deliberately caches nothing and answers no requests itself, so the
 * website always loads the newest version exactly as a plain page would.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
