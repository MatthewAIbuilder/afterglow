# Memories and profiles

How Afterglow keeps your own festival videos, guesses who was playing, and shares what you choose to a profile. Setup for profiles: [`firebase-setup.md`](firebase-setup.md).

## Memories (on the phone, private)

```
Discover: press and hold around a clip ──► Record a video / Choose from library (useAddMemory)
        │                                    expo-image-picker (iPhone trims to 3 min)
        ▼                                    when + where: the video's creation time and location
features/memories/device.ts                  (expo-media-library), or now + here for a recording
  pickVideo → PickedVideo { uri, source, durationSec, moment: { when, place: { city, region } } }
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
| `reports/{id}` | nobody (console only) | anyone signed in, as themselves |

Storage: `memories/{uid}/{id}.(mp4|mov|m4v)` (video, under 150 MB) and `.jpg` stills (under 5 MB), `avatars/{uid}.jpg`; written only by that uid, read by anyone signed in. Shared files are served through Firebase download links, which work for anyone who has the link; removing a memory from your profile deletes the file, so the link stops working.

`scripts/firebase-rules.test.mjs` checks both rule files against the Firebase emulator (44 checks, all passing on 2026-09-30).

## Tests

- `features/memories/__tests__/guess.test.ts`, `organize.test.ts`; `state/__tests__/memories.test.tsx`.
- `features/social/__tests__/social.test.ts` (validation, reading documents defensively, error kinds, publishing).
- `src/app/__tests__/memories.test.tsx`: the whole flow through the real routes, with the in-memory backend.
- `features/community/__tests__/likes.test.ts`, `features/notifications/__tests__/activity.test.ts`; `src/app/__tests__/likes.test.tsx` (likes from Discover and the video, private without a profile, counts and who, the bell).
- `features/social/__tests__/follow.test.ts` (follow and like rules in the in-memory backend); `src/app/__tests__/follow.test.tsx` (Follow on a profile, lists, Find people, Profile counts, blocking, Following in Discover).
- `features/community/__tests__/clips.test.ts` (filtering, remembering artists, taste after a clip is gone); `src/app/__tests__/community.test.tsx` (Discover shows a shared video; credit, Report, Hide, Block, the switch, signed out, likes remembered).
- Not covered by `npm test`: the real picker, camera and media library, Firebase itself (the adapter), and the emulator rules check.
