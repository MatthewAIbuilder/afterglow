# EDC Orlando plan (November 6–8, 2026)

The goal, set on 2026-10-09: Afterglow in people's hands at EDC Orlando
(Tinker Field). Four weeks isn't enough for both public stores, so:

- **iPhone**: TestFlight with a public link (`docs/testflight.md`). A full App
  Store release only if the legal review and the care guide check are done in
  time. If they aren't, the care timing guide is not released unchecked.
- **Android**: a download link (`docs/testflight.md`, "Android: a download
  link"). The Play Store comes later (`docs/google-play.md`), before EDC Las Vegas.
- **Everyone**: the website, https://afterglowmusic.app, on any phone.

## Countdown

| When | What | Who | Done |
| --- | --- | --- | --- |
| By Sun Oct 12 | Apple Developer welcome email | Apple | ✅ |
| By Sun Oct 12 | Expo account, `eas login` and `eas init` (`docs/development-build.md` step 2) | You | ☐ |
| By Sun Oct 12 | Google Play account started (`docs/google-play.md` step 1) | You | ☐ |
| By Sun Oct 12 | Check EDC Orlando is on Festivals at afterglowmusic.app, with its lineup | You | ☐ |
| Oct 9 | Bigger "Open Afterglow" code on the totem | Me | ✅ |
| Oct 9 | TestFlight and Android link set up in the code, guides written | Me | ✅ |
| ~~Thu Oct 16~~ | ~~If there's no welcome email yet, contact Apple Developer support~~ (not needed) | You | ✅ |
| Oct 13–19 | App Store Connect app made, first `npm run build:ios`, on your iPhone through TestFlight (internal) (done Oct 10) | You | ✅ |
| Oct 13–19 | Phone test checklist on that build; send me anything wrong (first pass Oct 10: one problem, friends in festival mode, fixed) | You | ☐ |
| Oct 13–26 | Fixes | Me | ☐ |
| Oct 20–26 | External TestFlight group and Apple's beta check; public link (test information submitted Oct 10, waiting on Apple's beta check, then Enable Public Link) | You | ☐ |
| Oct 20–26 | `npm run build:android-link`; try it on an Android phone if you can borrow one | You | ☐ |
| Oct 20–26 | Totem dry run: tablet set up, festival places kit printed (`docs/totem.md`) | You | ☐ |
| ~Oct 27–Nov 2 | Set times usually come out about a week before: check they appear and the plan and festival mode use them | Both | ☐ |
| Oct 27–Nov 2 | Share the TestFlight link and the Android link (posts, flyers, a QR code) | You | ☐ |
| **Mon Nov 3** | **Freeze**: only fixes for things that are broken after this | Both | ☐ |
| Nov 6–8 | EDC Orlando | 🎉 | |

## Only if the full App Store release is still wanted

These have to be finished by about **Oct 27** to leave time for Apple's review:

- Legal review of the terms and privacy pages (`docs/legal.md`).
- The care timing guide checked against DanceSafe/TripSit, English and
  Spanish (`docs/care-spanish-review.md`).
- App Store listing and screenshots (`docs/app-store.md` step 2).

Otherwise TestFlight carries EDC Orlando, and the public release follows in
the weeks after.

## What could break the plan

1. **Apple's approval running late.** Past Oct 20, everything gets tight.
2. **Problems found on a real phone.** Leave room for a round or two of fixes.
3. **EDC Orlando missing from the app**, or its lineup thin. If so, tell
   Claude and it gets added from the official lineup.
4. **Signal at the festival.** Things sent from the phone wait and send when
   there's signal, but the first app start needs the internet: install before
   going.
