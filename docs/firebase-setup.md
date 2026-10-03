# Setting up profiles (Firebase)

Profiles, sharing memories, finding people, reporting and blocking run on **Firebase** (Google). Until it's set up, the app works exactly as before and Profile says profiles aren't available yet. **Memories work without any of this**: they stay on your phone.

Profiles work in **Expo Go**; no development build is needed.

## What it costs

- **Authentication** (sign-in) and **Cloud Firestore** (profiles, handles, shared-memory details): free for a small app.
- **Cloud Storage** (the shared videos and profile photos): since late 2024 Google only lets projects use it on the **Blaze** (pay-as-you-go) plan. Blaze still includes a free allowance: about **5 GB stored** plus download and upload traffic each month when the storage bucket is in a US region (us-central1, us-east1 or us-west1). A shared clip is typically 20 to 100 MB, so a handful of testers stays free. You add a card, and you can set a **budget alert** so you hear about any charge long before it matters (step 2).

## 1. Create the project (5 minutes)

1. Go to **console.firebase.google.com** and sign in with a Google account.
2. **Create a project**. Name it `Afterglow`. You can turn Google Analytics off.
3. On the project's home page, click the **</>** (Web) icon to add a web app. Nickname: `Afterglow app`. Don't tick Hosting. Click **Register app**.
4. Firebase shows a `firebaseConfig` block with six values (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`). Keep this page open for step 4. These values are **not secret** (every Firebase app ships them); the security rules in step 5 are what protect the data.

## 2. Switch on the pieces (10 minutes)

1. **Authentication**: in the left menu, Build → Authentication → **Get started** → Sign-in method → **Email/Password** → Enable (only the first switch) → Save.
2. **Firestore**: Build → Firestore Database → **Create database** → choose a location near your users (e.g. `nam5 (United States)`) → **Start in production mode** → Create.
3. **Upgrade to Blaze**: bottom left, click **Upgrade** next to "Spark" → choose **Blaze** → add a billing account. Then, in the Google Cloud billing page it links to, open **Budgets & alerts** → Create budget → e.g. $5 a month with an email alert at 50%.
4. **Storage**: Build → Storage → **Get started** → **Start in production mode** → pick a **US** location (for the free allowance) → Done.

## 3. Community contact

The App Store asks apps where people share content to publish a way to reach you. Tell me the email address to use (e.g. a new `afterglow.support@…` address) and I'll put it in `SUPPORT_EMAIL` in `src/config/app.ts`, where it shows under the community guidelines. **Reports** people send arrive in Firestore under `reports` (Firebase console → Firestore → `reports`). Check them regularly, and remove anything that breaks the guidelines (delete the `memories` document and its files in Storage, or the whole account under Authentication).

## 4. Put the config on your PC

In the Afterglow folder, open `.env` (create it from `.env.example` if you haven't: `copy .env.example .env`) and fill in the six values from step 1.4:

```
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=afterglow-xxxx.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=afterglow-xxxx
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=afterglow-xxxx.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
EXPO_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abc123
```

(No quotes, no spaces.) For builds made by EAS (TestFlight), add the same six with `npx eas-cli@latest env:create --name <NAME> --value <value> --environment production --visibility plaintext` (and `--environment preview` for test builds).

## 5. Install the security rules (5 minutes, once, and again whenever I change them)

The rules decide who can read and write what: only you can change your profile and your shared videos, a handle belongs to one person, blocks are private, festival crews' picks are seen only by the crew, reports can't be read back, and uploads are limited to videos and photos of sensible size. They're in the repo as `firestore.rules`, `storage.rules` and `firestore.indexes.json`, and they have been checked against Firebase's own emulator (`scripts/firebase-rules.test.mjs`).

In PowerShell, in the Afterglow folder:

```powershell
npx firebase-tools@latest login
npx firebase-tools@latest use --add
```

(pick your `afterglow-xxxx` project; call the alias `default`), then:

```powershell
npx firebase-tools@latest deploy --only firestore,storage
```

It should end with "Deploy complete!" (this also creates the indexes Afterglow needs). If you'd rather not use the command line, paste the contents of `firestore.rules` into Firebase console → Firestore → **Rules** → Publish, and `storage.rules` into Storage → **Rules** → Publish, then add the two indexes by hand: Firestore → **Indexes** → Composite → Create index → collection `memories`, fields `uid` Ascending and `capturedAt` Descending, query scope Collection; then six more: `memories` with `festivalId` Ascending and `createdAt` Descending; `memories` with `uid` Ascending and `createdAt` Descending; `follows` with `from` Ascending and `createdAt` Descending; `follows` with `to` Ascending and `createdAt` Descending; `likes` with `memoryId` Ascending and `createdAt` Descending; `likes` with `owner` Ascending and `createdAt` Descending. They take a few minutes to build.

> **Automatic from 2026-10-03:** every merge to `main` now deploys these rules and indexes too (the "Database and storage rules" step in `.github/workflows/website.yml`, with the same key as the website). If that step shows a yellow warning on the Actions tab, run the deploy command above once by hand. Founders (the first 100), comments, crew updates, friend codes, cover photos, crew photos, support messages and glow levels on profiles all need the current rules: without them those features quietly fail.

> **Updated 2026-10-02 (crew updates and comments):** the rules and indexes changed again. Run the deploy command above once more so crews can post updates and people can comment. Firebase builds the new comment indexes in a few minutes; comments may say they couldn't load until it's done.

> **Updated 2026-10-03 (crew invites in the app):** a new `crewInvites` collection and index. Run the deploy command again (or let the automatic step do it once its key has the roles in `docs/web-deploy.md`).

> **Updated 2026-10-02 (replies to crew updates):** one more small rules change, so crewmates can reply to each other's updates and a crew video that stopped half way can be sent again. Run the same deploy command again.

## 6. Try it (in Expo Go)

Restart the app with the new `.env`: `npx expo start --go --clear`, and open it in Expo Go.

1. **Profile** → **Create your profile** → New here: your email, a password (8+ characters), tick **I agree to the community guidelines** → Create profile.
2. **Your profile**: name, handle (it's suggested from your email; it says "Available" or "Someone already has that handle"), a bio, optionally a photo (after the first save), and the two switches **Show festivals I'm going to** and **Show my sound** → Create profile. Profile now shows your name and @handle.
3. **Share a memory**: add a video (press and hold a clip in Discover), open it in Memories → **Share to profile** → read the note → Share. The button shows progress, then **On your profile**.
4. **See it as others do**: Profile → Edit profile → **See your profile as others do**. Your memory is in the grid; tap it to watch.
5. **A second person** (a second phone with Expo Go, or sign out and create another account): Profile → **Find people** → type `@` and your first handle → open the profile → **•••** → **Report** (choose a reason; it appears in Firestore → `reports`) and **Block** (the profile then says "You blocked @…", and search no longer shows it).
6. **Going to**: with "Show festivals I'm going to" on, tap **I'm going** on a festival; a few seconds later your profile shows it.
7. **Remove from profile**: in the memory → **On your profile** → Remove. It's gone from the profile (and from Storage), still in your Memories.
8. **Videos from the crowd in Discover**: with the second account signed in, open Discover on the festival your first account's memory is tagged with (it needs an artist from that lineup). After a clip or two, the shared video plays in the feed with **Filmed by @yourhandle** under it; tap that to open the profile. The **•••** beside it offers Report, Hide and Block, and each makes it disappear straight away. **What to discover** (tap the festival name at the top) has a **Videos from the crowd** switch to turn them off.
9. **Follow**: as the second account, open the first account's profile (Find people) → **Follow**. It turns into **Following** and the profile says "1 follower". Tap **1 follower** to see the list. Then Discover → tap the name at the top → **Following**: the first account's shared videos play there. Tap **Following** on the profile again to unfollow; their videos leave the Following feed.
10. **Likes**: as the second account, like the first account's video in Discover (or open it from their profile and tap the heart). As the first account, open Festivals → the bell: "@… liked your video of …" and "@… started following you". Open your video from your profile: it says "1 like"; tap it to see who.
11. **Delete account**: Profile → Edit profile → **Delete account** → your password → **Delete account forever**. Your profile, handle, shared videos and the account are removed; your Memories stay on the phone.

## Troubleshooting

| What you see | Fix |
|---|---|
| Profile still says profiles aren't available | `.env` is missing a value (API key, project id, app id or storage bucket), or the app wasn't restarted with `--clear`. |
| "Couldn't reach Afterglow" when saving or sharing | Rules not deployed yet (step 5), Firestore/Storage not created, or no internet. |
| Sharing fails straight away | Storage isn't set up, or the project isn't on Blaze (step 2.3). |
| A profile opens but says "Couldn't load memories just now" | The index isn't there yet: deploy with the command in step 5, or add it by hand, and wait a few minutes for it to build. |
| Follower lists or Following in Discover stay empty or say they couldn't load | The new indexes aren't built yet: deploy again (step 5) and wait a few minutes. |
| No videos from the crowd in Discover | You're signed out, the switch in What to discover is off, the second index isn't built yet (step 5), or the shared memory isn't tagged with an artist on that festival's lineup. Your own shared videos never show in your own feed. |
| "That video is too big to share" | Shared videos are capped at 150 MB. Trim it when choosing (iPhone), or share a shorter clip. |
