# Add to home screen (the website as a stand-in app)

Until the App Store app is out, afterglowmusic.app can be put on the home screen and opens full screen like an app (2026-11-04, for EDC Orlando). The website deploys from `main` by itself, so this reaches everyone even during the festival freeze (the freeze only skips instant updates to the phone app).

## What's there

- `public/manifest.webmanifest`: name, colours, `display: standalone`, icons. Linked from `public/index.html`.
- `public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`: made from `assets/icon.png` (the maskable one keeps the art inside the middle 80% so Android can crop it round). `apple-touch-icon.png` (180) was already there for iPhone.
- `public/sw.js`: a service worker that caches nothing and answers nothing (the website always loads the newest version). It exists so the site is installable, and is where web push would go. `firebase.json` serves it and the manifest with `no-cache`.
- `src/features/install/`: `installKind.ts` (pure: what this browser can do, tested), `webInstall.ts` (catches Chrome's `beforeinstallprompt`, registers the worker, `useInstallKind`), `WebInstallSetup.tsx` (root layout), `InstallCard.tsx` (the card: "Add Afterglow to your home screen… The App Store app is coming soon.").
- The card is on **Profile** (under the header) and **Festivals** (under the search box, not while searching). It only shows on the website, and not once the site is opened from the home screen. "Not now" hides it for two weeks (`install.snoozed.v1`).

## What each visitor sees

| Visitor | Card says |
|---|---|
| iPhone or iPad, Safari or Chrome | **Show me how**: Share, Add to Home Screen, Add (iOS has no install button to call) |
| iPhone or iPad inside Instagram, TikTok, Facebook… | open afterglowmusic.app in Safari first (those browsers can't add to the home screen) |
| Android Chrome/Edge/Samsung | **Add to home screen** (the browser's own prompt) |
| Android Firefox and others | open the browser menu, Add to Home screen |
| A computer without an install button, an Android app's web view | nothing |

Set `APP_STORE_URL` in `src/config/app.ts` when the App Store app is live, and change the card's second line (`InstallCard.tsx`, with its Spanish in `i18n/es/profile.ts`).

## Not done yet: push notifications on the website

Web push needs three things: the visitor allows notifications (on iPhone this works only from the home-screen app, iOS 16.4+), a push handler in `sw.js`, and **something that sends the push**. Nothing here can send one today: the phone app's pushes go through Expo's push service, which doesn't do web, and the app has no server. Options, each needing a decision: a Cloudflare Worker (free, the domain is already on Cloudflare) or a Firebase Cloud Function (needs the Blaze plan) that sends Web Push with a VAPID key, writing subscriptions to Firestore the way `crews/{id}/push/{uid}` works for phones. Phone reminders (a festival a week and a day before, sets on your route, water) are scheduled on the phone, so on the website they would also have to be sent by that server.
