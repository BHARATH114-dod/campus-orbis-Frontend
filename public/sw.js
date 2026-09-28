// Campus Orbis service worker.
//
// This is what makes push notifications real OS-level notifications
// instead of an in-app-only badge: once registered, the browser/OS keeps
// this worker (and this worker alone) alive in the background to receive
// pushes — it runs even when the Campus Orbis tab is closed, minimized, or
// the browser itself isn't running (platform-dependent: Chrome/Edge/Firefox
// on desktop and Android wake the browser for this; iOS Safari requires the
// site to be "Added to Home Screen" first, a Safari/iOS platform limit, not
// something fixable from here).
//
// Deliberately does NOT do any offline caching / app-shell / PWA-install
// work — this file's only job is push delivery + click-to-navigate.
//
// Payload shape (see sendPushToUsers() in Backend/server.js — this is
// exactly what it sends):
//   { title, body, icon, badge, tag, data: { url, tab, type, related_id } }

self.addEventListener('install', () => {
  // Activate this version immediately rather than waiting for every open
  // tab to close first — there's no cached content here to be stale, so
  // there's no downside to switching over right away.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // Non-JSON payload — fall back to a generic notification rather than
    // dropping it silently.
  }

  const title = payload.title || 'Campus Orbis';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/logo.png',
    badge: payload.badge || '/logo.png',
    tag: payload.tag, // same tag = the OS collapses/replaces instead of stacking duplicate notifications about the same item
    data: payload.data || {},
  };

  // event.waitUntil keeps the service worker alive long enough to finish
  // showing the notification — without it the browser can kill the worker
  // mid-call and the notification silently never appears.
  event.waitUntil(self.registration.showNotification(title, options));
});

// Clicking the OS notification: focus an already-open Campus Orbis tab
// (and tell it which page to go to, so React Router navigates client-side
// with no full reload) or, if none is open, open a fresh tab straight at
// that page.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.postMessage({ type: 'push-notification-click', url: targetUrl });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// A push subscription can expire or be rotated by the browser itself
// (independent of anything the app does) — when that happens, re-subscribe
// with the same VAPID key and tell the backend about the new endpoint so
// this device doesn't silently stop receiving pushes.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const oldKey = event.oldSubscription?.options?.applicationServerKey;
        const newSubscription = await self.registration.pushManager.subscribe(
          oldKey ? { userVisibleOnly: true, applicationServerKey: oldKey } : event.oldSubscription?.options
        );
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ subscription: newSubscription.toJSON() }),
        });
      } catch (err) {
        // Best-effort — if this fails, the next time the app is opened in
        // a foreground tab, usePushNotifications() will notice there's no
        // valid subscription and re-subscribe from there instead.
        console.error('pushsubscriptionchange re-subscribe failed', err);
      }
    })()
  );
});
