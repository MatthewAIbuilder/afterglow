# Your festival trail

Since version 1.0.3 (2026-10-18; the user: "automatically tracked if it's festival day. Otherwise the feature doesn't even matter day to day", and wanted a map of where people walked over the festival, and a self-care check-in now and then where they see their steps).

## What it does

On a day a festival you're going to is on, Afterglow records where you walk (even with the app closed), and draws it on a dark map: one glowing line per festival day, how far you walked, time out, time on the move and your steps (iPhone's motion counter; Android shows the rest). A few "Check in with yourself" notifications through the day open it with a gentle line (water, shade, a seat).

- **Only festival days.** `trailFestival` (`features/care/trail.ts`) is the festival you're going to that's on now (`tonightFestival`). `trailUntil` is 7 AM the morning after its last day; recording stops by itself then (the background task checks, `recordFixes` returns `stop`), so it can never run on an ordinary day.
- **You choose, once.** The first time it's a festival day, `TrailKeeper` (root layout) asks: **Turn on** / **Not now** (asks again the next festival day) / **Never**. The choice (`trailPrefs.v1`) is on the **Your festival trail** screen as a switch (`/trail`, from Look after yourself).
- **Private.** Points are kept only on the phone (`trail.v1`, with `trailActive.v1` saying which festival and until when). Never sent anywhere, never shown to anyone. All three keys are per account (`features/accounts/scope.ts`). "Delete my trail" on the screen removes it. The privacy policy says so.
- **Good points only** (`addFixes`): accuracy within 60 m, a real step (12 m) from the last point, no jumps over 15 m/s, in time order, at most 4000 points a festival.
- **Where it runs.** `trailRecorder.ts` defines the background task (`expo-task-manager`, `expo-location` `startLocationUpdatesAsync`: Balanced accuracy, every 15 m or minute, Fitness activity, iOS's blue indicator, Android's foreground-service notification). It's imported by the root layout so the task exists whenever the system wakes the app. The website has none (`trailRecorder.web.ts`; the trail screen says it's a phone feature).
- **Starting.** The task starts when the app is open on a festival day (when it opens or comes back, and every 15 minutes while open); after that it keeps recording with the phone in a pocket if Location is **Always**. With "While using" it records while the app is open or just left.

## What the user needs

A new build: version 1.0.3 adds a native package (`expo-task-manager`), background location (`UIBackgroundModes: location`, the Always permission text, Android's background and foreground-service location) in `app.json`'s `expo-location` plugin. Expo Go can't do it. `npm run build:ios` from their PC, or the automatic build when 1.0.3 merges. When the build is installed: on the first festival day (or to try it, set your phone's date or go to Your festival trail and switch it on) iOS asks for location twice: choose **Allow While Using**, then later **Change to Always Allow**.

Apple's review: the Always permission needs a clear reason in the App Store notes: "Afterglow records a private walking trail on festival days only if the user turns it on; stored only on the phone."

## Testing on a phone (EDC Orlando, Nov 6 to 8)

1. Install 1.0.3, mark yourself going to EDC. Open Afterglow on Nov 6: answer **Turn on**, allow location, later choose **Always**.
2. Put the phone in your pocket and walk around for a while. The blue location indicator shows on iPhone.
3. Open **Look after yourself → Your festival trail**: the line, how far you walked, your steps.
4. At 3, 6 and 9 PM a "Check in with yourself" notification should arrive; tapping it opens the trail.
5. On Nov 9 after 7 AM, check the blue indicator is gone.
