# After EDC Orlando: the plan (from Nov 9, 2026)

Three features the user chose on 2026-10-29: **show alerts**, a better **Afterglow
recap**, and **sets you've seen** (a history of who you saw). They're built in the
order below, each a small milestone the user tests on their phone before the next.
The second and third share their foundation, so "sets you've seen" comes first.

Ground rules that shape all three:
- **No server of our own.** Your taste lives on your phone, so matching happens
  on the phone. Pushes are phone to phone (`docs/push-notifications.md`).
- **Private by default.** What you saw and where you walked stay on the phone
  unless you choose to show them on your profile.
- **Behaviour-driven.** A set you saw counts as a strong signal for your taste,
  stronger than a like, because you chose it with your feet.
- **Extend, don't rebuild.** The recap (`features/recap`), "Your year", the
  festival trail (`features/care/trail.ts`), the plan and route
  (`features/plan`), check-ins and Memories already exist. These plug into them.

---

## 1. Sets you've seen (about 3 sessions)

**What you get.** After a festival day, Afterglow works out which sets you
actually caught, asks you to confirm in two taps, and keeps a running history:
"You've seen 47 artists live, 12 of them twice." Every artist page says "Seen live
· EDC Orlando 2026". Profile gets a "Seen live" shelf (private unless you switch
on "Show artists I've seen").

**How it knows.** Each set on the timetable gets evidence, strongest first:
1. **You filmed it.** A video tagged with the artist, or taken during their set
   while you were at the festival (`features/memories/guess.ts` already guesses
   the artist from the time). Counts as **seen** on its own.
2. **You checked in at their stage** during the set (crew check-ins carry the
   stage and time). Counts as **seen**.
3. **It was on your plan, and your trail shows you at the festival** at that
   time. Counts as **probably**. Festival maps have no stage positions yet, so
   the trail proves you were there, not which stage.
4. **You starred it or it was a must-see**, but there's no other sign. Counts as
   **maybe**.

The morning after (and from the festival page any time), **"Who did you see?"**
lists the night's sets: seen ones already ticked, probably/maybe ones as one-tap
"Saw it / Missed it", with "Add another" for a set you caught by chance. What you
confirm wins over any guess.

**Data.** Pure `features/seen/seen.ts`: `setEvidence(festival, day, {videos,
checkIns, trail, plan, stars})` → `{ artistId, day, stage, level: 'seen' |
'probably' | 'maybe' }[]`; `seenHistory` (per artist: times seen, festivals,
last seen). Store `state/seen.ts` (`seen.v1`, per account, in `ACCOUNT_KEYS`),
holding confirmed sets `{ festivalId, artistId, day, at }`. Taste: `seen` joins
the engine's signals between "love" and "like" (passive never outweighs
explicit, and confirming makes it explicit).

**Needs.** Set times for the festival (manual or Clashfinder). Without set
times, only filmed artists count (no times to place them). No new build.

**Test at:** EDC Orlando itself gives the real data. Video, check-ins and the
trail from Nov 6–8 make the first test on Nov 9.

---

## 2. The Afterglow recap, upgraded (about 2 sessions)

**What you get.** The morning after each festival day, and a bigger one after the
last day, a notification: "Your Saturday at EDC Orlando". It opens a story-style
recap made to share on Instagram:
- the sets you saw, in order, with the artists' photos and colours,
- your highlight: the set you filmed most, or rated highest,
- discoveries: artists you saw for the first time who weren't already favourites,
- how far you walked and your steps (from the trail, if it's on),
- your crew: who you checked in with,
- a closing card: "Next up: [your next festival]" or "Shows near you".

"Share" makes it a set of story-sized images (9:16), the same way the plan card
and profile story are shared today. Shared ones carry "Made with Afterglow" and
the website link, which also brings new people in.

**Data.** Extend `features/recap/recap.ts`: `festivalRecap` takes the seen sets
(from 1) instead of guessing from likes and stars, and adds `dayRecap(festival,
day)`. "Your year" (`features/recap/year.ts`) gains "artists seen live" and "most
seen". Morning-after notifications are local, scheduled on the phone by
`ReminderSync` (9 AM the day after each festival day you're going to).

**Needs.** Feature 1. No new build.

---

## 3. Show alerts (about 3 sessions, one new build)

**What you get.** When an artist you love announces a show or festival near
you, Afterglow tells you: "ILLENIUM is playing Tampa, Dec 12, 71 mi away · 99%
your sound." Tap it: the show page, "I'm going", tickets. Artists you've **seen
live** (feature 1) and **follow** count most.

Plus, on the Festivals tab, **"New for you"**: the shows announced since you last
looked that match your taste, so people with notifications off see them too.

**Settings** (Settings → Notifications → Show alerts): on/off; how far (25 /
50 / 100 / 250 mi, or anywhere for artists you follow); who counts (artists you
follow, love or have seen live; or anyone 85%+ your sound); at most 2 a week, and
never between 10 PM and 9 AM.

**How it works.** The nightly import already brings in new shows (EDMTrain,
`data/import/edmtrainShows.ts`), up to six months ahead. The phone keeps the ids
of shows it has already seen (`showsSeen.v1`). When the catalogue refreshes, pure
`features/alerts/showAlerts.ts` picks the new ones, scores them against your
taste and distance (`showsForYou` already ranks shows), drops ones you're going
to or have dismissed, applies the weekly cap, and schedules a local notification
for the best one or two.

To work with the app closed, the phone refreshes the catalogue in the background
about once a day (`expo-background-task`, which needs **a new build, version
1.0.6**). Until that build, alerts arrive the next time you open the app.

**Data and privacy.** Nothing about your taste or location leaves the phone; the
catalogue is the same file everyone downloads.

**Needs.** The 1.0.6 build for background refresh (the user runs `npm run
build:ios` or lets the automatic build do it). Works in a basic form without it.

---

## Order and timing

| When | What | Who |
| --- | --- | --- |
| Nov 9–10 | 1. Sets you've seen, using EDC Orlando's real data | Claude, then the user tests |
| Nov 11–12 | 2. Recap upgrade (EDC Orlando as the first real recap) | Claude, then the user tests and shares one |
| Nov 13–16 | 3. Show alerts: matching and "New for you" first, then background refresh with 1.0.6 | Claude, then the user tests |

What the user can do at EDC to make this better: turn on the festival trail
(Always location), film a few sets with the app's camera and tag the artist,
check in with a crew at a stage once or twice, and tap "I'm going" on the days
you're there. That gives the first version real evidence to work from.
