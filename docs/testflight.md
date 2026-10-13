# TestFlight: Afterglow on friends' iPhones (and an Android link)

TestFlight is Apple's own way to hand out an app before it's in the App Store.
People get an invite link, install Apple's free **TestFlight** app, then
Afterglow. It's the plan for EDC Orlando (`docs/edc-orlando-plan.md`).
Up to 10,000 people can join, and each build lasts 90 days.

Everything on the code side is ready: the app's ID (`app.afterglowmusic`),
the icon, the permission wording, the privacy manifest, the encryption answer
(so Apple doesn't ask on every upload), and build numbers that go up by
themselves. What's left needs your accounts.

**You need:** the Apple Developer welcome email, and the Expo account from
`docs/development-build.md` step 2 (`npx eas-cli@latest login` and
`npx eas-cli@latest init` done once on your PC).

---

## Step 1: make the app in App Store Connect (once, 5 minutes)

1. Go to **appstoreconnect.apple.com** and sign in with your developer Apple ID.
2. Tap **Apps**, then the **+** button, then **New App**.
3. Fill in:
   - **Platforms**: iOS
   - **Name**: Afterglow (if it's taken, try "Afterglow: Festival Sets"; you can change it until the first public release)
   - **Primary language**: English (U.S.)
   - **Bundle ID**: pick **app.afterglowmusic**. If it isn't in the list yet, skip this step for now: step 2 registers it, then come back.
   - **SKU**: anything only you see, like `afterglow1`
   - **User access**: Full access
4. Tap **Create**.

## Step 2: build and send it to Apple (about 30 minutes, mostly waiting)

On your PC, in the Afterglow folder (where you run `npm run go`):

```
npm run build:ios
```

- It asks you to **sign in to Apple**: use your developer Apple ID. Say **yes**
  to every question about certificates and profiles; EAS makes them for you.
- If it asks for an **App Store Connect API key**, say yes and let it make one.
- The build runs on Expo's computers (about 20 minutes). You can close the
  window; it carries on. When it finishes, it sends the build to Apple by itself.
- Apple then takes 5 to 30 minutes to process it. You get an email when it's ready.

## Step 3: put it on your own iPhone first (no waiting for Apple)

1. In App Store Connect → your app → **TestFlight**.
2. Under **Internal Testing**, tap **+**, call the group "Team", and add
   yourself (and anyone else on your App Store Connect account).
3. On your iPhone, install **TestFlight** from the App Store, open the email
   invite, and tap **Install**.

Internal testers don't need Apple's review, so this works straight away.
Try it for a day before inviting anyone else.

## Step 4: a link for everyone else (needs Apple's beta check, about a day)

1. TestFlight → **External Testing** → **+** → call it "EDC Orlando".
2. Add the build. Apple asks for **Test information** the first time. Paste these:

   **What to test**
   > Afterglow helps you discover DJs and plan your festival. Try Discover (swipe through live-set clips, like and save), My Sound (your artist map), and Festivals → EDC Orlando (lineup, For you, and your plan). Make a profile, follow a friend, and start a crew. Tell us anything that looks wrong with Send feedback (take a screenshot in TestFlight).

   **Beta app description**
   > Find the DJs you'll love and build your festival day around them. A feed of live-set clips learns your taste, My Sound maps the artists you like, and festival pages show lineups, set times and a plan made for you.

   **Feedback email**: afterglowmusic.support@gmail.com

   **Sign-in for the reviewer**: make a test account in the app first (for
   example `afterglowmusic.support+review@gmail.com` with a new password),
   follow a couple of people and share one video. Put the email and password
   in **Sign-in information**. (This is the same account App Review uses later,
   `docs/app-store.md` step 4.)

   **Review notes**
   > Festivals and set times come from official lineups and EDMTrain. Clips play in YouTube's own player. "Look after yourself" is a harm-reduction section: it never gives amounts, doesn't sell or encourage drugs, keeps everything on the phone, and its message is to wait, not mix, and get help. Spotify connection is limited to test users for now.

3. Tap **Submit for Review**. Apple's beta check usually takes about a day.
4. When it's approved, tap **Enable Public Link** and copy it. That link is
   what you share: on Instagram, on a flyer, as a QR code. Anyone with an
   iPhone can join until you turn it off.

Apple's beta check looks at the same rules as the full review, so the care
section could get questions. If they ask, reply in App Store Connect with the
review notes above. Tell me what they said and I'll help with the answer.

## A new build after a fix

Same command: `npm run build:ios`. The build number goes up by itself.
Internal testers get it straight away. External testers usually get it within
minutes too, because Apple only fully re-checks the first build (or a big change).

## Instant updates (no new build, no Apple review)

From build 4 on (the first with `expo-updates`), most fixes don't need a new
build at all. Once a fix is merged into `main`, on your PC in the Afterglow folder:

```
git pull
npm install
npm run update
```

It sends the new screens and words to every copy of the app made from build 4
or later (TestFlight, the App Store and the Android link). Each phone downloads
it the next time Afterglow opens and uses it the time after: close Afterglow
fully (swipe it away) and open it again to see it straight away.

What still needs a new build (`npm run build:ios`): a new phone permission, a
new Expo package, or anything else Claude says "needs a new build" for. When
that happens, Claude also raises `version` in `app.json` (1.0.0 → 1.0.1), so
the old builds never get an update they can't run.

## Shipping by itself (set up once)

After this, merging a pull request is all it takes. `.github/workflows/app.yml` runs
after the website's checks pass on `main`:

- **Every merge** sends an instant update to every copy of the app from build 4 on.
- **When Claude raises `version` in `app.json`** (it does whenever a change needs a new
  build), it also makes a new iPhone build on Expo and sends it to TestFlight. Apple emails
  you when it's ready, and testers get it like any new build.
- **By hand:** GitHub → Actions → **App** → **Run workflow** makes an iPhone build now
  (tick "Android too" for a new Android link, once you've made the first one with
  `npm run build:android-link`).

The one thing it needs is an Expo key in GitHub:

1. Go to **expo.dev**, sign in, click your avatar (top right) → **Account settings** →
   **Access tokens** → **Create token**. Name it `github`, create it and copy it (it's
   shown only once).
2. Go to the afterglow repository on **github.com** → **Settings** → **Secrets and
   variables** → **Actions** → **New repository secret**. Name: `EXPO_TOKEN`. Secret:
   paste the token. **Add secret**.

That's all. If a TestFlight upload ever fails with a question about an App Store Connect
key, run `npm run build:ios` once on your PC and say yes to making the key; after that
it's remembered.

Expo's free plan includes a limited number of iPhone builds a month (instant updates
don't count), so new builds only happen when a change needs one.

## Android: a download link (no Play Store)

The Play Store can't be ready by EDC Orlando (see `docs/google-play.md`), so
Android people get the app from a link instead:

```
npm run build:android-link
```

- Say **yes** when it offers to make an Android keystore (it keeps it for you;
  never delete it).
- When it's done (about 15 minutes) it shows a link and a QR code. On an
  Android phone, opening the link downloads Afterglow. Android warns that the
  app isn't from the Play Store; people tap **Settings → Allow from this
  source**, then **Install**.
- Share that link the same way as the TestFlight link. Every new
  `build:android-link` gives a new link, so share the newest one.

## If something goes wrong

| What it says | What it means | What to do |
| --- | --- | --- |
| `You don't have permission` / `not enrolled` | Apple hasn't finished approving the account | Wait for the welcome email |
| `No app found with bundle identifier` (during submit) | Step 1 isn't done yet | Do step 1, then `npx eas-cli@latest submit --platform ios --latest` |
| `Missing compliance` in TestFlight | Shouldn't happen (it's in `app.json`) | Tap it, answer **None of the algorithms mentioned above** |
| The build fails | Something in the code | Copy the last 30 lines of the log (expo.dev → your project → Builds) and send them to me |
