# Google Play: Afterglow on Android

The app is already set up for Android: its ID is `app.afterglowmusic` (the
same as on iPhone) and it has its Android icons. What's left is Google's
account and Google's testing rules. Google changes these rules from time to
time, so check the wording in Play Console when you get there.

For EDC Orlando, Android people use a download link instead
(`docs/testflight.md`, "Android: a download link"). This guide is for the
Play Store itself.

## Step 1: the Play developer account ($25 once)

1. Go to **play.google.com/console/signup** and sign in with a Google account
   (a new one just for Afterglow is tidiest).
2. Choose **Yourself** (a personal account), unless you have a registered
   company with a D-U-N-S number (**An organization**).
3. Pay the $25 (once, not yearly).
4. Verify your identity: a photo ID, your address and a phone number. Google
   may also ask you to sign in to the **Play Console app on an Android phone**
   to prove you have one (borrow one if you need to).

Verification can take a few days, so do this early even though nothing else
needs it yet.

## Step 2: the closed test (the slow part)

New personal accounts must run a **closed test** before the app can go
public. When this was written that meant **at least 12 people** opted in for
**14 days in a row**. Organization accounts usually skip this.

1. Line up 12 or more people with Android phones (add a few spares: people
   drop out). Collect the Gmail address each uses on their phone.
2. Ask me for the Play build (`npx eas-cli@latest build --profile production --platform android`).
   It makes an `.aab` file for the Play Store.
3. In Play Console → **Create app** (name Afterglow, App, Free), then
   **Test and release → Testing → Closed testing → Create track**, upload the
   `.aab`, add the testers' emails, and send them the opt-in link.
4. The testers keep it installed and open it now and then for 14 days.
5. Then **Apply for production** in the Dashboard. Google asks a few questions
   about the test and reviews it (a few days).

## Step 3: the listing (same answers as Apple's)

- Short and full description, screenshots, icon: reuse `docs/app-store/listing.md`.
- **Privacy policy**: https://afterglowmusic.app/legal/privacy
- **Data safety form**: the same honest answers as Apple's privacy table in
  `docs/app-store.md` step 3.
- **Content rating**: fill in the questionnaire honestly (user content,
  nightlife, harm-reduction drug references), the same as Apple's 18+.
- **Target audience**: 18 and over.
- **App access**: the reviewer sign-in from `docs/testflight.md`.

## Suggested timing

- Now: step 1 (identity checks finish in the background).
- Around February 2027: start the 14-day closed test.
- March or April 2027: production, well before EDC Las Vegas.
