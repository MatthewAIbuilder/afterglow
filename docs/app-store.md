# Getting Afterglow into the App Store

A checklist for when you're ready to put Afterglow in front of people on
TestFlight and then the App Store. It's written from what the app does today
(October 2026). Nothing here has to happen before you keep testing in Expo Go.

## What you need first

1. **An Apple Developer account** ($99 a year) at developer.apple.com, in your
   own name or a company's. The name shows on the App Store as the seller.
2. **An Expo account** at expo.dev (free), signed in on your PC with
   `npx eas-cli@latest login`.
3. **A bundle identifier**: the app's permanent ID, `app.afterglowmusic`
   (chosen on 2026-10-03; it's in `app.json` for iPhone and Android). It
   can't be changed after the app is in the store.

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

A full draft (names and subtitles with character counts, promotional text,
description, keywords, age rating and privacy answers, and what only you can
decide) is in [`docs/app-store/listing.md`](app-store/listing.md); the
screenshots come from GitHub (Actions → App Store screenshots → Run
workflow, then download the zip from the finished run). In short, in App Store Connect → your app:

- **Name**: Afterglow (if it's taken, something like "Afterglow: Festival
  Sets").
- **Subtitle** (30 characters): for example "Your festival, set to set".
- **Category**: Music (secondary: Entertainment).
- **Screenshots**: 6.9-inch iPhone screenshots are required. Discover, My
  Sound, a festival page and Your festival make a good set. The app is
  iPhone only (`supportsTablet` is off in `app.json`), so no iPad screenshots
  are needed. (It still opens on an iPad, in an iPhone-sized window.)
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
| Photos | Yes, only photos sent to a crew (and profile and cover photos) | Shown to that crew (or on their profile) | Yes |
| Other user content | Yes: comments, crew chat messages, crew check-ins and replies, festival picks shared with a crew, sprouts given (kind, note, who gave and who picked it up), support messages | App functionality | Yes |
| User ID | Yes (the Firebase account id) | App functionality | Yes |
| Location | **No**: Near you and filming guesses stay on the phone, and only a town name and rounded point are kept there | | |
| Music library (Spotify) | **No**: read on the phone and kept there | | |
| Health and fitness: stopwatches, what they're for, pulse checks, steps, check-ins in Look after yourself | **No**: only on the phone (steps are read from the phone's motion counter and not stored) | | |
| Usage data (Product interaction) | Yes, for signed-in accounts: the days the app was opened, the platform and app version (for the team's dashboard; never what anyone did in it) | Analytics | Yes |
| Crash data, advertising | **No**: no crash reporting service and no advertising | | |

"Used for tracking": **No** for everything. Afterglow doesn't share data with
advertisers or data brokers.

If anything changes later (analytics, crash reports, push notifications from
a server), these answers need updating.

**The privacy manifest** (Apple has required one since May 2024) is already
in `app.json` under `ios.privacyManifests`, and the build writes it into the
app: no tracking, and the four "required reason" system features the app and
React Native use, each with Apple's reason code: saved settings on the phone
(UserDefaults, `CA92.1`), file dates of its own files (`C617.1`), time since
the phone started for timing (`35F9.1`) and free space before saving videos
(`E174.1`). Expo's own modules bring their manifests with them. If Apple's
upload ever warns about a missing reason, it names the API: add it there.

## Step 4: questions Apple will ask

- **Encryption**: the app only uses standard HTTPS, so it's exempt. This is
  already declared in `app.json` (`usesNonExemptEncryption: false`), so
  Apple won't ask on each upload.
- **Age rating**: answer the questionnaire honestly. Afterglow has user
  content (videos, comments, profiles) and is about nightlife and festivals;
  the timing guide in Look after yourself means frequent drug references, so
  the rating is 18+ (decided 2026-10-05; sign-up says "I'm 18 or older").
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
- **Sign in with Apple** (4.8): the app offers Google sign-in, so it has
  Sign in with Apple too (since 1.0.5, `docs/sign-in-providers.md`). Deleting
  an Apple account confirms with Apple (5.1.1).
- **Health and safety**: Look after yourself has a harm-reduction timing guide
  (when common substances, including alcohol, usually start, peak and wear
  off; risky mixes; "don't take more too soon"). It never gives doses, sends
  people to medics and the local emergency number, and keeps everything on the
  phone. Before submitting:
  - Answer the age rating questionnaire with **frequent/intense alcohol, tobacco
    or drug use or references**, which makes the app **17+**.
  - Have the timing figures in `src/features/care/guide.ts` checked against
    DanceSafe's or TripSit's own pages by someone qualified (they're typical
    ranges written from general harm-reduction guidance). On 2026-10-10 they
    were cross-checked against TripSit's published data and widened where
    they fell short (`docs/history.md`); that's not a qualified review.
  - In the review notes, say plainly that it's harm reduction: it doesn't sell,
    source or encourage drugs, never gives amounts, and its main message is to
    wait, not mix, and get help. Guideline 1.4.3 (drug use) is the one
    reviewers will look at.

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
- **Website map tiles**: the festival map on the website draws
  OpenStreetMap's own free map, darkened to a night look (no key needed).
  OpenStreetMap allows this for small sites as long as the
  "© OpenStreetMap contributors" credit stays visible, but its servers are
  run by volunteers and aren't meant for a busy commercial app
  (https://operations.osmfoundation.org/policies/tiles/). If the website gets
  a lot of visitors, or before a big launch, move to a paid plan (MapTiler or
  Stadia Maps both have dark maps; CARTO's now needs a key too) and change
  `TILES` in `src/features/festival-map/FestivalMap.web.tsx`. The app on
  phones uses Apple Maps and needs nothing.

## Updates later

Fixes to screens and words go out without a new build or review with
`npm run update` (set up 2026-10-12, in every build from build 4; steps in
`docs/testflight.md`, "Instant updates"). New native features (a new
permission, a new Expo module) need a new build and review, and a new
`version` in `app.json`.
