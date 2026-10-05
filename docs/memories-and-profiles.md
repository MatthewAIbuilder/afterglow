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

### Inviting people you know

A crew page's **Invite friends** opens a list of people you follow and people who follow you (those going to the crew's festival first, crewmates last as "In the crew"), with **Invite** beside each, and **Share a link instead** for friends who aren't on Afterglow yet.

An invite is a Firestore document `crewInvites/{crewId}_{to}` (`crewId`, `festivalId`, `crewName`, `from`, `to`, `createdAt` = server time). Rules: only a member of the crew can send one, as themselves, to someone with a profile who isn't already in it and hasn't blocked them, for the crew's own festival; only the two people can read it; either can delete it. Index: `to` + `createdAt` descending. Joining the crew removes it; **Not now** (Friends tab) or **No thanks** (crew page) removes it too. Deleting an account removes invites both ways.

The person invited sees it in the bell ("Maya invited you to Bass crew"), at the top of the Friends tab (Join / Not now), and on the crew page ("Maya invited you · Cyclops Cove 4"). Pure helpers: `features/crews/invite.ts` (`inviteCandidates`, `openInvites`, `inviteTitle`, `inviteNotices`).

A crew link opened by someone new shows the crew first: the first-run welcome waits until they reach one of the tabs.

### Invite only, and the chat rules

Crews are invite only. You can join a crew in two ways: someone in it invites you in the app (`crewInvites/{crewId}_{you}`), or they send you its invite link, `https://afterglowmusic.app/crew/<id>?code=<code>`. The code lives in `crews/{id}/meta/invite`, which only members can read. Any member can make it the first time it's needed. Only the owner can change it ("Make a new invite link"), and the old link then stops working.

Joining (or starting a crew) means agreeing to the crew chat rules (`CHAT_RULES` in `features/crews/chat.ts`, also on the Community Guidelines page). The join writes `crews/{id}/joins/{you}` (`agreed: true`, the server time and, for a link, its `code`) in the same transaction as adding you to `members`. The rules refuse a join without that record, and also refuse it without an in-app invite or the link's current code (`joinedFairly` in `firestore.rules`). Someone who opens a crew without either sees "This crew is invite only". People already in a crew before this change stay in it.

### Crew chat

`crews/{id}/chat/{messageId}` holds `uid`, `text` (1 to 500), `atMs` (when it was written on the phone) and `sentAt` (server time):
- Members read it and write as themselves.
- A message is never edited.
- The writer or the crew's owner can remove it.
- The support account can read and remove a message that was reported (reports have `kind: 'chat'` and the target `crewId/messageId`).
- Leaving or being removed takes your messages with you, and ending the crew removes them all.

The app follows each of your crews' newest 150 messages live (`watchCrewChat`, a Firestore listener) in `state/crewChat.tsx`. Your messages go into an outbox on the phone (`crewChatOutbox.v1`) and send themselves when there's signal, keeping the time you wrote them. A message held back 10 minutes or more says when it reached the crew. When you last read each chat is kept in `crewChatRead.v1`; new messages show as "2 new messages" on the crew page's chat card, on the Friends tab's crews and as the glow dot on the Friends tab.

Like check-ins, a message keeps the time it was written: that's what the crew sees, and it decides the order. The server's time only says when it got through. Sending is built for bad signal. `sendCrewMessages` writes all of a crew's waiting messages in one small batch with no read first. If it hasn't got through in 12 seconds, it counts as no signal and is tried again. Retries never double a message, because ids are made on the phone.

The app says when signal held something up:
- your messages still waiting show "Waiting for signal…" with Try now;
- once they get through, "Your 2 messages reached the crew, held up 18 min by signal", plus a phone notification if they were held 10 minutes or more and you're not in that chat;
- a crewmate's late message reads "Sent 7:30 PM · reached the crew 8:00 PM", and the chat points it out.

**Seen by:** each member's `crews/{id}/reads/{uid}` holds when they last read the chat (server time). It's written when they read, and again once there's signal if that write didn't get through. Your latest message shows "Delivered", "Seen by Maya" or "Seen by everyone".

The chat screen is `crew-chat/[id].tsx`:
- the rules at the top;
- day headings, with each person's messages grouped together;
- quick messages ("On my way", "Where are you?"…);
- hold a message to delete it, or to report it or block whoever wrote it.

At a festival, the Friends tab shows each crew's chat card under Check in.

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

**Glow levels.** Your glow level from daily quests shows on your profile for everyone, as a gold "Level 4 · Neon" pill under your name (level 1 never shows). Only the number is published, at `levels/{uid}` (`level` 1 to 999, `at` server time): `LevelSync` in the root layout sends it a few seconds after it changes and removes it when you switch off "Show my glow level" in Edit profile (a phone setting, `showLevel.v1`, on by default; it applies straight away). The rules let only you write yours, with a profile; anyone can read it. It's read with the founder number and flair (`standingOf`), with its own catch, so a database whose rules predate it never hides the rest; account deletion removes it separately for the same reason.

## Photos in crews

Afterglow is video-only everywhere else; photos go only to crews. The check-in screen has "+ Add a photo" (Take a photo on phones, or Choose from Photos): the photo goes with that check-in (its words, stage and who's playing) as a crew update of kind `photo`, the picture in `thumbUrl` (Storage `crews/{crewId}/{uid}/{id}.jpg`, the crew's own folder). Rules: a photo update needs its picture and no video. Like any update it waits in the outbox for signal, keeping the time you tapped; the picked photo is first copied into the app's folder (`features/crews/photoFile.ts`) so it survives until it's sent, then that copy is removed. Leaving a crew removes the photos you sent there (they're remembered with your crew videos). Stories show it full screen with its words.
## The support account (Afterglow HQ) and Contact support

Signing in with **afterglowmusic.support@gmail.com** (`SUPPORT_EMAIL`) turns the app into a dashboard instead of the guest app: `(tabs)/_layout.tsx` redirects that account to `admin.tsx`. The database only opens to it once the email is confirmed: the rules' `isAdmin()` checks the token's email and `email_verified`. The dashboard asks to confirm first ("Send the email", then "I've confirmed it", which reloads the sign-in and its token).

- **Overview** (`features/admin/AdminOverview.tsx`, charts in `AdminCharts.tsx`, maths in pure `metrics.ts`): a range picker (7, 30 or 90 days) and four views. **At a glance**: "Right now" (people in the last hour and today, this week's new people and videos in sentences, and alerts: reports and support waiting, sign-ups up or down 30% on the period before, half the accounts inactive), tiles (active today / this week / this month, inactive 30+ days, new people and videos with ▲/▼ against the period before, totals), daily bars (people who opened the app, new people, videos; tap or drag across a chart to read a day), and Support and safety (support waiting, reports to look at, founders, crews and invites). **People**: accounts (signed in at least once), with/without a profile, online in the last hour, the daily share (today ÷ this month), days active a month, new vs returning this week, a running total of profiles, when accounts last opened the app (today, 2 to 7 days, 8 to 30, 1 to 3 months, longer), **Who came back** (by the week people arrived: came back on another day, a week or more later, active this week), phones and website, and app versions. **Content**: videos, people sharing (and their share of active people), videos a day, average length, likes, comments, follows and crews in the range with trends, likes and comments per video, the running total of videos, daily bars, **When people share** (by hour), top sharers, most filmed artists and festivals (tap to open). **Festivals**: the soonest festivals with how many show they're going and videos shared there.
  - *Active and inactive* come from `activity/{uid}` (`AdminPresence`: `firstSeenAt`, `lastSeenAt`, `days` (the phone's calendar days it opened the app on, newest last, at most 90), `platform`, `version`, `hasProfile`). `features/admin/ActivityPing.tsx` (root layout, renders nothing) writes it for every signed-in account except the support account, on sign-in and when the app comes back to the front, at most every 15 minutes (`shouldPing`, `nextPresence` in pure `presence.ts`). Rules: you write only your own, only those fields; only you and the support account read it; removed with the account. Nothing about what anyone watches is in it. Counts start from when people open a version that has it, so the first days are low; signed-out visitors aren't counted.
  - Totals are counted on the server (`getCountFromServer`); the charts read the newest 5,000 of each kind from the last 180 days (`adminActivity`, `adminPresence`) and work everything out on the phone.
- **Data** (`features/admin/AdminData.tsx`): the one place to throw lineups and set times at Afterglow. Pick the festival (search, or **New festival** with a name, first and last day as `YYYY-MM-DD`, and where), then:
  - **Paste text** and tap **Read the text**: a lineup (one act per line, or "A • B • C"), set times ("Friday", a stage like "Main Stage" or "Bass Tent:", then lines like "10:00 PM SUBTRONICS", "22:00–23:30 LEVITY @ Bass Tent", "TAPE B 11pm - 12:15am"), or a catalogue update (JSON in the `docs/catalogue.md` format) a Claude Code session gave back. Text is read on the phone (`setlist.ts`, pure: day and stage headings, times with or without AM/PM, worked out from the sets around them when missing, ends from the next set on the stage or an hour); `draft.ts` turns it into a catalogue update for that festival, keeping everything it already has (Add to the lineup, or Replace the lineup), matching names to artists on Afterglow and adding the rest. **Check before publishing** shows what it found, what was guessed, lines it couldn't read and any problems (checked exactly as the app reads catalogue files), then **Publish to everyone**.
  - **Read a photo of set times** (HQ on the website): pick a picture of the timetable (a screenshot from the festival's site or app). It's read in the browser, free, and the picture never leaves it (Tesseract.js, loaded from jsdelivr the first time). Grids with stages side by side are read stage by stage. The text lands in the box above, so check it (fix a misread name or time), then **Read the text** as usual. For a big grid, crop it to one day at a time and read each picture in turn; the text adds up in the box. In the app it says to use the website.
  - **Set times from fans**: fans can send set times for a festival that has none yet (festival page → For you → "Seen the set times? Send them to us": paste them and/or add a screenshot, which the phone shrinks to a JPEG under 900,000 characters and sends with them; an account is needed). They wait at the top of the Data tab ("Set times from fans"): **Read it** puts the text in the box (and, on the website, reads the screenshot into it too), then check and publish as usual; publishing marks them live, which deletes the screenshot and thanks the sender (a notification when their app next opens, and the Set scout badge). **Decline** deletes them, and the sender can send again. One waiting per festival per person. Firestore `setTimes/{uid_festivalId}` (only the sender and HQ can read it). **Needs a Firestore rules and indexes deploy.**
  - **Pictures and PDFs** (expo-document-picker; up to 10 files, 25 MB each) with a note go to the **Inbox** (Firestore `drops/{id}`, Storage `drops/{id}/…`, support account only). **Copy for Claude** shares a message with the festival, the note, each file's download link and any text, for pasting into a Claude Code session (cloud sessions can open Firebase Storage links); the upload is marked "With Claude". The session either adds it to `catalogue/afterglow.json` in a pull request or gives back a JSON block to paste into Paste text and publish. **Use the text** loads a saved text upload; **Done**, **Delete**.
  - **Live on Afterglow**: everything published from HQ (Firestore `published/{id}`: title, festival, the catalogue file text up to 800,000 characters; anyone can read, only the support account writes), each with **Take down**. `LivePatchSync` (root layout) reads them when the app opens and comes back to the front (kept in AsyncStorage `livePatches.v1` for no signal), and `CatalogProvider` applies them on top of the catalogue, oldest first (`applyPatches` in `data/merge.ts`; one that can't be used is skipped). So a published lineup or set times shows for everyone within minutes, signed in or not, until it's taken down. To keep something for good, copy it as a catalogue file into `catalogue/afterglow.json`.
- **Accounts** (`AdminAccounts.tsx`): find anyone by name or @handle and give **Afterglow Plus** (no end, 1 month, 3 months or 1 year: `plus/{uid}` `active`, `until`) and a **flair** (Artist / Team / Partner with a caption up to 40 characters: `flairs/{uid}`); everyone with one is listed. The rules let only the support account write these. More privileges can join this page later.
- **Support** (`AdminSupport.tsx`): every message, newest first, filtered Open / Answered / Closed / All, with who sent it, topic, phone and version; reply in place (the person sees it under Contact support), email them, close or reopen.
- **Reports** (`AdminReports.tsx`): reported videos, comments and profiles with the reason and note; look at a video, take a video or comment down (asked first; files removed too), mark dealt with.
- **View the app** shows the app as everyone sees it, with a "← Dashboard" pill to come back (`state/adminView.ts`, AsyncStorage `adminGuestView.v1`).

People write in from **Settings → About → Contact support** (`support.tsx`): a topic (I need help / Something's broken / An idea / A festival / Something else) and up to 1000 characters, stored in Firestore `support/{id}` with their name, @handle and sign-in email so support can reply; they read only their own, and replies show under "Your messages". Settings says "1 new reply" (`state/supportSeen.ts`, AsyncStorage `supportSeen.v1`). Signed out, it offers an email instead.

**Setting it up (once):**
1. Deploy the rules and indexes from your PC, in the app folder: `npx firebase-tools@latest deploy --only firestore,storage`.
2. In the app: Profile, then Create your profile, then New here. Use afterglowmusic.support@gmail.com and a password only you know. (If you already made an account with that email, choose Sign in instead.)
3. The dashboard opens and asks you to confirm the email: tap **Send the email**, open that Gmail inbox (check spam), tap the link, come back and tap **I've confirmed it**.

## Switching accounts

Hold the **Profile** tab (or Settings → Account → Switch account, or "Switch account" on the dashboard) to open `switch-account.tsx` (form sheet): the accounts saved on this phone (up to 5), one tap to move between them, the current one ticked. Handy for going from your own profile to the support account and back.

- The first time, tap **Save this account** and type its password (checked by signing in again), then **Add an account** for the other one. "Remember the password on this phone" (on by default) keeps it in the keychain (`features/accounts/vault.ts`, expo-secure-store, this device only, while unlocked); the website keeps no passwords (`vault.web.ts`) and asks each time.
- The list itself (uid, email, name, @handle, photo; never passwords) is AsyncStorage `savedAccounts.v1` (`state/savedAccounts.ts`); `SavedAccountSync` (root layout) keeps a saved account's name and photo current. Pure helpers in `features/accounts/saved.ts`.
- Signing in to another account replaces the current one only once it works, so a wrong password never signs you out; a saved password that stops working is forgotten and asked for again (`useSwitchAccount.ts`). After a switch the app starts from the top: the support account lands on its dashboard (its "view the app" choice is reset), anyone else on Discover. Deleting an account takes it off the list.

## The edge glow and Afterglow Plus

Every video in Discover gets a soft neon edge in festival light (`components/EdgeGlow.tsx`: a thin line with a haze around it running purple, pink, amber and blue, breathing slowly while it plays, still with reduced motion). YouTube clips get it just outside the player (their picture is never covered). Videos filmed with Afterglow (crowd videos, full screen, shared videos, and your own memories) also carry the word AFTERGLOW, small and spaced, in a gap on the right edge: Afterglow's mark on them wherever they're watched in the app or on the website.

It's an overlay in the app, not burned into the file: a video saved to Photos or sent from Memories is the person's own, unmarked. (Marking the file itself needs the development build.)

**Afterglow Plus** turns the glow off for that person's videos (everyone then sees them plain). It's a document `plus/{uid}` with `active: true` and, optionally, `until` (a date; after it Plus ends). Anyone can read it; nobody can write it from the app. The App Store purchase will set it from a server later; for now give it by hand:

1. Firebase console, **afterglowmusic**, **Firestore Database**.
2. Find their uid: `handles`, then the document named after their @handle; copy `uid`.
3. Start collection (or open) `plus`, add a document with that uid as its ID, a field `active` of type boolean set to true, and optionally `until` of type timestamp.
4. It applies within about ten minutes (sooner after an app restart).

## Sprouts

Little green collectibles people give each other at festivals, a rave tradition.

- **Giving** (`give-sprout.tsx`, from the Friends tab's Sprout button, Profile's "Your garden" row and the garden): choose a kind and an optional note (60 characters), then show the code. The code is a link, `https://afterglowmusic.app/sprout/<id>?u=<giver>&h=<handle>&k=<kind>&n=<name>`, so it reads with no signal, and a phone's own camera opens it on the website for someone without the app. The id (20 characters) is made on the giver's phone. One code is one sprout. While the code shows, it's checked every 4 seconds; when someone picks it up the screen says so with confetti. "Take it back" removes one nobody picked up and gives the seed back; "Send as a link" shares it to someone far away.
- **Seeds**: 5 a day, 10 on a festival day you're at (Tonight's festival); days turn over at 4 AM like quests. Counted on the phone.
- **Picking up** (`sprout/[id].tsx`, also reached by scanning with Afterglow's scanner): the sprout pops up out of the ground; "Add to my garden". Without an account it's kept on the phone (AsyncStorage `sprouts.v1`) and picked up automatically once you sign up or sign in. With no signal it's kept and picked up once there is (tried again 15 s, doubling to 5 min, for 3 days; the giver may still be offline too), with a notification if it went through later. Someone else got there first: it says so.
- **Growing**: everyone starts with one sprout. A plain sprout grows from what you do after it reaches you: festival days you're at (8), sprouts you give (4), videos you film (3), sets you watch (1). Seed, Sprout (6), Leafy (18), In bloom (36). At bloom it becomes the kind that grew it most: Wanderer (festival days), PLUR (giving), Spotlight (filming; Sunrise if one was filmed 5 to 8 AM), Bass / Melody / Groove (watching, by the sets' sounds). The kind is remembered once it blooms. Kinds you've grown can be given; sprouts you're given as a kind are collectibles, already grown.
- **Wild sprouts**: on each night of a festival you're going to that's on, a wild sprout appears in your garden (`wild:<festival>:<night>`), already grown, its kind picked by the festival and night (`wildKind`), the same for everyone there. The garden celebrates it and the bell says so. Only for a festival marked going before that night began (so is the festival-day double seeds and growth). Kept on the phone (`sprouts.v1` `wild`).
- **Your garden** (`garden.tsx`): your sprouts (tap for details, growth and tips), sprouts still waiting for signal, the seven kinds (grey until collected, with how they grow) and what you've given and who picked it up.
- **Data**: Firestore `sprouts/{id}`: `from`, `kind`, optional `note` and `festivalId`, `createdAt` (server time), then `to` and `claimedAt` once picked up. Rules: created as yourself with a profile; read by anyone signed in (with the code); picked up once, not by the giver or anyone the giver blocked, within 30 days, changing only `to` and `claimedAt`; taken back by the giver while nobody has it; removed with the account. Indexes: (from, createdAt desc), (to, claimedAt desc). Code in `features/sprouts/` (pure `sprouts.ts`, `outbox.ts`; `Sprout.tsx` draws them) and `state/sprouts.tsx`.
- **Later**: tapping phones together (NFC) needs the development build.
- **Artist collectibles** (artist sprouts in the code; the user's idea on 2026-10-04, redrawn the same day as glowing creatures at their request): every artist you've filmed (a video in your Memories tagged with them, festival or throwback) gives you their collectible; more videos level it up: bronze at 3, silver at 6, gold at 10 (`features/sprouts/artistSprouts.ts`, pure), shown as a ring in that metal round its tile. Each is a small glowing creature on a dark round tile (`features/sprouts/Collectible.tsx`, drawings in `creatures.tsx`, looks in `artistLook.ts`, pure; `Sprout` hands its `artist` and `tier` props over to it). It floats, blinks, and its flames, wings or tentacles move (still with reduced motion). About 20 big names have a hand-made creature inspired by their world, never their logos (`SIGNATURES` by folded name: SUBTRONICS The Watcher, an eye with tentacles; ILLENIUM The Phoenix; SEVEN LIONS The Lion; ZEDS DEAD a ghost; RL GRIME a lit pumpkin; WOOLI a ram; SLANDER half angel half devil; SPACE LACES an astronaut; ALISON WONDERLAND the White Rabbit; TROYBOI a king cat…). Everyone else gets their main sound's creature in their photo's colour (`SOUND`: dubstep a bass beast, riddim a robot, trap a wolf, melodic bass a moth, house a disco cat, techno an owl, pop a jellyfish, indie a fox, rock a dragon, hip-hop a bear, no sound a wisp). The garden has an "Artist collectibles" section (or grey figures of a few hand-made ones to aim for) with a sheet per collectible (level, what's next, Give one, See the artist), and a celebration for each new one and level (`sprouts.v1` `artistShown`; videos filmed before this shipped are taken as seen). Artist pages have "Their collectible". You can give one you've earned like a sprout (a seed each; you keep yours): the code and link carry `a` (artist id) and `an` (name), the Firestore sprout `artistId` and `artistName` (rules check both together; emulator: 93 checks pass), and it lands in their garden's collectibles, "from Maya". **Needs a Firestore rules deploy.** Using artist names and motifs should be part of the pre-launch legal review.
