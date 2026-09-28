# Afterglow (working title)

Festival live-set discovery. Milestone 4: artists, festivals and lineups.

## Run it on your phone

1. Install Node.js LTS from nodejs.org.
2. Install **Expo Go** on your phone (App Store / Google Play).
3. In this folder:
   ```
   npm install
   npx expo start
   ```
4. Scan the QR code (iPhone: Camera app, Android: Expo Go). Phone and computer must be on the same Wi-Fi. If not, run `npx expo start --tunnel`.

## Add artist photos

Open `src/data/artists.ts` and paste a direct image link into each `imageUrl`. Save, and the app reloads. Empty entries show a gradient monogram.

## What to test in Milestone 4 (artists and festivals)

- New Festivals tab: each festival shows how many artists you'll love and whether set times are out.
- Open a festival: full lineup, sorted For you (by match) or Billing (poster order). Set times show when published.
- Horizon 2027 has no set times yet, like most festivals for most of the year.
- Artist page: open it from a bubble (View artist), from the name in the feed, or from any lineup row. It shows where they play, their clips (tap one to play it in Discover) and artists with a similar sound.
- Likes, saves and skips now survive closing the app.

### Adding a real lineup poster

In `src/data/festivals.ts`, paste a direct image link into `posterImageUrl`. The festival page then shows the poster; tap it for full screen, pinch to zoom, double-tap to zoom in or out.

## What to test in Milestone 3 (taste learning)

- Like or save a few clips, skip a few others, then open My Sound.
- A moment after the map appears it reshapes: bubbles grow, shrink and glide to new places, with a light haptic.
- Similar artists move too: skipping one riddim artist lowers its neighbours a little.
- The match % in the feed updates immediately.

The engine lives in `src/features/taste/engine.ts`.

## What to test in Milestone 2 (Discover)

- Swipe up and down: one clip per screen, a light haptic on each new clip.
- Tap once to pause (the light show freezes), tap again to play.
- Double-tap to like: heart burst and a strong haptic.
- Like, Save and Skip buttons on the right. Skip jumps to the next clip.
- The thin bar at the bottom shows clip progress and loops.

Clips are placeholders drawn in code (stage lights pulse to each set's tempo). Real footage plugs in through `videoUrl` in `src/data/clips.ts` in a later milestone.

## What to test in Milestone 1 (My Sound)

- The map blooms open from the centre, strongest matches first.
- Drag to pan with momentum, pinch to zoom around your fingers, double-tap to recenter.
- Tap a bubble: haptic, the map glides it into view, the glass card rises.
- Drag the card down or tap outside to dismiss.
- Switch tabs: selection haptic.

## Structure

```
src/
  app/                 Screens (Expo Router, file = route)
    (tabs)/index.tsx   Discover (placeholder until Milestone 2)
    (tabs)/sound.tsx   My Sound
  components/          Shared UI: NightSky, GlassTabBar, ArtistAvatar
  features/sound-map/  Map: layout engine, bubble, canvas, artist sheet
  features/discover/   Feed: clip card, placeholder stage scene, action rail
  data/                Types and mock data (artists, clips, festival, taste profile)
  state/reactions.tsx  Likes, saves and skips (the signal the taste engine learns from)
  theme/tokens.ts      Colour, type, spacing, radius, motion
  lib/haptics.ts       Haptic vocabulary
  config/app.ts        App name
```

The layout engine (`features/sound-map/layout.ts`) is pure TypeScript: artists are placed by blending positions of their sound tags, pulled toward the centre by match strength, then relaxed so bubbles never overlap. The taste profile is the single seam where real recommendations plug in later.
