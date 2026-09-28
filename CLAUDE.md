# Afterglow (working title)

A premium, Apple-level mobile app for discovering live DJ and festival performances. It combines a TikTok-style feed of live-set clips, behavior-driven artist recommendations, festival lineups and an interactive "My Sound" artist bubble map. The long-term headline feature is a personalized festival schedule built from the user's taste.

Expo / React Native / TypeScript. Also read @AGENTS.md (Expo's own agent rules: use `npx expo install`, Expo Router, current SDK docs rather than memory).

## Current state

Milestone 5 is built (awaiting on-device testing). Built so far:
- **Discover**: full-screen vertical feed, one clip per page; tap to pause, double-tap to like, Like/Save/Skip rail, progress bar, haptics. Clips are placeholder "stage scenes" drawn in code (beams, beat-synced glow, crowd); `Clip.videoUrl` is the slot for real footage.
- **My Sound**: bubble map. Top match pinned at centre, others placed by sound direction and distance by match, label-aware collision (no overlaps), pan with momentum, pinch zoom, double-tap recenter, bubbles trail and wobble when panned, reshape animation when taste changes, glass artist sheet.
- **Festivals** tab, festival pages (lineup sorted For you / Billing, set times when published, optional lineup poster with full-screen zoom viewer).
- **Artist** pages: match, sound tags, where they play, clips (open in Discover), similar artists.
- **Taste engine** v1 and **persistent reactions** (AsyncStorage).
- **Your festival** (Milestone 5) on each festival page. Before set times: lineup ranked into Must see / Strong match / Explore from the live match. After set times: day-by-day timeline, clashes grouped with a suggestion (clear winner, close call, or your starred pick, plus how much of the other set you can still catch), explore picks as discoveries when you're free or as a quiet alternative. A star marks a personal must-see; it's a planning preference stored apart from reactions and never changes the match.

Do not start Milestone 6 unless asked.

## Product principles

- **Visual standard is non-negotiable**: Apple-level polish, dark-first, minimal and premium, excellent typography and spacing, smooth purposeful motion, tasteful blur/glass, strong but meaningful haptics. No generic dashboard look, no cheap neon "EDM app" look. The accent is one restrained purple glow ("festival light at night"). Artist imagery should eventually drive per-artist color.
- **The bubble map is the core differentiator.** Bubble size = predicted affinity. Similar sounds cluster naturally. It should feel like a living musical universe, not a chart.
- **Recommendations are behavior-driven.** Scores come from what the user does: today likes, saves and skips (with spill-over to similar sounds); later watch time, replays, follows and other meaningful signals. Never replace this with arbitrary static scores. `data/tasteProfile.ts` is only the starting prior.
- **Festivals have two phases.** Lineups are known months ahead; set times arrive a week or two before. Every schedule feature must work gracefully in both.
- Copy is plain, sentence case, user-facing (no developer language in the UI).

## Architecture

```
src/
  app/                        Expo Router routes (file = screen)
    _layout.tsx               Root Stack + GestureHandlerRootView + ReactionsProvider
    (tabs)/_layout.tsx        Tabs with custom GlassTabBar
    (tabs)/index.tsx          Discover
    (tabs)/sound.tsx          My Sound
    (tabs)/festivals.tsx      Festivals list
    artist/[id].tsx           Artist page (stack push)
    festival/[id].tsx         Festival page (stack push)
    poster/[id].tsx           Lineup poster viewer (full-screen modal)
  components/                 Shared UI: NightSky, GlassTabBar, GlassCircleButton, ArtistAvatar, ArtistRow, TabIcons
  features/discover/          DiscoverFeed, ClipCard, StageScene, ActionRail, icons
  features/sound-map/         layout.ts (pure layout engine), SoundMap, ArtistBubble, ArtistSheet
  features/taste/engine.ts    Pure taste engine: reactions -> TasteProfile (+ which scores rest on real signal)
  features/plan/              plan.ts (pure: tiers, schedule, clash verdicts), copy.ts, YourFestival, MustSeeList, Timetable, MustSeeToggle
  state/reactions.tsx         Likes/saves/skips context, persisted to AsyncStorage
  state/taste.ts              useTaste(): live profile + summary
  state/plan.tsx              Starred must-sees, persisted to AsyncStorage (planning only, never fed to the taste engine)
  data/                       Types and mock data: artists, clips, festivals, tasteProfile
  theme/tokens.ts             Color, type, spacing, radius, motion springs. Use these, never ad-hoc values.
  lib/haptics.ts              Haptic vocabulary (select, tap, soft, settle)
  config/app.ts               App name
```

Key data models (`src/data/types.ts`): `Artist` (id, name, optional imageUrl, `sound` weights per `SoundTag`), `TasteProfile` (artistId -> 0..1), `Clip` (artist, festival, title, duration, bpm, optional videoUrl), `Festival` (lineup in billing order, days, stages, optional `sets` and `posterImageUrl`), `SetTime` (artist, day, stage, start/end 24h). Reactions: `{ liked, saved, skipped }` per clip id.

Pure logic (layout, taste engine) stays free of React so it can be tested and later moved server-side.

## Rules for changes

- Work in **small, testable milestones**. Propose the smallest next step before large changes. Stop after each milestone so the user can test on a real phone.
- **Never rebuild or redesign working features** unless explicitly asked. Extend, don't replace.
- No backend, auth, scraping, payments or AI services unless the user asks.
- Add dependencies only with `npx expo install` and only if they run in Expo Go.
- Mock data only; don't add real artist photos or festival posters yourself (the user supplies links they have rights to).
- Respect reduced motion (`useReducedMotion`) and accessibility labels.

## Commands

```
npm install                                   # .npmrc sets legacy-peer-deps (needed for SDK 57)
npx tsc --noEmit                              # type-check
npm test                                      # Jest (jest-expo): pure logic in src/**/__tests__
npm run lint                                  # expo lint (some pre-existing Reanimated findings in older files)
npx expo export --platform ios --output-dir /tmp/exp-ios          # build check
npx expo export --platform android --output-dir /tmp/exp-android  # build check
npx expo-doctor                               # dependency/config health
npx expo start                                # run in Expo Go (user tests on device)
```

After any significant change: type-check, run both export build checks and expo-doctor, and fix everything before finishing. Cloud sessions can't run the app on a phone, so summarize exactly what the user should test in Expo Go.

## User context

The user is not a developer and tests on Windows + iPhone via Expo Go. Give plain, step-by-step instructions for anything they must do themselves.
