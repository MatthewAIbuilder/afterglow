# Getting Afterglow into the App Store

A checklist for when you're ready to put Afterglow in front of people on
TestFlight and then the App Store. It's written from what the app does today
(October 2026). Nothing here has to happen before you keep testing in Expo Go.

## What you need first

1. **An Apple Developer account** ($99 a year) at developer.apple.com, in your
   own name or a company's. The name shows on the App Store as the seller.
2. **An Expo account** at expo.dev (free), signed in on your PC with
   `npx eas-cli@latest login`.
3. **A bundle identifier**: the app's permanent ID. A good one is
   `app.afterglowmusic` (it matches the afterglowmusic.app domain you own).
   EAS asks for it on the first build and saves it; it can't be changed after
   the app is in the store.

## Step 1: a build on your own iPhone (TestFlight)

From the project folder on your PC:

```
npx eas-cli@latest build --profile production --platform ios
```

EAS asks you to sign in to Apple and makes the certificates for you; say yes
to each. When the build is done (about 20 minutes):

```
npx eas-cli@latest submit --platform ios --latest
```

This sends it to App Store Connect. In a few minutes it shows up in the
TestFlight app on your phone (install TestFlight from the App Store, sign in
with the same Apple ID). Friends can test it too: App Store Connect →
TestFlight → add them as testers.

The development build in `docs/spotify-setup.md` is a different thing: it's
for testing Spotify sign-in while you work. TestFlight is the real app.

## Step 2: the App Store listing

In App Store Connect → your app:

- **Name**: Afterglow (if it's taken, something like "Afterglow: Festival
  Sets").
- **Subtitle** (30 characters): for example "Your festival, set to set".
- **Category**: Music (secondary: Entertainment).
- **Screenshots**: 6.9-inch iPhone screenshots are required. Discover, My
  Sound, a festival page and Your festival make a good set. The app is set to
  run on iPad too (`supportsTablet` in `app.json`), which means iPad
  screenshots are required as well. If you'd rather not, ask me to switch iPad
  off before the first build.
- **Privacy Policy URL**: https://afterglowmusic.app/legal/privacy
- **Support URL**: https://afterglowmusic.app (or a page with the support
  email, afterglowmusic.support@gmail.com).

## Step 3: App Privacy (the "nutrition label")

Apple asks what the app collects. From the code, the honest answers are:

| Data | Collected? | Why | Linked to the person? |
| --- | --- | --- | --- |
| Email address | Yes, with a profile | Signing in | Yes |
| Name, @handle, photo, bio | Yes, with a profile | Their public profile | Yes |
| Photos or videos | Yes, only videos they choose to share | Shown on their profile, in Discover and to their crew | Yes |
| Other user content | Yes: comments, crew check-ins and replies, festival picks shared with a crew | App functionality | Yes |
| User ID | Yes (the Firebase account id) | App functionality | Yes |
| Location | **No**: Near you and filming guesses stay on the phone, and only a town name and rounded point are kept there | | |
| Music library (Spotify) | **No**: read on the phone and kept there | | |
| Health, timers, check-ins in Look after yourself | **No**: only on the phone | | |
| Usage data, crash data, advertising | **No**: there's no analytics or advertising | | |

"Used for tracking": **No** for everything. Afterglow doesn't share data with
advertisers or data brokers.

If anything changes later (analytics, crash reports, push notifications from
a server), these answers need updating.

## Step 4: questions Apple will ask

- **Encryption**: the app only uses standard HTTPS, so it's exempt. This is
  already declared in `app.json` (`usesNonExemptEncryption: false`), so
  Apple won't ask on each upload.
- **Age rating**: answer the questionnaire honestly. Afterglow has user
  content (videos, comments, profiles) and is about nightlife and festivals;
  expect a rating of 13+ or higher. Sign-up already says "I'm 13 or older".
- **Sign-in for the reviewer**: App Review needs a test account. Make one in
  the app (for example `appreview@…` with a password you'll share only in App
  Store Connect → App Review Information), follow a couple of people and share
  a video, so the reviewer sees the social side working.
- **Review notes**: say that festivals and set times come from official
  lineups and EDMTrain, clips are YouTube's own player, and that Spotify
  connection needs a Spotify account (or that it's switched off, see below).

## Step 5: things App Review checks that Afterglow already does

- **User-generated content** (guideline 1.2): people agree to the community
  guidelines before posting; they can report videos, comments and profiles and
  block people; a reported video disappears straight away for the person who reported it. Reports go to the
  `reports` collection in Firebase, so **someone has to read them**: check the
  Firebase console (Firestore → reports) regularly and remove what breaks the
  rules. Apple expects action within 24 hours.
- **Account deletion** (5.1.1): Profile → Edit profile → Delete account.
- **Sign in with Apple** (4.8): only needed if the app offers Google or
  another social sign-in. It only has email and password, so it isn't needed
  yet. If Google sign-in is added later, Sign in with Apple must come with it.
- **Health and safety**: Look after yourself never names substances or gives
  dosing advice, sends people to medics and the local emergency number, and
  keeps everything on the phone.

## Before the first public release

- **Spotify**: in Spotify's development mode only 5 named people can connect.
  Either apply for Spotify's extended quota mode in Spotify's developer
  dashboard, or tell App Review it's limited to test users. Apple Music says "Needs the full version" and never
  pretends to connect, which is fine.
- **Legal pages**: `docs/legal.md` lists what's still needed: your name or
  company and where you're based, and a review by someone qualified.
- **Firebase**: rules and indexes deployed (`docs/firebase-setup.md` step 5),
  and Firebase on the Blaze plan (it is).
- **Real content**: festivals with clips in Discover (the nightly YouTube
  clips need the `YOUTUBE_API_KEY` secret), so a reviewer doesn't open an
  empty feed.

## Updates later

Small fixes to screens and words can go out without a new review using
`npx eas-cli@latest update` (ask me to set it up when you get there). New
native features (a new permission, a new Expo module) need a new build and
review.
