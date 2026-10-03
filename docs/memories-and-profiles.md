# Memories and profiles

How Afterglow keeps your own festival videos, guesses who was playing, and shares what you choose to a profile. Setup for profiles: [`firebase-setup.md`](firebase-setup.md).

## Memories (on the phone, private)

```
Discover: swipe right (or the camera button) ──► camera.tsx: Afterglow's own camera (expo-camera)
          press and hold a clip ──► Record a video (the camera) / Choose from library (useAddMemory)
        │                                    library: expo-image-picker (iPhone trims to 1 min)
        ▼                                    when + where: the video's creation time and location
features/memories/device.ts                  (expo-media-library), or now + here for a recording
  pickVideo / recordedVideo → PickedVideo { uri, source, durationSec, moment: { when, place: { city, region } } }
        │                                    coordinates → place name on the phone (expo-location), then dropped
        ▼
memory-tag.tsx (tagging sheet) ◄── guess.ts: guessFestivals, guessArtists (pure)
        │  Save
        ▼
state/memories.tsx (MemoriesProvider)
  memories.v1 (AsyncStorage): the list, names only
  <documents>/memories/<id>.<ext> + <id>.jpg (expo-file-system, expo-video-thumbnails)
        │
        ▼
memories.tsx (festival → night → set) · memory/[id].tsx (player) · artist pages ("Your memories")
```

- **The camera** (`src/app/camera.tsx`, `features/camera/`): swiping right on Discover peeks its edge in (Discover shifts up to `PEEK_MAX` 110 points, with a tick as you pass the point that opens it) and opens it past `OPEN_AT` 35% of the width or with a flick; the header's camera button opens it too, and so does "Record a video". Tap the record button to start and tap again to stop, or hold it to film while held (`recordButton` in `record.ts`, `HOLD_MS` 350); the ring fills to `RECORD_MAX_SEC` 60 (a minute: short enough for Discover); under `MIN_RECORD_MS` 0.8 s isn't kept. Then the tagging sheet replaces the camera. Torch, front/back, Photos (library), "Filming at <festival> · <night>" when you're at one you're going to. Swipe left or close to go back; leaving mid-recording keeps nothing. Camera and microphone are asked for on the page, with Open Settings once refused (no microphone means silent video). Phones only: the website says filming is in the app.
- **Share to Discover as you save.** The tagging sheet's last row, "Share to Discover", is on by default once the video has a festival and who was playing and you have a profile (`features/social/shareChoice.ts`); it says who can see it and that Afterglow doesn't add where you filmed it. Saving keeps the video and uploads it in the background; switch it off to keep it in Memories only.
- **Files by name, not path.** iOS moves the app's folder between updates, so a memory stores `m…mov`, and the folder is looked up each time.
- **Nothing is lost by accident.** Files no memory points to are tidied on launch, but only when the saved list read back whole: a damaged list never deletes videos. A recording you cancel asks first, because it exists nowhere else yet.
- **Private.** Only a city and region are kept from where you filmed. Nothing leaves the phone until you share it.

### The guess (`features/memories/guess.ts`)

- **Festival**: the night the video belongs to (before noon counts as the night before, like set times) against each festival's dates or weekends (+4); the city in the festival's location (+2) or the region (+1); a festival you're going to (+1). A place alone months away from the dates doesn't count. Confidence: *sure* when the date agrees with the city or your plans; *likely* on the date or the city alone.
- **Night**: the festival's own days when it has one per date (`festivalNight`), otherwise the weekday name (so ACL's two weekends work).
- **Artist**, once set times are out: sets playing at that minute (your full-day route for that minute first, then stars and match); sets within `GRACE_MINUTES` (10) of starting or ending count less; the rest of the night after. Before set times: that night's lineup (`playsOn`), stars first, then your match. Everyone else on the lineup comes after, so the full list is always searchable.
- The sheet opens on the festival and night when the festival guess is sure or likely, and preselects the artist only when that guess is sure or likely. Otherwise you tap the right one, search, or choose Not sure.
- The phone's clock is taken as the festival's clock, which holds when you tag soon after filming. The music itself isn't heard yet (a later step: ShazamKit in a development build).

## Profiles (Firebase)

```
screens (Profile tab, account, profile-edit, u/[handle], people, shared/[id], ShareToProfile)
        │  useSocial()
        ▼
state/social.tsx (SocialProvider): user, profile, share/unshare, blocks, report, auto-publish
        │
        ▼
SocialService (features/social/service.ts) ── firebase/service.ts (Auth + Firestore + Storage, JS SDK)
                                            └─ __tests__/fakeSocial.ts (in memory, same rules)
```

- **Only features/social/firebase/ imports Firebase**, and only `services.ts` wires it in (architecture test). Firebase starts on first use and never without config.
- **Published**: handle, name, bio, photo, and only what you switch on: festivals you're going to and your top three sounds. Both follow your plans automatically, a few seconds after they change, only when the list really changed (`publishedChanged`). Each shared memory: the video, its still, festival, night, artist, when it was filmed and its length.
- **Never published**: taste, ratings, reactions, your music library, unshared memories, where you filmed.
- **The video file itself** may carry location metadata that the phone embedded; the app can't re-encode video in Expo Go, so the share confirmation says so. A later development-build step can strip it.
- **Moderation**: `obscenity` filters handles, names and bios (`validate.ts`); sign-up requires agreeing to the community guidelines (`copy.ts`); every profile and shared video can be reported (Firestore `reports`, read in the console) and people can be blocked (private `blocks/{uid}`; blocked people disappear from search, profiles and shared videos). A contact for the App Store goes in `SUPPORT_EMAIL` (`config/app.ts`).
- **Account deletion** (in the app, as the App Store requires): re-enter your password; shared memories and their files, your photo, handle, profile and blocks are deleted, then the account. Reports you filed are kept for moderation. Your Memories stay on the phone, no longer marked shared.

## Community clips in Discover

Shared memories tagged with a festival and an artist Afterglow knows appear in Discover beside the official clips, ranked by the same taste engine (lanes, one clip per artist before anyone's second, never the same artist twice in a row).

```
SocialService.festivalMemories(festival, 80) / recentMemories(80)   (your mix)
        │  useCommunityClips (state/community.tsx): signed in, switch on; per focus, fresh 5 min, again on foreground
        ▼
features/community/clips.ts (pure): communityClips → Clip { id: community:<sharedId>, source: { provider: 'community', … } }
        │  newest first, at most 40; blocked people, hidden/reported videos and your own left out;
        │  for a festival, only its videos of artists on its lineup
        ▼
useRankedFeed(activeIndex, focus, community) → ClipCard → ClipPlayer → NativeVideoPlayer (expo-video)
```

- **Playback** follows the same rules as YouTube clips (`shouldPlay`, `canCountWatch`, `playedSpan`): only the live clip plays, from the top, looping; only real playing seconds count as watch time. A video that fails or doesn't load in 15 s says "This video isn't available right now."
- **The card**: "Filmed by @handle" (opens their profile) and a ••• with **Report this video** (reasons as for profiles; hidden for you at once), **Hide this video**, **Block @handle** (asks first). No Save (the video isn't Afterglow's to keep) and no share link. Like, Skip and watching shape your taste like any clip.
- **Taste after the clip is gone**: the engine finds a clip's artist through the clip list, so the artist of every community clip you reacted to is remembered (`community.v1`, `artistOf`, bounded to 500) and `useTaste` adds stand-in clips (`rememberedClips`) for reactions whose clip isn't loaded. The same list (`useTaste().tasteClips`) feeds the artist page's "From your 1 like" line.
- **Your clips**: a liked community clip is kept whole on the phone (`community.v1`, `kept`, at most 200) so Your clips can list it (its still, "From the crowd · @handle") and play it in Discover later. It drops out if you hide it, block who filmed it, or sign out; if the owner removed it, it says the video isn't available.
- **Late arrivals**: community clips load after the feed starts; the clip on screen and the next one stay put (the feed's keep is tied to the focus, not the clip list), so they join from the third clip on.
- **Your choice**: the What to discover sheet has a **Videos from the crowd** switch (on by default, shown when profiles are set up). `community.v1` also keeps hidden videos. Nothing in it leaves the phone.
- **Rules and index**: memories may carry the video's `width`/`height` (numbers up to 20000, used to tell upright from landscape); reads need a signed-in user; index `festivalId ASC, createdAt DESC`. Catalogue files can't add community clips (`validate.ts` accepts only YouTube sources).

## Following

- **Follow** on someone's profile (and beside each person in Find people and the follower lists). It changes at once and goes back if the write fails (`setFollowing` in `state/social.tsx`). You need your own profile first, because people can see who follows them.
- **Counts and lists**: profiles show "12 followers" and "3 following"; each opens `follows/[handle].tsx` (Followers / Following, newest 100, people you blocked left out). The Profile tab shows your own counts.
- **Following in Discover**: What to discover has a **Following** row under Your mix (`FOLLOWING` in `features/discover/focus.ts`, remembered like the mix). It shows only videos from the people you follow (`memoriesBy`, the 300 you followed most recently, in groups of 30 because of Firestore's `in` limit), ranked by the same feed, and works even when Videos from the crowd is switched off. Unfollowing takes their videos out at once. With nothing to show it explains why (signed out, following no one, nothing shared yet) and offers Find people or your mix; the end of the feed offers Find people.
- **Blocking** someone ends follows both ways (your follow of them and theirs of you), and someone who blocked you can't follow you (the rules check it).
- **Public**: who follows whom is visible to anyone signed in, like profiles. Deleting your account removes your follows both ways.
- Not yet: notifications for new followers.

## Who else is going

Festival pages show who else is going: people you follow first, then others on Afterglow ("Maya and 2 others you follow are going, plus 12 others on Afterglow"), with their faces; tapping opens the full list (`going/[id].tsx`) with Follow beside each. It reads `profiles` whose shown festivals include this one (`profilesGoingTo`, up to 200), so only people who switched on "Show festivals I'm going to" appear; you and anyone you blocked never do.

## Festival crews

A few friends planning one festival together.

- **Start one** from a festival page ("Plan with friends", under who's going). It needs a profile (your crew sees your name and photo). The crew opens with its name ready to change ("EDC Orlando 2026 crew" until you rename it).
- **Invite**: "Invite friends" shares `https://afterglowmusic.app/crew/<id>` (the share sheet on phones, share or copy on the website). The crew's id is the invite: anyone signed in with the link sees the crew's name and who's in it, and can join (with a profile, up to 12 people, not if the crew's owner blocked them). The join screen says what joining shares. In the app, `afterglow://crew/<id>` opens the same page.
- **What's shared**: each member's starred sets at that festival, and nothing else about their taste. `CrewsProvider` (`state/crews.tsx`, inside Social and Plan) loads your crews on sign-in and when the app comes back, and sends your stars to each crew 2 seconds after they settle (`CREW_SYNC_MS`), only when they changed (`picksChanged`); a failed send is tried again on the next change. Stars stay a planning preference: this is the only place they go, and never into taste.
- **The crew page** (`crew/[id].tsx`, `features/crews/useCrewPage.ts`): the festival (opens it), the name (the owner can rename it), Invite friends, **Sets you share** (starred by two or more of you, most of you first, then billing order, as artist rows with your match and "Both of you" / "All 4 of you" / "Maya and you"), **Everyone's picks** (your own are your stars right now), and Leave. The owner can remove people (their picks go too). Leaving takes your picks with you; an owner who leaves hands the crew to the next member; the last one out ends it. Deleting your account leaves every crew.
- **Pure** (`features/crews/together.ts`): `crewTogether` (shared picks and each member's picks, ignoring people who left and artists off the lineup), `whoLine`, `crewMembersLine`, `sharedCountLine`, `firstName`, `crewPath`, `picksChanged`. Crew names: `cleanCrewName`, `crewNameProblem` in `validate.ts` (1 to 40 characters, friendly).
- **Profile** lists your crews (each opens its page), or suggests starting one from a festival page.

## Crew updates

Where your crew is, from the videos they film and quick check-ins, along the top of Discover like stories.

- **Two times, kept apart.** Every update carries `at`, when it happened on the phone (a video's filming time, or the moment a check-in was tapped), and `sentAt`, when it reached the crew (the server's own time; the rules refuse anything else). The crew sees `at`, and `at` decides what's newest: a 4:05 PM video beats a 3:00 PM one even if the 3:00 PM one only got through at 5:00 PM. When an update arrived 10 minutes or more after it happened, it says so: "Sent 3:00 PM, reached the crew 5:02 PM".
- **Videos**: the tagging sheet's "Send to my crew" (on by default for a new video when you're in a crew at its festival). If the video is also shared to Discover, the crew update waits for that upload and points at it (one upload); otherwise it's uploaded for the crew only (`crews/{crewId}/{uid}/{updateId}.mp4`). The stage comes from the artist's set when set times are out.
- **Check-ins** (`check-in.tsx`): one tap ("I'm here", "Meet at our spot", "Getting water", "Phone's dying", "Heading out") or your own words (80 characters), with an optional stage or "Watching <artist>" from the set on now.
- **No signal**: everything you post goes into an outbox on the phone (`crewOutbox.v1`) with its time and id fixed the moment you post. It sends itself when there's signal (opening the app, coming back to it, the network returning, and every 15 s to 2 min), oldest first. Sending an id twice lands once. Items waiting more than a day are dropped.
- **Reading**: every minute while the app is open, for crews whose festival isn't over (or undated), the last 36 hours. What you've watched is remembered (`crewSeen.v1`), so new stories glow.
- **Where**: the stories row on Discover (you first, to check in; "Waiting…" while something's in the outbox), `crew-story.tsx` (full screen, latest first, tap right for earlier), and "Latest from the crew" on the crew page.
- **Privacy**: crew members only. Leaving a crew (or being removed) takes your updates with you; the crew ending removes them all. Crew video files sit at random paths whose links are only in the members-only updates.

**Replies.** Tap a crewmate's update to open it, then tap a quick reply ("On my way", "Save me a spot") or write your own. A reply is a crew update of its own (kind `reply`, pointing at the update it answers), so it waits for signal like a check-in and keeps the time you sent it. Replies to your updates show up as news in that person's story and under your latest on the crew page ("1 reply · Sam: On my way"); replies between other people stay under the update they answer. The rules only accept a reply with words, answering an update in the same crew.

**Find my crew.** Each crew can keep one meeting spot ("Big tree left of Main Stage"), set by any member on the crew page or on Tonight (`crews/{id}/meta/meet`, members only, 80 characters, who set it and when). "Can't find my crew" (Tonight and the check-in screen) sends a check-in marked lost ("Can’t find you. Heading to Big tree left of Main Stage"); it goes through the outbox like any check-in, so it waits for signal and keeps the time you tapped. Your crew sees it first in their stories with an amber ring. Nothing is tracked: it only says what you chose to send.

### "I'm OK" and asking for help

A check-in can carry `care: 'ok' | 'help'` (rules: only on check-ins). It's sent only when you tap it: on Look after yourself (offered for 30 minutes after you check in how you feel, picking the one that fits: okay or better offers "I'm OK", worse offers "Ask my crew for help"), Tonight, the Friends tab at a festival, and the check-in screen. Asking for help is confirmed first. Both go through the outbox, so they wait for signal and keep the time you tapped.

For the crew (`features/crews/care.ts`): a call for help stays up until that person sends "I'm OK" or 3 hours pass (`CARE_WINDOW_MS`). `CrewHelpAlerts` shows it at the top of Tonight, the Friends tab and Look after yourself: who, when, where they last said they were, "See their update" and "On my way" (a reply). Their ring in the stories row stays red. Each phone nudges once per call with a local notification, only if notifications are already allowed (remembered in `crewCareNotified.v1`); there's no push from a server, so the nudge comes when the app next reads the crew (every minute while open, and on opening). Care check-ins never move anyone on Where's the crew.

## Friend codes

Add a friend face to face by scanning their QR code (Friends → Scan a code, or festival mode's Friends tab). It's made for festival signal.

- **What a code says**: a link, `https://afterglowmusic.app/add/<handle>?u=<account id>&c=<friend code>&n=<name>`, so even a phone's own camera opens it (the website, or the app's `add/[handle]` page). Everything needed to add someone is in the code, so scanning works with no signal at all.
- **Both ways**: scanning makes you follow each other. Only someone who saw your current code can make you follow them: the scan writes a friend link with your code, and the rules check it against `friendCodes/{you}`, which nobody can read. Make a new code (My code → Make a new code) and old screenshots stop working. Blocking still wins.
- **No signal**: the scan is kept on the phone (`friendAdds.v1`) and tried again by itself (signal back, opening the app, every 15 s doubling to 5 minutes). When it goes through later you get a notification. A scan waiting more than a day, or refused 12 times, is given up and listed with Try again.
- **Your code** is made on your phone and saved to Afterglow the first time there's signal. Until then, scans of it wait (they go through once you've both had signal).

## Comments

- Firestore `comments/{id}` (`memoryId`, `owner` (who shared the video), `uid`, `handle` (yours, checked against your profile), `text` 1 to 300, `createdAt`). Anyone signed in reads them; you write as yourself with a profile, on a video that exists, not if its owner blocked you; never edited; removed by the writer or the video's owner. Unsharing a video removes its comments; deleting your account removes the comments you wrote and those on your videos. Indexes: (memoryId, createdAt asc), (owner, createdAt desc). Reports can now be about a comment.
- `commentProblem` (`social/validate.ts`) refuses empty, over-long and offensive comments (the same `obscenity` check as names and bios).
- `comments/[id].tsx` (form sheet): oldest first, "filmed it" on the sharer's own replies, Post at the bottom (or "Create a profile to comment"), hold a comment (or VoiceOver's action) to delete it (yours, or any on your video) or report / block. Reached from the Comment button on shared videos (with the count) and the speech bubble on crowd clips in Discover.
- The bell: "@sam commented on your video of HEDEX" with the words, opening the comments.

## Likes and the bell

- **One like everywhere.** Liking a video from the crowd (Discover's heart or double-tap, Your clips, or the heart on the shared video itself) is the same reaction on `community:<sharedId>`: it shapes your taste like any clip and, once you have a profile, the person who filmed it sees it. Without a profile the like stays on your phone, and the shared video says so.
- **Kept in step on the phone.** `features/community/likes.ts` (pure: `wantedLikes`, `likeChanges`) and `LikeSync` (root layout) compare what you like with what this phone has sent for your account (`community.v1`: `owners` clip → who shared it, `sent` account → clip ids) and send or take back one change at a time; one that fails (video removed, its owner blocked you, no connection) isn't retried until the app next opens. Likes live on the phone, not the account, so a second account signing in on the same phone would send them too. Start over clears your likes, and so takes back the public ones.
- **Counts.** The shared video shows its likes; on your own video the count opens `likes/[id].tsx` (who liked it, newest 100, Follow beside each, blocked people left out).
- **The bell** (`state/notices.tsx`, now inside `SocialProvider`) adds your activity to the festival notices: "@sam started following you" (opens their profile) and "@sam and 2 others liked your video of HEDEX" (opens it), from `SocialService.activity` (the newest 30 follows and likes), turned into notices by `features/notifications/activity.ts` (pure; likes on one video together; blocked people and deleted accounts left out). Read when you sign in, when the app comes back, and when you open the bell. There are no phone notifications for these (that needs a server).
- Removing a video from your profile removes its likes; deleting your account removes likes either way.

### Data and rules

| Firestore | Who can read | Who can write |
|---|---|---|
| `profiles/{uid}` | signed in | you, with a handle you own; field limits as in `validate.ts` |
| `handles/{handle}` | signed in | created with your profile; released only when your profile moves off it; never reassigned |
| `memories/{id}` | signed in | created by you, pointing at your own files; never edited; deleted by you |
| `blocks/{uid}` | you | you |
| `likes/{memoryId}_{uid}` | signed in | created by `uid` on someone else's existing video (`owner` must be its owner), not if the owner blocked you; never edited; deleted by the liker or the owner |
| `follows/{from}_{to}` | signed in | created by `from` (both have profiles, not yourself, not someone who blocked you); never edited; deleted by either |
| `crews/{id}` | signed in (get); listed only by members | created by you as its only member (with a profile); joined by adding only yourself (profile, at most 12, not if the owner blocked you); left by removing only yourself (an owner hands it to a member); renamed, members removed or deleted by the owner |
| `crews/{id}/picks/{uid}` | members of the crew | that member (`artists` up to 100); deleted by that member or the owner |
| `reports/{id}` | nobody (console only) | anyone signed in, as themselves |

Storage: `memories/{uid}/{id}.(mp4|mov|m4v)` (video, under 150 MB) and `.jpg` stills (under 5 MB), `avatars/{uid}.jpg`; written only by that uid, read by anyone signed in. Shared files are served through Firebase download links, which work for anyone who has the link; removing a memory from your profile deletes the file, so the link stops working.

`scripts/firebase-rules.test.mjs` checks both rule files against the Firebase emulator (53 checks, all passing on 2026-09-30).

## Tests

- `features/memories/__tests__/guess.test.ts`, `organize.test.ts`; `state/__tests__/memories.test.tsx`.
- `features/social/__tests__/social.test.ts` (validation, reading documents defensively, error kinds, publishing).
- `src/app/__tests__/memories.test.tsx`: the whole flow through the real routes, with the in-memory backend.
- `features/community/__tests__/likes.test.ts`, `features/notifications/__tests__/activity.test.ts`; `src/app/__tests__/likes.test.tsx` (likes from Discover and the video, private without a profile, counts and who, the bell).
- `features/social/__tests__/follow.test.ts` (follow and like rules in the in-memory backend); `src/app/__tests__/follow.test.tsx` (Follow on a profile, lists, Find people, Profile counts, blocking, Following in Discover).
- `features/crews/__tests__/together.test.ts`, `features/social/__tests__/crews.test.ts` (crew rules in the in-memory backend); `src/app/__tests__/crews.test.tsx` (start from a festival page, rename, stars reach the crew, join from an invite, sets you share, remove, leave, signed out, ended).
- `features/community/__tests__/clips.test.ts` (filtering, remembering artists, taste after a clip is gone); `src/app/__tests__/community.test.tsx` (Discover shows a shared video; credit, Report, Hide, Block, the switch, signed out, likes remembered).
- Not covered by `npm test`: the real picker, camera and media library, Firebase itself (the adapter), and the emulator rules check.

## Founders, flairs and festival badges

**Founders.** The first 100 people to make a profile get a number, in the order they arrive (`FounderClaim` in the root layout claims once a session as soon as you have a profile). Firestore keeps a counter at `counters/founders` and each founder at `founders/{uid}` (`number`, `at` server time). The rules only let you write your own number together with the counter moving on by exactly one, never past 100, so nobody can pick a number or claim twice; anyone can read them; deleting your account removes yours and the number is never given out again. A founder's photo gets a slowly turning gold ring with a warm glow and the caption "One of the first 100 on Afterglow · #23" (`features/standing/`: `StandingAvatar`, `StandingCaption`, `useStanding`, pure `standing.ts`). People who opened the app before this shipped claim theirs the next time they open it.

**Flairs (artists, the team, partners).** A special ring and caption that only Afterglow can give, by hand, in the Firebase console. The app can't write them. To give one:

1. Open the Firebase console, pick **afterglowmusic**, then **Firestore Database**.
2. Find the person's user id: open the `handles` collection, then the document named after their @handle (without the @); the `uid` field is their id.
3. Back at the top, click **Start collection** (or open `flairs` if it's there already), name it `flairs`.
4. Add a document whose **Document ID** is that uid, with two fields, both of type string: `kind` = `artist` (or `team`, or `partner`) and `caption` = what to show under their name, like `Artist` or `Afterglow team` (up to 40 characters).
5. Save. It shows on their profile within about ten minutes (sooner after an app restart).

Artists get a holographic pink-purple-blue ring, the team a purple one, partners a green one. A flair is drawn instead of the gold founder ring; the founder caption still shows under it.

**Festival badges.** Every festival has a collectible enamel pin (`features/badges/`): a gold shape, its own enamel colours and raised metal lines, its mark struck in gold, and a ribbon with the year, all worked out from the festival's id and name (`pinLook`), drawn in SVG (`EnamelPin`). You earn one by sharing a video tagged with the festival and filmed there, on its dates (from the video's own time; the morning after the last day counts). Badges are worked out from someone's shared videos (`earnedBadges`, `useBadges`), so anyone can see anyone's, and nothing new is stored. Profile has a Badges tab (yours, then dim silver "To collect" pins for festivals you're going to); public profiles show their badges above their memories; each opens `badge/[id]` (`?uid=` for someone else's), where the shine follows the phone's tilt.

## Photos in crews

Afterglow is video-only everywhere else; photos go only to crews. The check-in screen has "+ Add a photo" (Take a photo on phones, or Choose from Photos): the photo goes with that check-in (its words, stage and who's playing) as a crew update of kind `photo`, the picture in `thumbUrl` (Storage `crews/{crewId}/{uid}/{id}.jpg`, the crew's own folder). Rules: a photo update needs its picture and no video. Like any update it waits in the outbox for signal, keeping the time you tapped; the picked photo is first copied into the app's folder (`features/crews/photoFile.ts`) so it survives until it's sent, then that copy is removed. Leaving a crew removes the photos you sent there (they're remembered with your crew videos). Stories show it full screen with its words.
