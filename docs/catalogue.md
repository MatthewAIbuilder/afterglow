# Adding real festivals to Afterglow

Afterglow reads its festivals, artists and clips from a **catalogue file**, a plain text file in a format called JSON. You don't need to write code to change it. This guide shows you how.

There's a complete, working example in [`catalogue-example.json`](catalogue-example.json). Copying it and changing the details is the easiest way to start.

## Three ways to get your data in

**1. Ask Claude (easiest).** Start a session and paste something like:

> Add Lost Lands 2026 to the catalogue. Dates Sep 18 to 20, Thornville Ohio. Lineup: Excision, Subtronics, Levity. Here are the set times: … Here are official YouTube links for clips: …

Claude fills in `catalogue/afterglow.json`, checks it and opens a pull request.

**2. Edit the file in the app's code.** The file is `catalogue/afterglow.json`. Whatever you put there ships with the app. To see a change, pull the latest code and run `npx expo start`.

**3. Host the file yourself, so you can update the app without touching code.** This is best once you're adding real lineups regularly.
1. Go to [gist.github.com](https://gist.github.com) and sign in with your GitHub account.
2. Name the file `afterglow.json`, paste in your catalogue and click **Create secret gist**.
3. Click **Raw** and copy the address from your browser's address bar. It looks like
   `https://gist.githubusercontent.com/YourName/abc123…/raw/9f8e…/afterglow.json`.
4. **Delete the part between `/raw/` and `/afterglow.json`** so that the link always points to the latest version:
   `https://gist.githubusercontent.com/YourName/abc123…/raw/afterglow.json`
5. Ask Claude to set `CATALOG_URL` in `src/config/data.ts` to that link. You only need to do this once.

   From then on, edit the gist whenever lineups or set times change. The app picks up the new version the next time it opens.
   - GitHub can take a few minutes to serve a new version.
   - The app remembers the last good version, so it still works offline.
   - A broken file never replaces a good one.

## What goes in the file

```json
{
  "version": 1,
  "mode": "add",
  "updated": "2026-09-29",
  "artists": [ … ],
  "festivals": [ … ],
  "clips": [ … ]
}
```

- **`version`** is always `1`.
- **`mode`**:
  - `"add"` (the default) keeps the demo festivals and adds yours. Your festivals come first, so Discover opens on them.
  - `"replace"` shows only what's in your file. Use this once your real data is complete.
- **`updated`** is optional: a note to yourself of when you last changed the file.

### Ids

Every artist, festival and clip has an **id**, a short name that other parts of the file use to refer to it. Use lowercase letters, numbers and dashes, like `sara-landry`, `lost-lands-26` or `ll26-excision-1`. Once an id is in use, don't change it. Likes, saves and must-sees are remembered by id.

The demo artists already exist, and you can use them in your lineups without adding them again: `illenium`, `subtronics`, `levity`, `tape-b`, `excision`, `sara-landry`, `john-summit`.

### Artists

```json
{ "id": "aurora-drift", "name": "AURORA DRIFT", "sound": { "melodic-bass": 0.8, "house": 0.3 } }
```

- **`sound`** places the artist on the My Sound map. Use any of `melodic-bass`, `dubstep`, `riddim`, `trap`, `techno`, `house`, `pop`, `indie`, `rock` and `hip-hop`, each with a number from 0 to 1 for how much of that sound they carry.
  - If you're not sure, leave `sound` out. The artist shows as "New" until you react to their clips.
  - With a sound, the app can work out who's similar to artists you like. My Sound shows up to 40 artists the app knows something about, and new ones join as your likes reach them.
- **`image`** (optional) is a photo link starting with `https://`. Only use images you have the rights to.

### Festivals

```json
{
  "id": "nightfall-27",
  "name": "Nightfall 2027",
  "dates": "Aug 6 to 8",
  "start": "2027-08-06",
  "end": "2027-08-08",
  "location": "Riverside Park",
  "lineup": ["illenium", { "artist": "aurora-drift", "note": "Sunset set" }, "levity"],
  "days": ["Friday", "Saturday"],
  "stages": [{ "id": "main", "name": "Main Stage" }],
  "sets": [
    { "artist": "illenium", "day": "Friday", "stage": "main", "start": "23:30", "end": "01:00" }
  ]
}
```

- **`lineup`** is artist ids in billing order, headliners first. When the poster says something about a set, like "(sunset set)" or who's in a collaboration, write that entry as `{ "artist": "…", "note": "Sunset set" }`. The note shows under the artist in the lineup and on their page.
  - When the poster lists acts by day, add the day too: `{ "artist": "…", "days": ["Friday"] }` (two days for someone playing twice). Each day must be in the festival's `days`. The lineup and My Sound can then be filtered day by day before set times are out.
- **`start`** and **`end`** (optional) are the first and last day, written as year-month-day, like `"2026-11-06"`. With them, the app shows a countdown: "In 38 days", "Tomorrow", "Happening now". `dates` is still the text people read, like "Nov 6 to 8".
- **`sets`** can wait: leave them out until the festival publishes set times. The festival page shows "set times aren't out yet" until then.
  - Times use the 24-hour clock.
  - A set that runs past midnight belongs to the night it starts. For example, `"day": "Friday"` with `"start": "23:30"` and `"end": "01:00"`.
  - Every set's day must be in `days`, and its stage in `stages`.
- **`poster`** (optional) is a link to the official lineup poster, starting with `https://`. Only use a poster you have the rights to.
- **`weekends`** (optional) is for a festival that runs over separate weekends, like ACL or Coachella. List each weekend's first and last day, in order:
  `"weekends": [{ "start": "2026-10-02", "end": "2026-10-04" }, { "start": "2026-10-09", "end": "2026-10-11" }]`.
  - The countdown then says "Weekend 2 in 4 days" in the week between, instead of "Happening now".
  - Reminders come the day before each weekend.
  - `start` and `end` are filled in from the weekends, so you can leave them out.

### Clips

```json
{
  "id": "nightfall-illenium-1",
  "artist": "illenium",
  "festival": "nightfall-27",
  "title": "Live at Lost Lands 2025",
  "video": {
    "link": "https://www.youtube.com/watch?v=JssDaUK0_GQ",
    "from": "25:00",
    "to": "25:45",
    "channel": "Lost Lands"
  }
}
```

- **`video.link`** is any normal YouTube link: a watch link, a youtu.be link or a Shorts link. Shorts get the tall player automatically.
- **`from`** and **`to`** are the part of the video to play, written as minutes:seconds (or hours:minutes:seconds). Keep it under 3 minutes.
- **`channel`** is who uploaded it. Only use uploads from the artist's, festival's, label's or event's **official** channel.
- Before adding a video, check that it:
  - is public,
  - shows the right artist at that time,
  - plays when embedded (on YouTube: **Share**, then **Embed**).
- A clip without a video shows the drawn stage instead. It then needs `"seconds"` for how long it runs.
- **`bpm`** (optional) sets the tempo of the stage light show.

### Similar artists (optional)

```json
"similar": [{ "artist": "aurora-drift", "other": "illenium", "score": 0.7 }]
```

This tells the app two artists sound alike, beyond what their `sound` tags say. The score goes from 0 to 1.

## When something's wrong

The app never crashes on a bad file. It leaves out what it can't use and explains why.

- While running `npx expo start`, any problems appear in the terminal as a yellow **Catalogue** warning, one line per problem. For example: *Festival "nightfall-27": the set for "levity" was left out. Check they're on the lineup, and that the day and stage exist.*
- If the whole file is ignored, the usual cause is a missing comma, quote or bracket. Paste the file into [jsonlint.com](https://jsonlint.com) and it will point to the exact line.
- `npm test` also checks `catalogue/afterglow.json` and this guide's example. Claude runs it before opening any pull request.
