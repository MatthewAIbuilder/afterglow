# Afterglow (working title)

A premium, Apple-level mobile app for discovering live DJ and festival performances. It combines a TikTok-style feed of live-set clips, behavior-driven artist recommendations, festival lineups and an interactive "My Sound" artist bubble map. The long-term headline feature is a personalized festival schedule built from the user's taste.

Expo / React Native / TypeScript. Also read @AGENTS.md (Expo's own agent rules: use `npx expo install`, Expo Router, current SDK docs rather than memory).

## Where things stand

Everything built so far is merged into `main` (through PR #126, 2026-10-03): the website at https://afterglowmusic.app deploys from it automatically. Almost all of it still awaits testing on a real phone; the user has a phone test checklist (a claude.ai page whose answers Claude can read back) and reports problems from it. **`docs/history.md` is the detailed record of every feature** (behaviour, files, tunable numbers, storage keys, tests): read the relevant part before changing a feature, and add a bullet there when you finish one. Keep this file short.

What the app has, by area (details in `docs/history.md`):
- **Discover** (`features/discover`): full-screen feed of live-set clips (YouTube embeds, crowd videos via expo-video, a drawn stage when there's no video), ranked by `features/recommend/feed.ts`; focus on a festival, your mix, Following, a sound, Tonight or (festival mode) `here:`; likes/saves/skips and watch behaviour feed taste; autoplay next, flag a wrong clip, share, search, swipe right to the camera, crew stories, the quest ring, first-time tips.
- **Taste** (`features/taste`): pure engine (reactions, watch, five-step ratings, imported music, spill-over via `similarityWith`), Tune, Pick artists, This or that, why lines, listen links. Passive signal never outweighs explicit.
- **My Sound** (`features/sound-map`): the bubble map with nebulae, constellations, sound colours, lenses per festival and day, search, artist sheet.
- **Festivals** (`features/festivals`, `features/plan`): Festivals tab (Up next, lineup ready, near you, shelves, calendar, map), festival page with For you / Lineup / Videos / Info tabs, plan and full-day route, timetable grid, Tune, compare, weekends, festival week, get ready, recap, crowd videos, the festival map (`react-native-maps` on phones, dots on web).
- **Social** (`features/social`, Firebase behind the `SocialService` boundary; `fakeSocial` in tests): profiles, follows, likes, comments, shared videos, crews (invite only) with check-ins, replies, chat, meeting spots, care check-ins, friend codes, festival mode (festivals and one-night shows, `features/festivalMode`), Friends tab, founders, flairs, Plus, glow levels, socials links.
- **Memories and camera** (`features/memories`, `features/camera`): film, tag (festival, night, artist, or a past festival as a throwback), share to Discover, badges (enamel pins, throwbacks), Moments on Profile.
- **Play** (`features/quests`, `features/secrets`, `features/sprouts`, `features/finds`, `features/badges`, `features/profile`): daily and weekly quests with glow levels, side quests, milestones, secrets, sprouts and the garden, artist collectibles, stickers and hunts found by scanning (`docs/stickers.md`).
- **Care** (`features/care`): Look after yourself (stopwatches with a timing guide, feelings, water, pulse, steps, get help), all private on the phone.
- **Data** (`src/data`): catalogue file plus nightly imports (EDMTrain festivals, YouTube clips, Deezer photos, colours, lineup similarity, site pictures) into `public/catalogue.json`; HQ live patches; `useCatalog()` is the only way screens reach it.
- **Afterglow HQ** (`features/admin`, `src/app/admin.tsx`): the support account's dashboard (analytics, data uploads and publishing, privileges, organizers, support, reports), and the festival tablet totem (`src/app/totem.tsx`, `docs/totem.md`).
- **Organizers** (`features/organizers`, `src/app/studio.tsx`, `src/app/org/[id].tsx`, `docs/organizers.md`): event organizers (first: Underground Alchemy) run their own page in the organizer studio: events and lineups (published ones join the catalogue as festivals), words on their artists, numbers (counts only), promotion requests (HQ approves; shown labelled Promoted, never in taste), badges with their mark, gifts, stickers and design requests. Their accounts get their own app: only their events on Festivals, a camera (faint logo on their videos), Messages (anyone may message them; updates to followers with an event or gift), posters and lineups TBA; they're found in every search. HQ decides which emails and accounts run which organizer.
- **Languages** (`src/i18n`, `docs/translations.md`): English and Spanish, following the phone (or Settings → Language). New UI lines go through `t('…')` with a Spanish entry in `src/i18n/es.ts` (a test checks); The whole app is translated except what is deliberately English (catalogue data, legal documents, HQ; list in `docs/translations.md`). `src/i18n/index.ts` must not import React Native or Expo at the top (the nightly Node scripts load it) (`docs/translations.md`).


Waiting on the user (don't redo, remind when relevant):
- Underground Alchemy: a Firestore rules and indexes deploy, then trying the test login `afterglowmusic.support+alchemy@gmail.com` (`docs/organizers.md`); later HQ swaps in stefan@undergroundalchemy.net.
- Phone testing of nearly everything (afterglowmusic.app is already an authorised sign-in domain in Firebase Auth, confirmed 2026-10-05).
- The Apple Developer account is approved (2026-10-10): next the Expo link (`eas init`), the first TestFlight build (`docs/testflight.md`) and the development build (`docs/development-build.md`): Sign in with Apple/Google, HealthKit, NFC.
- Version 1.0.5 (2026-10-21, waiting on the branch `claude/going-shows-comments` until Apple approves the build in review): Sign in with Apple and Google (`docs/sign-in-providers.md`). Both are switched on in Firebase and in `src/config/social.ts` (2026-10-21). Still to do by the user: the Google redirect `https://afterglowmusic.app/google-auth` in Google Cloud (and the consent screen), and `npm run build:ios` from their PC once after the merge (the Sign in with Apple capability).
- Version 1.0.4 (2026-10-19) has the new logo and app icon (`docs/brand`): the user runs `npm run build:ios` (or the automatic build does it) to see it on the home screen.
- Version 1.0.3 (2026-10-18) adds the festival trail (`docs/trail.md`: background location on festival days, a new build with `expo-task-manager`; the user runs `npm run build:ios` or lets the automatic build do it, then tries it at EDC Orlando and chooses Always location).
- Version 1.0.2 (2026-10-18) adds Track ID (Shazam, `docs/track-id.md`; the user ticks ShazamKit beside MusicKit) and says why Apple Music didn't connect; the user runs `npm run build:ios` again (or the automatic build does it).
- Version 1.0.1 (2026-10-18) has push notifications and Apple Music: the user runs `npm run build:ios` once from their PC (Apple sign-in, push key; `docs/push-notifications.md`), ticks MusicKit for `app.afterglowmusic` (`docs/music-integrations.md`), and for Spotify makes the Spotify app and adds `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` to EAS (`docs/spotify-setup.md`, "On TestFlight"; 5 accounts only).
- Version 1.0.6 (2026-10-29, branch `claude/apple-extras`, merge only after EDC Orlando): Live Activity, widgets and Apple Watch app (`docs/apple-extras.md`); the first build from the user's PC (`npm run build:ios`, new targets need new provisioning profiles); the Swift is untested until that build. The iMessage sticker pack waits on `@bacons/apple-targets` support.
- Set times from Clashfinder (2026-10-29, `docs/events-import.md`): built and reporting nightly; the user emails halvin@clashfinder.com for permission (the data is CC BY-NC), then set `CLASHFINDER_PUBLISH` to `true` in `scripts/clashfinder-set-times.ts`.
- **EDC Orlando (Nov 6–8, 2026) is the target** (`docs/edc-orlando-plan.md`, a dated countdown: check it off as things happen): iPhone through TestFlight (`docs/testflight.md`, `npm run build:ios`), Android from a download link (`npm run build:android-link`), the website for everyone; freeze Nov 3. Google Play account (`docs/google-play.md`; new personal accounts need a 12-tester, 14-day closed test, so the Play Store comes before EDC Las Vegas instead).
- Before launch (`docs/app-store.md`): qualified legal review, the care timing guide checked against DanceSafe/TripSit (and its Spanish, `docs/care-spanish-review.md`), official Instagram/Snapchat/TikTok icons, App Store listing and screenshots, an `APP_STORE_URL`.
- Firestore/Storage rules deploy automatically from `main` only if the website key has the right roles; otherwise the user deploys with `firebase deploy --only firestore,storage` (`docs/firebase-setup.md`). Rules are tested with the emulator: copy `scripts/firebase-rules.json` (as `firebase.json`), `firestore.rules`, `storage.rules` and `scripts/firebase-rules.test.mjs` to a scratch folder with firebase-tools and @firebase/rules-unit-testing, then `npx firebase emulators:exec --only firestore,storage --project demo-afterglow "node firebase-rules.test.mjs"`.

## Things that bite

- **Expo APIs in SDK 57**: import `expo-calendar/legacy` (the top-level functions throw); expo-media-library's new `Asset` API (the old functions throw); expo-file-system's `File`/`Directory`/`Paths`. Add native packages with `EXPO_OFFLINE=1 npx expo install <pkg>`, then add any config plugin to `app.json` by hand (because of `app.config.ts`), and only if it runs in Expo Go.
- **Web**: alerts and sheets only through `lib/dialog.ts`, sharing through `lib/share.ts`; phone-only code behind a `.web.ts` file or `Platform.OS === 'web'`. `public/index.html` is the page template (keep `%LANG_ISO_CODE%`, `%WEB_TITLE%`).
- **React Compiler lint** (`npm run lint` must stay at zero): shared values with `.get()`/`.set()`, no `Date.now()` in render (use `lib/useNow`/`useToday`), no hooks after an early return, state setters in effect deps.
- **Tests** (`npx jest --ci`, never re-record golden snapshots): with @testing-library/react-native 14 `render`, `fireEvent` and `unmount` are async (await them). Screen tests use `renderApp` from `src/app/__tests__/appRoutes.tsx`; navigate with `router.push` inside one app; the virtualized feed only renders the top clips; screen tests run on fake timers once rendered. `test/setup.ts` mocks every native module (with `__state`-style handles); `test/afterEnv.ts` resets shared stores. Choose from action sheets by mocking `ActionSheetIOS.showActionSheetWithOptions`; press alert buttons by spying on `Alert.alert`.
- **Liquid Glass** (a free switch on the App theme page, **off by default**: `GLASS` in `tokens.ts`, stored like the theme and read at start; off, `GlassFill` draws the plain frosted surface, `color.rim` equals the hairline and `accentEdge` is empty): anything floating (buttons, pills, sheets, toasts) draws `GlassFill` from `components/LiquidGlass.tsx` as its first child (Apple's glass on iOS 26, a copy elsewhere, solid with Reduce transparency); round buttons use `GlassCircleButton`. In a browser the glass is positioned, so an icon (SVG) or text field beside it must sit inside a `View` or the glass covers it. Cards and rows: `backgroundColor: color.glass` with a hairline and `borderTopColor: color.rim`; solid accent buttons spread `accentEdge`.
- **Back and close**: always `goBack()` from `lib/nav.ts`, never `router.back()` (it does nothing on a page opened from a link or after a website refresh). Every sheet and pop-up needs a visible way out (`components/SheetClose`): browsers can't swipe a sheet down. Buttons drawn before a full-screen ScrollView need a `zIndex` (PageActions and SheetClose have one).
- **Discover params**: clear handled params with the screen's own `navigation.setParams` (the global one throws before navigation is ready). Openers that run by themselves (welcome, Tonight, What's new) only open over a tab.
- **Outboxes**: anything sent from the phone (crew updates, chat, friend adds, sprouts, likes) is kept on the phone, sent oldest first when there's signal, keeps the time it happened (`at`), separates no-signal tries from refusals, and is per account.
- **Privacy**: music tokens only in the secure store; care data never leaves the phone; never log private data; never commit secrets.
- **Instant updates and builds ship by themselves** (`.github/workflows/app.yml`, needs the `EXPO_TOKEN` secret; `expo-updates`, channel `production` for the App Store/TestFlight and the Android link): every checked push to `main` sends an `eas update`; raising `version` in `app.json` also builds the iPhone app and sends it to TestFlight. `runtimeVersion` follows `version`, so raise `version` (1.0.0 → 1.0.1) in any change that needs a new build (a native package, a config plugin, a permission), and only then; otherwise old builds get JavaScript they can't run, or builds pile up.
- **Git in cloud sessions**: pushes cancel running CI on the same branch, so batch them. No model names in commits or PRs.

## Product principles

- **Visual standard is non-negotiable**: Apple-level polish, dark-first, minimal and premium, excellent typography and spacing, smooth purposeful motion, tasteful blur/glass, strong but meaningful haptics. No generic dashboard look, no cheap neon "EDM app" look. The accent is one restrained purple glow ("festival light at night"). Artist imagery should eventually drive per-artist color.
- **The bubble map is the core differentiator.** Bubble size = predicted affinity. Similar sounds cluster naturally. It should feel like a living musical universe, not a chart.
- **Recommendations are behavior-driven.** Scores come from what the user does: likes, saves and skips, plus quieter watch behaviour (watched through, replayed, quick swipe away), all with spill-over to similar sounds; later follows and other meaningful signals. Passive signals must never outweigh explicit ones. Never replace this with arbitrary static scores. `data/mock/tasteProfile.ts` is only the starting prior.
- **Festivals have two phases.** Lineups are known months ahead; set times arrive a week or two before. Every schedule feature must work gracefully in both.
- Copy is plain, sentence case, user-facing (no developer language in the UI).


## Architecture

`src/app/` holds the routes (Expo Router; every file is a screen, `_layout.tsx` files are navigators: the root Stack with every provider, and `(tabs)` with the custom `GlassTabBar`: Discover, Festivals, My Sound, Friends (`together`), Profile; festival mode swaps in Lineup and a camera button). Non-route code lives outside it:

- `src/features/<area>/`: each area's screens parts and its **pure logic** (plain TypeScript, no React, tested in `__tests__`), e.g. `taste/engine.ts`, `recommend/feed.ts`, `plan/route.ts`, `sound-map/layout.ts`, `sprouts/sprouts.ts`.
- `src/state/`: providers and small shared stores, one per kind of saved state, each with its own AsyncStorage key (`<name>.v1`). Planning state (going, stars, weekends, reminders) never feeds the taste engine.
- `src/data/`: `models.ts` (domain types), catalogue file parsing (`file.ts`), validation, merging, the bundled `catalogue/afterglow.json`, nightly import logic (`data/import/`), `mock/` (the only mock data, kept for golden tests).
- `src/components/`: shared UI (NightSky, GlassTabBar, GlassCircleButton, ArtistAvatar, ArtistRow, Tabs, SearchField, PageActions, DialogHost…).
- `src/lib/`: haptics, dialog, share, calendar, version, useNow/useToday, nav.
- `src/theme/tokens.ts`: colour, type, spacing, radius, motion springs. Use these, never ad-hoc values.
- `src/config/`: app constants (`app.ts`: `WEB_URL`, `SUPPORT_EMAIL`), `data.ts` (`CATALOG_URL`), `social.ts` (Firebase web config), `music.ts`.
- `scripts/`: nightly import scripts run by `.github/workflows/website.yml`, page previews, the Firebase rules test.
- `docs/`: guides for the user and for future sessions (catalogue, events import, Firebase, web deploy, development build, App Store, memories and profiles, music, legal) and `history.md`.

Layer rules are enforced by `src/data/__tests__/architecture.test.ts`: screens reach catalogue data only via `useCatalog()`; only `features/music/` imports its adapters; only the Firebase adapter imports firebase.

## Rules for changes

- Work in **small, testable milestones**. Propose the smallest next step before large changes. Stop after each milestone so the user can test on a real phone.
- **Never rebuild or redesign working features** unless explicitly asked. Extend, don't replace.
- No backend, auth, scraping, payments or AI services unless the user asks. (Music sign-in was asked for in Milestone 43; it stays on the device.)
- Music-library data is private: tokens only in the secure store, normalised data only in AsyncStorage, nothing logged, and anything a future profile shows goes through `shareableMusicProfile` with consent. Never commit client secrets, MusicKit keys or tokens; the app needs none.
- Add dependencies only with `npx expo install` and only if they run in Expo Go. The exceptions are `expo-dev-client` (Milestone 44), which exists to make a development build, and `@bacons/apple-targets` (1.0.6), the build-time plugin for the widget and Watch targets (`docs/apple-extras.md`); neither changes what runs in Expo Go. Because of `app.config.ts`, a package whose config plugin `npx expo install` would add must be added to `app.json`'s `plugins` by hand.
- Real data comes from the user, through the catalogue file (`catalogue/afterglow.json` or their hosted file), plus the one feed the user chose on 2026-09-30: EDMTrain's festival listings, imported automatically each night (Milestone 63, `docs/events-import.md`); hand-curated festivals always win over it. Discover clips also come automatically each night from YouTube search (the user chose "any channel" on 2026-09-30; Milestone 69). Never invent lineups, set times or video sources; enter only what the user provides, from official sources, or what these automatic feeds find. Don't add festival posters yourself (the user supplies links they have rights to). Artist photos come automatically from Deezer's public search (the user asked for photos from any free source on 2026-09-30; Milestone 66); a photo set in the catalogue wins. SoundCloud profiles are matched automatically each night through SoundCloud's public oEmbed answer, with no key (the user chose this on 2026-10-06); a `soundcloud` link on the artist in the catalogue wins. `npm test` must stay clean for `catalogue/afterglow.json`.
- Respect reduced motion (`useReducedMotion`) and accessibility labels.
- Everything must also work in a browser (the website): alerts and sheets only through `lib/dialog.ts` (which also keeps menus of more than three choices whole on Android), sharing through `lib/share.ts`, and anything phone-only (files, Photos, secure store, notifications) behind a `.web.ts` file or a `Platform.OS === 'web'` check that says it's in the app.

## Commands

```
npm install                                   # .npmrc sets legacy-peer-deps (needed for SDK 57)
npx tsc --noEmit                              # type-check
npm test                                      # Jest (jest-expo): pure logic and screen smoke tests in src/**/__tests__ (use `npx jest --ci` so golden snapshots are never re-recorded by accident)
npm run lint                                  # expo lint (clean since the polish pass: keep it at zero)
npx expo export --platform ios --output-dir /tmp/exp-ios          # build check
npx expo export --platform android --output-dir /tmp/exp-android  # build check
npx expo export --platform web --output-dir /tmp/exp-web          # build check (the website; `npm run build:web` writes dist/)
npx expo-doctor                               # dependency/config health
npx expo start --go                           # run in Expo Go (user tests on device); `npm run go`
npx expo start --dev-client                   # run in the development build (Spotify sign-in); `npm run dev`
npx jest --ci src/features/music src/state src/features/taste src/app/__tests__/music.test.tsx   # music connections only
npx eas-cli@latest build --profile development --platform ios        # the user's development build (see docs/spotify-setup.md)
```

Cloud sessions can't reach docs.expo.dev, developer.spotify.com or Apple sign-in, and can't run a real Spotify or Apple Music sign-in: music tests use fixtures and test doubles only. Add native packages offline with `EXPO_OFFLINE=1 npx expo install <pkg>`. expo-doctor's schema and React Native Directory checks fail here only because their hosts are blocked.

After any significant change: type-check, run the three export build checks (iOS, Android, web) and expo-doctor, and fix everything before finishing. Cloud sessions can't run the app on a phone, so summarize exactly what the user should test in Expo Go.

## User context

The user is not a developer and tests on Windows + iPhone via Expo Go. Give plain, step-by-step instructions for anything they must do themselves.
