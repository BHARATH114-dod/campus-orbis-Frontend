import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNotifications } from '../context/NotificationContext';
import { fetchPushPublicKey, registerPushSubscription } from '../services/authService';
import { setCurrentPushEndpoint } from '../services/pushSubscriptionStore';

// PushManager.subscribe() needs the VAPID public key as a raw Uint8Array,
// but the backend hands it over as a URL-safe base64 string — this is the
// standard conversion for that.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// One toast per browser session is enough to let a student/faculty/HOD
// know why they aren't getting device notifications, without nagging them
// on every page load.
let deniedToastShownThisSession = false;

/**
 * Sets up real, OS-level push notifications for the signed-in user:
 *  1. Registers the service worker (public/sw.js).
 *  2. Asks the browser for notification permission — does nothing if
 *     already denied (browsers refuse to re-prompt anyway; this hook
 *     respects that rather than fighting it) or if the browser doesn't
 *     support the Push API at all (fails safe: the rest of the app,
 *     including in-app notifications, works exactly the same either way).
 *  3. Subscribes this browser/device via PushManager and sends the
 *     subscription to the backend (POST /api/push/subscribe) so
 *     server.js can push to it later — see sendPushToUsers() there.
 *  4. Listens for the service worker telling this tab which page to open
 *     when the user clicks an OS notification, and navigates there with
 *     React Router (no full page reload).
 *
 * Call this once, near the root of the app, inside both AuthProvider and
 * BrowserRouter (it needs useAuth() and useNavigate()) — see App.jsx.
 */
export function usePushNotifications() {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { refresh } = useNotifications();
  const navigate = useNavigate();
  const registeredRef = useRef(false);

  // Click-to-navigate: registered independent of auth state so it's ready
  // the moment the service worker posts a message, and re-attached
  // whenever navigate/refresh identity changes rather than only once.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event) => {
      if (event.data?.type === 'push-notification-click' && event.data.url) {
        navigate(event.data.url);
        refresh(); // the click almost certainly means "read this" — refresh the bell/badge right away instead of waiting for the next poll
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate, refresh]);

  useEffect(() => {
    if (!isAuthenticated || registeredRef.current) return;
    // Unsupported browser/context (very old browser, or a non-HTTPS
    // non-localhost origin) — fails safe, nothing else in the app depends
    // on this succeeding.
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

    (async () => {
      try {
        if (Notification.permission === 'denied') {
          if (!deniedToastShownThisSession) {
            deniedToastShownThisSession = true;
            showToast('Notifications are blocked for Campus Orbis in this browser — enable them in your browser settings to get real-time alerts.', 'info', 6000);
          }
          return;
        }

        const vapid = await fetchPushPublicKey();
        if (!vapid?.enabled || !vapid?.publicKey) return; // backend has no VAPID keys configured — push is disabled server-side, nothing to do here

        const registration = await navigator.serviceWorker.register('/sw.js');

        const permission = Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission();
        if (permission !== 'granted') return; // user just declined the prompt — respected silently, no error, nothing else in the app is affected

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true, // required by the spec — every push must result in a visible notification, never a silent background wake-up
            applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
          });
        }

        await registerPushSubscription(subscription.toJSON());
        setCurrentPushEndpoint(subscription.endpoint);
        registeredRef.current = true;
      } catch (err) {
        // Not fatal — the rest of the app (including in-app notifications)
        // works fine without push. Common causes: permission just denied,
        // browser doesn't support the Push API in this context, or the
        // device is offline.
        console.error('Push notification setup failed:', err);
      }
    })();
  }, [isAuthenticated, showToast]);
}
