# EDC Orlando plan (November 6–8, 2026)

The goal, set on 2026-10-09: Afterglow in people's hands at EDC Orlando
(Tinker Field). Four weeks isn't enough for both public stores, so:

- **iPhone**: the App Store (the user chose this on 2026-10-10), with the
  TestFlight public link (`docs/testflight.md`) as the fallback if Apple's
  review runs late. The care timing guide is never released unchecked: if
  its check isn't done in time, the App Store version ships without it.
- **Android**: a download link (`docs/testflight.md`, "Android: a download
  link"). The Play Store comes later (`docs/google-play.md`), before EDC Las Vegas.
- **Everyone**: the website, https://afterglowmusic.app, on any phone.

## Countdown

| When | What | Who | Done |
| --- | --- | --- | --- |
| By Sun Oct 12 | Apple Developer welcome email (arrived Oct 10) | Apple | ✅ |
| By Sun Oct 12 | Expo account, `eas login` and `eas init` (`docs/development-build.md` step 2) | You | ✅ |
| By Sun Oct 12 | Google Play account started (`docs/google-play.md` step 1) | You | ☐ |
| By Sun Oct 12 | Check EDC Orlando is on Festivals at afterglowmusic.app, with its lineup | You | ☐ |
| Oct 9 | Bigger "Open Afterglow" code on the totem | Me | ✅ |
| Oct 9 | TestFlight and Android link set up in the code, guides written | Me | ✅ |
| ~~Thu Oct 16~~ | ~~If there's no welcome email yet, contact Apple Developer support~~ (not needed) | You | ✅ |
| Oct 13–19 | App Store Connect app made (Apple id 6821236569) and first `npm run build:ios` uploaded (both Oct 10); on your iPhone through TestFlight (internal) | You | ✅ |
| Oct 13–19 | Phone test checklist on that build; send me anything wrong (first pass Oct 10: one problem, friends in festival mode, fixed) | You | ☐ |
| Oct 13–26 | Fixes | Me | ☐ |
| Oct 20–26 | External TestFlight group and Apple's beta check; public link (test information submitted Oct 10, waiting on Apple's beta check, then Enable Public Link) | You | ☐ |
| Oct 20–26 | `npm run build:android-link`; try it on an Android phone if you can borrow one | You | ☐ |
| Oct 20–26 | Totem dry run: tablet set up, festival places kit printed (`docs/totem.md`) | You | ☐ |
| ~Oct 27–Nov 2 | Set times usually come out about a week before: check they appear and the plan and festival mode use them | Both | ☐ |
| Oct 27–Nov 2 | Share the TestFlight link and the Android link (posts, flyers, a QR code) | You | ☐ |
| **Mon Nov 3** | **Freeze**: only fixes for things that are broken after this | Both | ☐ |
| Nov 6–8 | EDC Orlando | 🎉 | |

## The App Store track (chosen 2026-10-10)

Apple's first review usually takes 1 to 3 days, and a first app is often sent
back once or twice with questions. Submitting by **Fri Oct 17** leaves ten
days for that before the Oct 27 cut-off, and a week more before the freeze.

| When | What | Who | Done |
| --- | --- | --- | --- |
| Oct 10–12 | Who runs Afterglow (name or company, state) for the legal pages; whether a lawyer reads them (Matthew Smith, Florida; no lawyer) | You | ✅ |
| Oct 10–12 | The care timing guide: the user wants it in the App Store build; cross-checked against TripSit's figures on Oct 10 (no qualified reviewer) | Both | ✅ |
| Oct 10–14 | Legal pages finished (done Oct 10), demo festivals hidden (done Oct 5), the fixes from phone testing | Me | ☐ |
| Oct 13–15 | Name and subtitle chosen (Afterglow: Festival Sets, Oct 10; subtitle to pick from `docs/app-store/listing.md`), screenshots made (GitHub → Actions → App Store screenshots) | You | ☐ |
| Oct 15–16 | New build (`npm run build:ios`), tried on your iPhone through TestFlight | You | ☐ |
| **Fri Oct 17** | **Submit for App Store review**: listing, screenshots, App Privacy answers, age rating 18+, the review account and notes, release set to **Manually release this version** | You | ☐ |
| Oct 18–27 | Answer Apple's questions; a fix and a new build if they ask for one | Both | ☐ |
| When approved, by Nov 1 | Press **Release**; set `APP_STORE_URL` so links and the totem point to the store | Both | ☐ |

If Apple hasn't approved it by Oct 31, the TestFlight public link carries
EDC Orlando and the release follows.

## What could break the plan

1. **Apple's approval running late.** Past Oct 20, everything gets tight.
2. **Problems found on a real phone.** Leave room for a round or two of fixes.
3. **EDC Orlando missing from the app**, or its lineup thin. If so, tell
   Claude and it gets added from the official lineup.
4. **Signal at the festival.** Things sent from the phone wait and send when
   there's signal, but the first app start needs the internet: install before
   going.
