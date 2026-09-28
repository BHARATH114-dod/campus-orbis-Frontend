# Push Notifications (Web Push API + VAPID) — Setup Guide

Campus Orbis sends real, OS-level device notifications — the kind that show
up in your phone's notification shade or your laptop's notification
center — for every event that already creates an in-app notification:
new messages (student↔student, staff↔staff, HOD↔HOD, HOD↔Faculty),
announcements, test published/updated, test results/marks, rejoin request
decisions, course lock/unlock, and everything else that writes to the bell
icon. These arrive even when the Campus Orbis tab is closed or the browser
is only running in the background.

This is the standard **Web Push Protocol** (the same mechanism behind every
"Allow notifications?" browser prompt on the web), authenticated with
**VAPID** keys that the backend generates for itself — there is no
Firebase, no third-party push provider, and no account to sign up for.

## How it fits into the existing project

```
Backend/
  server.js                 ← web-push init + push_subscriptions collection
                               + sendPushToUsers() + 3 routes (edited)
  vapid-keys.json            ← AUTO-GENERATED on first run, gitignored —
                                nothing for you to create

Frontend/
  public/
    sw.js                    ← service worker: receives pushes, shows the
                                OS notification, handles clicks
  src/
    hooks/usePushNotifications.js   ← permission request + subscribe + click routing
    services/pushSubscriptionStore.js ← tiny store so logout can find this device's subscription
    services/authService.js  ← fetchPushPublicKey / registerPushSubscription / unregisterPushSubscription
    App.jsx                  ← mounts the push hook
    context/AuthContext.jsx  ← unregisters the subscription on logout
```

## Setup

There isn't any. This is the whole point of using raw Web Push instead of
a third-party provider — no project to create, no API keys to copy, no
certificates to generate by hand.

1. `cd Backend && npm install` — pulls in `web-push`.
2. `npm start` — on first boot you'll see:
   `Web Push: generated a new VAPID key pair (saved to vapid-keys.json).`
   That file is gitignored and reused on every future restart. (If you'd
   rather manage the keys yourself — e.g. sharing one key pair across
   multiple backend instances — set `VAPID_PUBLIC_KEY` and
   `VAPID_PRIVATE_KEY` env vars; they take priority over the file.)
3. `cd Frontend && npm install && npm run dev` — nothing to configure;
   the public key is fetched at runtime from
   `GET /api/push/vapid-public-key`.

## Try it

1. Log in as a student (or anyone) in a browser tab — a native "Allow
   notifications?" prompt appears shortly after. Click **Allow**.
2. Trigger any of the events above (send that user a message, post an
   announcement they can see, publish a test for their section, etc.)
   from another account/browser/incognito window.
3. A real OS notification appears within a couple of seconds — even with
   the Campus Orbis tab unfocused, minimized, or the browser only running
   in the background. Clicking it opens (or focuses) Campus Orbis and
   navigates straight to the relevant page.

## Design notes

- **Every `notifyUsers()` call site gets push for free.** Push is wired
  in once, inside `notifyUsers()` itself (the same function that already
  writes every in-app/bell notification), so there's no separate list of
  "which events push" to keep in sync — if it shows up in the bell, it
  also becomes a device notification, for the exact same recipients.
- **A user can have multiple device subscriptions** (phone browser,
  laptop browser, a second laptop, ...) — all of them get pushed, stored
  as separate rows keyed by the browser's unique subscription `endpoint`.
- **Dead subscriptions are pruned automatically.** If a push fails because
  the push service reports the subscription is gone for good (uninstalled,
  permission revoked, expired), that row is deleted the next time a push
  is attempted to it — no manual cleanup, no cron job.
- **Logging out unregisters that device's subscription**, so a
  shared/borrowed computer doesn't keep getting notifications meant for
  whoever just signed out.
- **Denied permission is handled gracefully.** If the browser's
  notification permission is denied, Campus Orbis never re-prompts (browsers
  refuse to anyway) and shows one quiet toast explaining how to turn it back
  on — everything else in the app works exactly the same either way.
- This feature is entirely opt-in and fails safe end-to-end: no VAPID keys
  configured → backend just doesn't send pushes; user denies the browser
  prompt → same thing; unsupported browser → same thing. In-app
  notifications (the bell icon) always work regardless.
- **iOS Safari** requires the site to be added to the Home Screen before it
  will deliver background push at all — this is an Apple/WebKit platform
  restriction, not something any web app can configure around.
