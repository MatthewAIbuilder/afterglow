# Afterglow outside the app: Live Activity, widgets and Apple Watch

Since version 1.0.6 (2026-10-29; the user asked for "an Apple Watch version… live updates using Dynamic Island… features built into iMessage", then "build it all"). Built on the branch `claude/apple-extras`, **merged only after EDC Orlando** (the freeze is Nov 3; this needs a new build).

## What you get

- **Live Activity** (lock screen and Dynamic Island) on a festival night you're going to, once set times are out: the set on your route now, with the time left counting down by itself, and the next one (when, which stage, how far to walk). It starts when you open Afterglow on the night and stays current with the app closed while the festival trail is on (its background task updates it). It ends by itself when tonight's route is over. iPhone with iOS 17 or later; you can switch Live Activities off for Afterglow in iPhone Settings → Afterglow.
- **"Next set" widget** (home screen small and medium; lock screen round, rectangle and one line): on a festival night, now and next, moving on at each set's start and end by itself; before a festival you're going to (within two months), the countdown; otherwise a quiet line. Tapping it opens Tonight or the festival.
- **Apple Watch app**: the same now and next (or the countdown), counting down by itself. The iPhone sends it what to show whenever your plan changes. The Live Activity also shows in the Watch's Smart Stack (watchOS 11).

All of it comes from your plan on your phone (`features/glance/glance.ts`): the same route "Your festival" shows, with your must-sees and your hours. Nothing goes to a server: the widgets read it from an App Group on the phone, and the Watch gets it from the phone directly.

## How to try it (after the 1.0.6 build is on TestFlight)

1. **The build**: run `git pull`, then `npm run build:ios` on your PC, signing in to Apple when it asks and saying **yes** to new provisioning profiles (the widget and the Watch app are new to your Apple account, so this first build has to come from your PC; after that the automatic build works).
2. **Widget**: press and hold an empty part of the home screen → **Edit** → **Add Widget** → search **Afterglow** → choose a size → **Add Widget**. For the lock screen: press and hold the lock screen → **Customize** → **Lock Screen** → tap the widget area → **Afterglow**.
3. **Watch app**: on the iPhone, open the **Watch** app → scroll to **Available Apps** → **Afterglow** → **Install**.
4. **Live Activity**: on a festival night you're going to, once its set times are out, open Afterglow once; it appears on the lock screen and in the Dynamic Island. It goes by the real date, so the first chance is the next festival after EDC (Cyclops Cove, Dec 4 to 6). The widget's countdown works straight away for any festival you're going to in the next two months.

## How it works

- **Pure logic** (`src/features/glance/glance.ts`, tested in `__tests__/glance.test.ts`): `festivalGlance` (live / countdown / none, tonight's route as clock times), `nowAndNext`, `activityShow` (what the Live Activity shows and when it goes stale). The night runs to 7 AM, like set times.
- **App side** (`src/features/glance/GlanceSync.tsx`, in the root layout): every minute and when the app comes back, works out the glance from your plan and sends it on when it changes (`src/lib/glance.ts`, which does nothing in Expo Go, on Android, on the website or in older builds). The festival trail's background task (`features/care/trailRecorder.ts`) calls `refreshLiveActivity` on each wake.
- **Native module** `modules/afterglow-live` (Swift, autolinked like `afterglow-shazam`): `setGlance` (App Group `group.app.afterglowmusic` + widget reload + `WCSession` application context for the Watch), `showActivity` / `endActivities` (ActivityKit, iOS 17+), `lastGlance`.
- **Extensions** with `@bacons/apple-targets` (a config plugin; the targets are generated at prebuild from `targets/*/expo-target.config.js`):
  - `targets/widget`: `AfterglowWidgets` (bundle), `NextSetWidget` (timeline with an entry at every set start and end), `FestivalLiveActivity` (lock screen + Dynamic Island), `FestivalActivityAttributes` (must stay identical to the module's copy: ActivityKit matches them by name), `Glance.swift`, a privacy manifest (App Group defaults, `1C8F.1`). iOS 17+.
  - `targets/watch`: `AfterglowWatchApp` (SwiftUI, `WCSession` receiving the glance, redrawn every 30 s), `Glance.swift` (same as the widget's). watchOS 10+.
  - Colours and icons come from the configs; prebuild writes `targets/*/Assets.xcassets` (not committed).
- **app.json**: version 1.0.6, `ios.appleTeamId`, the App Group entitlement, `NSSupportsLiveActivities`, the `1C8F.1` reason for App Group defaults, the plugin.
- `@bacons/apple-targets` is the one more exception to "runs in Expo Go" (like `expo-dev-client`): it's a build-time plugin for native extensions, which Expo Go can never run.

## Not built: the iMessage sticker pack

`@bacons/apple-targets` lists iMessage as unsupported (its sticker target expects an "iMessage App Icon" set it doesn't make, and isn't tested), and a broken target would break the whole iPhone build. It waits until the plugin supports it, or until it's made once in Xcode on a Mac. The artwork is ready to use when it does: the enamel festival pins and sprout characters.

## Checked in the cloud (no Mac here)

Type-check, lint, tests, and `npx expo prebuild -p ios --no-install`: the Xcode project has the widget (iOS 17, embedded) and the Watch app (watchOS 10, embedded, `WKCompanionAppBundleIdentifier` = the app), the App Group on the app and the widget, and EAS's `appExtensions` list for signing. The Swift itself is first compiled by the 1.0.6 build on Expo: if it fails, send Claude the error from the build page and it gets fixed.
