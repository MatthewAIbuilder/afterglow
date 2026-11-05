# Festival maps

A festival's own map in Afterglow: the official map picture, with your blue dot on it, markers for stages, water, medical and the rest, and real walking times between stages. It shows on the festival's **Info** tab and on **Tonight** in festival mode, and it stays on the phone, so it opens with no signal.

Only use a map picture you have the rights to: one the festival or organizer gave you, or that they publish for fans to use.

## Adding a map (HQ)

1. Sign in as the support account and open **HQ → Maps** (on a computer is easiest).
2. Find the festival, then tap **Choose the map picture** and pick the official map (PNG, JPG or WebP, under 15 MB).
3. **Pin it to the ground.** Pick three spots far apart that you can find on both the picture and Google Maps (a stage, an entrance, a corner of the grounds; not all in a line).
   - Choose **Spot 1**, tap that place on the picture.
   - In Google Maps, right-click the same place, click the coordinates at the top to copy them, and paste them into the box (like `28.53831, -81.40395`).
   - Do the same for **Spot 2** and **Spot 3**.
4. **Check it.** Choose **Check a spot** and tap somewhere on the picture. The app says where it thinks that is: open it in Google Maps and make sure it's the same place. If it's off, move a spot.
5. **Add markers.** Choose a kind (`+ stage`, `+ water`, `+ medical`…) and tap the picture where it is. For a stage, first pick which of the festival's stages it is, so the app knows what's playing there and how far apart stages are. You can name any marker in the list below the picture.
6. Tap **Save the map**. It's on Afterglow straight away.

## What people see

- **The map:** pinch to zoom on iPhone. Markers come in colours by kind, and the chips at the top hide or show each kind.
- **Your dot:** a blue dot where you are, when you're on the grounds and have allowed location.
- **Your trail:** today's line on the map, when the festival trail is on.
- **Markers:** tapping one says what it is and how far a walk it is. On a stage, it also shows what's on now and next.
- **Walking times:** the full-day route uses the real walks between pinned stages instead of a guessed 10 minutes.
- **Sets you've seen:** "Were you at these?" offers the sets where your trail stayed near a stage for 15 minutes or more. You tap "I was there" or "No"; nothing is added on its own.

## Pasting a marker list (EDC Orlando 2026)

HQ → Festival maps has an "Add these markers" box under Markers. It takes a list like `docs/venue-marker-lists/edc-orlando-26.json`: `{ "width", "height", "pins": [{ "kind", "label", "x", "y" }] }`, with x and y measured on a picture `width` × `height`. The spots are scaled to the picture actually uploaded, unknown kinds and spots off the picture are left out, and the total stays within the 200-marker limit (`src/features/venueMap/markerList.ts`, tested).

The EDC Orlando list (32 markers: first aid, restrooms, food, lockers, charging, water, info, entrance and four stage rings) was read off the festival's own map graphic by matching its legend icons, then checked by drawing them back on the picture. They are estimates: check a few with "Check a spot" in Google Maps satellite view before saving. Stage markers carry no stage link (the catalogue has no EDC stages yet); VIP-only items are left out. Use the festival's map picture only if you have the rights to it.

Steps: HQ → Festival maps → find EDC Orlando → choose the map picture (the cropped one, 1206 × 1520) → place Spots 1–3 and paste each one's coordinates from Google Maps → paste the list → Add → check → Save the map.
