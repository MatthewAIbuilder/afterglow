/*
 * Afterglow's service worker (docs/install-web-app.md, docs/web-push.md).
 *
 * It makes the website installable and shows web push notifications.
 * It deliberately caches nothing and answers no requests itself, so the
 * website always loads the newest version exactly as a plain page would.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// A notification from Afterglow's push sender: { title, body, href }.
self.addEventListener('push', (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch (e) {
    d = {};
  }
  const title = typeof d.title === 'string' && d.title ? d.title : 'Afterglow';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof d.body === 'string' ? d.body : '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { href: typeof d.href === 'string' && d.href.startsWith('/') ? d.href : '/' },
    }),
  );
});

// Tapping it opens (or brings forward) Afterglow at the right page.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((all) => {
      for (const c of all) {
        if ('focus' in c) {
          c.navigate(href).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(href);
    }),
  );
});
