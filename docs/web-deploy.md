# The website: afterglowmusic.app

Afterglow runs in a browser as well as on the phone. The website is built from the same code and hosted on **Firebase Hosting** (the same Firebase project as profiles). Once it's set up, every merge to `main` goes live on its own, and every pull request gets its own preview link.

What works on the website: Discover (YouTube clips, likes, saves, skips, videos from the crowd, Following), My Sound, festivals, lineups, plans and the full-day route, accounts, profiles, following, likes and the bell. What stays in the phone app for now: adding your own videos (Memories), connecting Spotify or Apple Music, the plan as a picture (the website shares it as text) and phone reminders.

## What happens automatically

`.github/workflows/website.yml`, on every pull request and every push to `main`:

1. Installs, type-checks and runs the tests.
2. Builds the website (`npm run build:web`, into `dist/`), stamped with the commit it came from (shown at the bottom of Profile, like "Afterglow 1.0.0 · build 3f2a9c1").
3. Deploys it: **live** from `main`, a **preview** for a pull request (a link is posted on the PR; it lasts 7 days).

Until the secrets below are added, steps 1 and 2 still run and the deploy is skipped. To republish without a new merge: GitHub → **Actions** → **Website** → **Run workflow** (on `main`).

`firebase.json` (`hosting`) serves `dist/`, sends every address to the app (so links like `/festival/edc-orlando-26` work), keeps the app's code files cached for a year (their names change with every build), and never caches the page itself, so a refresh always gets the newest version.

## Set it up (about 20 minutes, once)

You'll need the Firebase project from [`firebase-setup.md`](firebase-setup.md) and access to the domain's DNS settings at the company you bought afterglowmusic.app from.

### 1. Turn on Hosting

Firebase console → your project → **Build → Hosting** → **Get started**. Click through the steps (you don't need to run the commands it shows; GitHub will do the deploying).

### 2. Give GitHub permission to deploy

1. Firebase console → ⚙️ **Project settings** → **Service accounts** → **Generate new private key** → **Generate key**. A `.json` file downloads.
2. Open it in Notepad and copy everything.
3. GitHub → your `afterglow` repository → **Settings** → **Secrets and variables** → **Actions** → **Secrets** tab → **New repository secret**. Name: `FIREBASE_SERVICE_ACCOUNT`. Value: paste. **Add secret**.
4. Delete the downloaded file. It's a key to your Firebase project: never share it or put it in the code.

### 3. Tell the build your Firebase settings

Same page → **Variables** tab → **New repository variable**, six times, with the same values as your `.env` file (saving them as secrets works too):

| Name | Value |
|---|---|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | from `.env` |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | from `.env` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | from `.env` |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | from `.env` |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | from `.env` |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | from `.env` |

(These are meant to be public: they're in every copy of the app. The security rules are what protect the data.)

### 4. First deploy

Merge the web pull request (or any pull request) into `main`. GitHub → **Actions** tab → "Website" shows it running; after a few minutes it's green. Firebase console → Hosting shows the address it went to, like `https://your-project.web.app`. Open it on your iPhone and on your computer.

### 5. Connect afterglowmusic.app

1. Firebase console → **Hosting** → **Add custom domain** → type `afterglowmusic.app` → **Continue**.
2. It shows one or two records to add (a `TXT` record to prove the domain is yours, then `A` records). Keep the page open.
3. At your domain company's website, open the DNS settings for afterglowmusic.app and add exactly those records (type, name/host and value as shown; for the root domain the name is usually `@`). Remove any old `A` records for `@` that point somewhere else (a "parked" page).
4. Back in Firebase, click **Verify**. DNS can take from a few minutes to a few hours. Firebase then sets up HTTPS on its own (the padlock), which can take up to a day the first time.
5. Optional: add `www.afterglowmusic.app` the same way and choose to redirect it to `afterglowmusic.app`.

### 6. Let people sign in on the website

Firebase console → **Authentication** → **Settings** → **Authorized domains** → **Add domain** → `afterglowmusic.app` (and `www.afterglowmusic.app` if you added it). Without this, signing in on the website says it couldn't reach Afterglow.

## Check it

- afterglowmusic.app opens, with the padlock, on iPhone Safari and on a computer.
- Discover plays YouTube clips. The first clip may start muted until you tap the page (browsers ask for a tap before playing sound); YouTube's own controls turn the sound on.
- Scroll the feed with the mouse wheel or a trackpad; tap or click a clip to pause.
- Festivals → a festival → the address bar changes; the browser's back and forward buttons work; copy the address into a new tab and the same page opens.
- Profile → sign in → the same account as on your phone; Follow, likes and the bell work.
- Menus that ask something (••• → Block, My Sound → Start over) open as a small dialog in the page.
- The bottom of Profile shows the build; after a new merge, a refresh shows the new one.

## If something's wrong

| What you see | Fix |
|---|---|
| The Actions run is red at "Type-check" or "Tests" | Something in the code needs fixing: tell Claude which step failed. |
| Green, but "Deploy" was skipped | The `FIREBASE_SERVICE_ACCOUNT` secret is missing or misspelled (step 2). |
| Deploy fails with "permission denied" | The key is for a different project, or `EXPO_PUBLIC_FIREBASE_PROJECT_ID` is wrong. |
| Deploy fails with "No currently active project" | Fixed: the project (`afterglowmusic`) is now in `.firebaserc` and the workflow. |
| The site says profiles aren't available | A variable from step 3 is missing; re-run the latest Actions run after adding it. |
| Signing in fails on the website only | Add the domain to Authorized domains (step 6). |
| The domain still shows an old page | DNS hasn't updated yet, or an old `A` record is still there (step 5.3). |
| A clip never plays and shows the stage | That YouTube video doesn't allow embedding on websites, or YouTube is blocked on that network. |

## Link previews for festival and artist pages

The website is one page that draws everything in the browser, so a shared
link used to preview as plain "Afterglow". After each build,
`scripts/page-previews.ts` (a step in the Website workflow) writes a copy of
that page for every festival and artist, `dist/festival/<id>.html` and
`dist/artist/<id>.html`, with its own title and description (for example
"EDC Orlando 2026 · Afterglow" and "Nov 6 to 8, Tinker Field, Orlando · 110
acts on the lineup."). Firebase Hosting serves them for `/festival/<id>` and
`/artist/<id>`. The app inside is exactly the same. Festivals from the
nightly EDMTrain import get previews too. Profiles and crew invites still
preview as Afterglow.
