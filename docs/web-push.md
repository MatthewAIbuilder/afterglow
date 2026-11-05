# Notifications on the website (web push)

The website, once added to a home screen (`docs/install-web-app.md`), can show notifications like the phone app: crew chat, check-ins, meeting spots, invites and support replies. Off until the sender below is set up (`WEB_PUSH_URL` in `src/config/app.ts` is empty).

## How it works

- `worker/` is a small Cloudflare Worker. It checks the person's Firebase sign-in, keeps each browser's push address under an unguessable id (60 days after its last check-in; no messages are stored) and sends the notification.
- The browser's address is stored in Firestore like a phone's, as `WebPush[id]` beside the Expo tokens (`isWebPushToken` in `features/notifications/push.ts`). No Firestore rules change was needed.
- Whoever sends (a phone or a browser) hands phones' addresses to Expo and browsers' to the Worker (`sendPush` in `features/social/firebase/service.ts`).
- `NotifyCard` (Profile) asks once, from a tap; `WebPushRegistration` then keeps the address fresh. `public/sw.js` shows the notification and opens the right page on tap.
- iPhones only allow this from the installed home-screen app (iOS 16.4+), so the card appears only there. Android and computers: any browser that supports it.

## Set it up (about 15 minutes, from your PC)

1. In a PowerShell window in the project folder: `cd worker`, then `npm install`.
2. Make the keys: `npx web-push generate-vapid-keys --json`. It prints a public and a private key. Keep that window open; don't share the private one anywhere.
3. Log in to Cloudflare: `npx wrangler login` (a browser opens; approve).
4. Create the list of browsers: `npx wrangler kv namespace create SUBS`. It prints an `id`. Open `worker/wrangler.toml` and replace `PASTE_THE_KV_ID_HERE` with it.
5. Store the keys as secrets (Wrangler asks you to paste each one; nothing is written to a file):
   - `npx wrangler secret put VAPID_PUBLIC_KEY`
   - `npx wrangler secret put VAPID_PRIVATE_KEY`
6. Deploy: `npx wrangler deploy`. It prints the Worker's address, like `https://afterglow-push.yourname.workers.dev`.
7. Tell Claude that address (or paste it into `WEB_PUSH_URL` in `src/config/app.ts`) and merge. The website updates by itself.
8. Test: open afterglowmusic.app on your phone, add it to the home screen, open it from there, sign in, Profile → Turn on notifications. Have a friend message you in a crew or chat.

If it says nothing: the Worker's address must match exactly (no trailing slash), `ALLOWED_ORIGIN` in `wrangler.toml` must be `https://afterglowmusic.app`, and the Worker's logs (`npx wrangler tail`) show each call.

## Limits

- Anyone signed in can ask the Worker to notify an address, but addresses are unguessable and only readable by the people in the same crew or chat, the same trust as the phone app.
- The Worker is not part of the website deploy: changes in `worker/` need `npx wrangler deploy` again.
