# Festivals from EDMTrain (automatic)

Afterglow picks up upcoming festivals by itself every night from
[EDMTrain](https://edmtrain.com), so events like Insomniac's, Electric Forest
and many others show up without anyone typing in the lineup.

## How it works

1. Every night (about 5 am Eastern) the **Website** workflow on GitHub runs
   `scripts/import-edmtrain.ts`.
2. The script asks EDMTrain for festivals in the next 12 months, with their
   artists and days.
3. It turns them into Afterglow's catalogue format
   (`src/data/import/edmtrain.ts`):
   - EDMTrain lists each day of a festival separately. The script joins the
     days back into one festival, and keeps which day each act plays.
     Two runs within three weeks of each other become two weekends.
   - Festivals with fewer than 5 acts are left out, and so are festivals that
     are over. At most 150 festivals are kept, soonest first.
   - Artists already on Afterglow are matched by name. New ones are added
     with no sound yet, so they show as "New" until someone tags them.
   - **Festivals you added by hand in `catalogue/afterglow.json` always
     win.** If EDMTrain lists a festival in the same city on overlapping
     dates, or one with a similar name, it's skipped, so it never shows twice.
4. The result is published with the website as
   `https://afterglowmusic.web.app/catalogue.json`. The app reads it on
   start (`CATALOG_URL` in `src/config/data.ts`) and keeps the last good copy
   for when you're offline.
5. Each festival from EDMTrain has "Event info from EDMTrain ↗" at the
   bottom of its page, linking to its EDMTrain page, as EDMTrain asks.

### When something goes wrong

- If EDMTrain can't be reached, or its answer doesn't look right, the script
  stops and the website keeps the catalogue it already had. A bad night never
  empties the festivals.
- The script checks the file exactly as the app will, and never publishes one
  the app would refuse.
- The app itself also never lets a broken or empty file replace good data.

## Setting it up (one time)

You need a free EDMTrain API key. **Never paste it into a chat or a file in
the project**: it only goes into GitHub's secret settings.

1. Go to <https://edmtrain.com/developer-api> and request an API key. Say it's
   for a festival discovery app that credits EDMTrain on each event.
2. When the key arrives by email, open the project on GitHub:
   **Settings → Secrets and variables → Actions → New repository secret**.
3. Name: `EDMTRAIN_API_KEY`. Secret: paste the key. Click **Add secret**.
4. To run it straight away instead of waiting for the night: **Actions →
   Website → Run workflow → Run workflow** (on `main`).
5. When it finishes (a few minutes), open the run and look at the
   **Festivals from EDMTrain** step. It says how many festivals it wrote.
   Then open the app (or the website) again: the new festivals are on the
   Festivals tab.

Until the key is added, everything works as before and the step is skipped.

## Good to know

- Afterglow still uses only what EDMTrain publishes. No set times or clips
  come from it; those still come from you, in `catalogue/afterglow.json`.
- To change a festival EDMTrain gets wrong, add it to
  `catalogue/afterglow.json` (with the same dates and city). Yours wins from
  the next night on.
- To stop the import, delete the `EDMTRAIN_API_KEY` secret. The last published
  file stays until the next deploy, which then publishes an empty one.
- The very first run is also the first real test of EDMTrain's answer format
  (it couldn't be reached from the cloud session where this was built). If
  the step fails, the run's log says why in plain words; send that line to
  Claude.

## Artist photos (automatic)

Every night, after the festivals step, the Website workflow runs
`scripts/artist-photos.ts`. For every artist without a photo of their own
it looks up Deezer's public artist search (no key or account needed) and
adds the photo to the published `catalogue.json` as a `photos` list,
credited "Photo from Deezer" at the bottom of the artist page.

- Only an exact name match is used (letters and digits, ignoring accents
  and capitals), the most followed one if there are several, and never
  Deezer's blank placeholder. Back-to-back acts ("A b2b B") usually have no
  photo and keep their coloured initials.
- Photos found before are reused from the live file, so each night only
  looks up new artists (and ones not found yet).
- A photo you set yourself in `catalogue/afterglow.json` (`"image"` on the
  artist) always wins.
- If Deezer can't be reached, the photos already found stay and the rest
  wait for the next night. The app shows initials until a photo loads, and
  whenever one can't.
- Deezer's photos belong to Deezer and the artists. That's fine for testing;
  before a public launch, check Deezer's terms for showing them in an app,
  or switch to another source.

## Discover clips from YouTube (automatic)

Every night, after the festival and photo steps, the Website workflow runs
`scripts/youtube-clips.ts`. For artists on upcoming festivals who have no clip
yet (festivals you added by hand first, soonest first, in billing order), it
searches YouTube for "<artist> live set" and adds the best match to Discover
as a one-minute clip, a third of the way into the set (past the intro).

- **Any channel** (the owner's choice), but the video must name the artist,
  look like a set ("live", "set", "full set", festival words), run at least
  10 minutes, be public and allow playing inside other apps. Reactions,
  interviews, trailers, aftermovies, music videos and lyric videos are left
  out. The artist's own channel and well-known festival and live-set channels
  (Insomniac, Tomorrowland, Lost Lands, Boiler Room, Cercle and others) come
  first.
- YouTube's free daily allowance covers about 90 searches a night, so
  Discover fills up over a few nights. Clips found before are kept; artists
  with no set found are tried again after a month.
- The clip's credit line in Discover names the YouTube channel. Clips you add
  yourself in `catalogue/afterglow.json` always stay; an artist who already
  has one isn't searched.
- If a clip looks wrong, tell Claude the artist: it can be left out.

### Setting it up (one time)

You need a free YouTube API key from Google. **Never paste it into a chat
or a file in the project**: it only goes into GitHub's secret settings.

1. Go to <https://console.cloud.google.com/> and sign in with your Google
   account.
2. At the top, click the project picker, then **New project**. Name it
   `Afterglow` and click **Create**. Make sure it's selected.
3. In the search bar, type **YouTube Data API v3**, open it and click
   **Enable**.
4. Open **APIs & Services → Credentials → Create credentials → API key**.
   Copy the key it shows.
5. Click **Edit API key** (or the key's name). Under **API restrictions**,
   choose **Restrict key**, tick **YouTube Data API v3**, and **Save**.
6. On GitHub: **Settings → Secrets and variables → Actions → New repository
   secret**. Name: `YOUTUBE_API_KEY`. Secret: paste the key. **Add secret**.
7. To run it straight away: **Actions → Website → Run workflow → Run
   workflow**. When it finishes, the **YouTube clips** step says how many
   clips it found. Open Discover in the app (pick "Your mix" or a festival)
   to see them.

There's no cost: the key stays within YouTube's free daily allowance, and
Google doesn't charge for it unless you add billing yourself.
