# App Store listing draft

A draft of everything App Store Connect asks for, written from what the app
does today (2026-10-05). Copy what you like into App Store Connect → your
app. Character counts were checked by a script; Apple's limits are in
brackets. Anything marked **Your decision** needs you (or a lawyer) before
you submit.

The step-by-step guide (builds, TestFlight, review questions) is
[`docs/app-store.md`](../app-store.md).

## Name and subtitle

**Name** [30]. Pick one; the first that isn't taken:

| Name | Characters |
| --- | --- |
| Afterglow | 9 |
| Afterglow: Festival Sets | 24 |
| Afterglow: Live Sets & Lineups | 30 |

**Subtitle** [30]:

| Subtitle | Characters |
| --- | --- |
| Live sets, lineups, your plan | 29 |
| Your festival, set to set | 25 |
| Find your sets. See your sound | 30 |

## Promotional text [170]

This can be changed any time without a new review.

> Lineups are out: tap the artists you love and Afterglow ranks every set for you. Set times arrive later, and your plan turns into a route for each day.

(151 characters)

## Description [4000]

> Afterglow is for people who go to festivals for the music. Watch live sets from the artists on your lineups, see your taste as a map, and build a plan for the day with the people you're going with.
>
> LIVE SETS FROM YOUR LINEUPS
> Discover is a full-screen feed of clips from live sets, played in YouTube's own player. Pick a festival and you see the artists on its lineup. Like, save or skip, and the feed learns what you love. Double-tap to like, swipe up for the next one.
>
> YOUR SOUND, AS A MAP
> My Sound shows the artists you love as bubbles: the bigger the bubble, the closer the match, and similar sounds sit together. An overview explains the sounds you lean towards and what to listen for in each.
>
> A PLAN BUILT FROM YOUR SOUND
> Tell Afterglow which festivals you're going to. Before set times are out, each lineup is ranked into must-sees, strong matches and ones to explore. Once set times are published, it becomes a day-by-day plan with clashes, a timetable and a route from set to set. Star the artists you can't miss and they come first.
>
> FESTIVALS
> Upcoming festivals with lineups, dates, a countdown, a calendar and a map. See how many acts you'd love at each one before you buy a ticket.
>
> GO WITH YOUR CREW
> Make a profile to follow friends, start an invite-only crew for a festival, share picks, check in on the day and chat. Messages wait for signal and keep the time you sent them.
>
> FILM AND KEEP YOUR NIGHTS
> Film your own videos, tag them with the festival and the artist, keep them as memories and share them with your crew or on Discover if you choose.
>
> LOOK AFTER YOURSELF
> A private page for festival nights: water, how you feel, a pulse check and a way to get help close by. It stays on your phone and is never uploaded.
>
> PLAY ALONG
> Daily quests, a glow level, sprouts to give to people you meet, and a few secrets to find.
>
> Festival lineups and set times come from the festivals' official announcements and from EDMTrain's festival listings. Clips are played in YouTube's player; Afterglow doesn't host or download them.
>
> Questions or ideas: afterglowmusic.support@gmail.com

(2,092 characters)

Things deliberately left out because the app doesn't do them yet: Spotify
import for everyone (only 5 test users in Spotify's development mode), Apple
Music, push notifications from a server, Sign in with Apple. Add them to the
description once they work in the released build.

## Keywords [100]

Comma-separated, no spaces after commas (spaces count). Words already in the
name and subtitle don't need repeating.

> festival,edm,rave,lineup,timetable,schedule,dj,concert,music,planner,dubstep,house,techno,bass,trap

(99 characters)

**Your decision**: avoid other festivals' trademarks and other apps' names ("EDC", "Coachella",
"Tomorrowland", "Clashfinder") in keywords; Apple rejects them. They're not in this list.

## Category

- **Primary: Music.** The app is about live sets and music taste.
- **Secondary: Entertainment** (or Lifestyle).

## Age rating

Apple's questionnaire (2025 version), answered from what the app has:

| Question | Answer | Why |
| --- | --- | --- |
| Parental controls | No | |
| Age assurance | No | Sign-up has an "I'm 18 or older" checkbox, which isn't age assurance |
| Unrestricted web access | No | Links open in the browser sheet; there's no general web browser |
| User-generated content | **Yes** | Videos, photos (crews only), comments, profiles, crew chat, 1-to-1 messages |
| Messaging and chat | **Yes** | Crew chat and 1-to-1 messages between people who follow each other |
| Advertising | No | |
| Profanity or crude humour | None | The app's own words have none; user content is filtered (`obscenity`) and reportable |
| Horror or fear themes | None | |
| Mature or suggestive themes | None | |
| Sexual content or nudity | None | Not allowed by the community guidelines |
| Violence (cartoon, realistic, graphic) | None | |
| Simulated gambling, contests, loot boxes | None | Quests and collectibles are free and never sold |
| Medical or treatment information | **Infrequent/mild** | Look after yourself has a pulse check and "get help" (medics, the local emergency number). No diagnosis |
| Alcohol, tobacco or drug use or references | **Frequent/intense** | The harm-reduction timing guide covers alcohol and common drugs (onset, peak, risky mixes, never amounts), and it's about festival nightlife |
| Guns or weapons | None | |

Expected result: **18+** under Apple's current tiers (17+ before them),
because of frequent drug references.

**Decided (2026-10-05)**: the timing guide stays and the app is rated 18+;
sign-up, the Terms and the Privacy Policy say 18 or older to match. Still to
do before launch:
- Guideline 1.4.3 gets a close look: the guide's figures need checking
  against DanceSafe or TripSit by someone qualified (see `docs/app-store.md`),
  ideally with a lawyer's read of the care section.
- User content and messaging mean Apple expects reports to be dealt with
  within 24 hours: someone has to read Firestore → `reports` (and Afterglow
  HQ → Reports) every day.

## App Privacy ("nutrition label")

From the code: `src/features/social/firebase/service.ts` (what goes to
Firebase), `src/features/admin/ActivityPing.tsx` (the only analytics),
`src/features/music` (stays on the phone) and `src/features/care` (never
leaves the phone). Everything below applies only once someone makes a profile
or signs in; without an account nothing is collected. **Data used to track
you: none.** Nothing is shared with advertisers or data brokers.

**Data linked to you** (all for *App functionality* unless noted):

| Apple category | What | Where in Firebase |
| --- | --- | --- |
| Contact info → Email address | Signing in | Firebase Auth |
| Contact info → Name | The display name on a profile | `profiles` |
| Identifiers → User ID | The account id | every record |
| User content → Photos or videos | Videos people choose to share (profile, Discover, a crew), photos sent to a crew, profile and cover photos | Storage, `memories`, `crews` |
| User content → Other user content | Bio, @handle, comments, likes, follows, crew check-ins and replies (including an optional "I'm OK / come find me"), meeting spots in words, festival picks shared with a crew, sprouts, finds and stickers, set times sent in by fans, support messages, reports | `comments`, `likes`, `follows`, `crews`, `sprouts`, `finds`, `hunts`, `stickers`, `setTimes`, `support`, `reports` |
| User content → Emails or text messages | Crew chat and 1-to-1 messages | `crews/*/chat`, `dms` |
| Usage data → Product interaction | The day and time the app was opened, platform and app version (never what anyone did) | `activity` (for *Analytics*) |
| Other data | The festivals someone is going to and the sound they lean towards, only when they choose to show them on their profile | `profiles`, `published` |

**Not collected**: location (Near you and filming guesses stay on the phone),
contacts, health and fitness (Look after yourself, pulse, steps: only on the
phone), music library (Spotify data stays on the phone; tokens in the secure
store), browsing history, search history (recent searches stay on the phone),
purchases (there are none; Afterglow Plus is given from HQ, not sold),
financial info, crash data, diagnostics, advertising data.

**Your decision**: whether the crew check-in "come find me" counts as health
data. It's a message the person chooses to send to their crew, not a
measurement, so it's listed under Other user content above; a lawyer may
prefer to declare *Health* too, which costs nothing.

## URLs

From `src/config/app.ts`:

- **Support URL**: https://afterglowmusic.app (support email
  afterglowmusic.support@gmail.com is in Settings → Contact support and on
  the site)
- **Privacy Policy URL**: https://afterglowmusic.app/legal/privacy
- **Marketing URL** (optional): https://afterglowmusic.app
- `APP_STORE_URL` is empty until Apple gives the app its page; fill it in
  then, so share links point to the App Store.

## Screenshots

Seven shots at 6.9-inch (1320 × 2868) and 6.5-inch (1284 × 2778), made from
the website build by `scripts/app-store-shots.ts`. Upload the `6.9-…` set;
the 6.5-inch set is only needed if App Store Connect asks for it.

To make them, with the real clips, artist photos and map:

1. On github.com, open the afterglow repository and click **Actions**.
2. On the left, click **App Store screenshots**, then **Run workflow** →
   **Run workflow** (green button).
3. Wait about five minutes for the run to get a green tick, click it, and
   under **Artifacts** download **app-store-screenshots** (a zip of the
   PNGs).

They're kept for 30 days; run it again any time (after new clips arrive, or
once set times are out, when a timetable shot is added by itself). A
developer can also run `npm run build:web` then `npm run shots` on a
computer (the files go to `docs/app-store/screenshots/`, which git ignores).
They're website captures of the same screens as the app; you can replace
them later with captures from the development build on your iPhone.

## What only you can do

1. Choose the name and subtitle (check the name is free in App Store
   Connect → New App).
2. Decide on the timing guide and the age rating (above), ideally with a
   lawyer, and get the guide's figures checked.
3. Decide the sign-up age to match the rating.
4. Make the screenshots with the GitHub job (above) and upload the 6.9-inch
   set.
5. Fill in the App Privacy answers above in App Store Connect → App Privacy.
6. Make the App Review test account and write the review notes
   (`docs/app-store.md`, step 4).
7. Make sure someone reads reports every day once the app is live.
8. Decide about the two demo festivals the app still ships with (Solstice
   2026 and Horizon 2027, from `src/data/mock`): they're made up, and a
   reviewer or a new user can see them in the festival lists and Discover.
   Hiding them before launch is a small change; ask for it when you're ready.
9. After the app is live, set `APP_STORE_URL` in `src/config/app.ts`.
