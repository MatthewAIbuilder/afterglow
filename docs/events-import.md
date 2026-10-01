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
  Deezer's blank placeholder.
- Back-to-back acts ("SUBTRONICS B2B CRANKDAT", or "WITCHING HOUR (JEANIE
  B2B VAMPA)") have no photo of their own, so their avatar is one circle
  split between the artists playing, each with their own photo. Artists
  already on Afterglow bring theirs; for the others the same step looks up
  each name (after the solo artists, within the night's 600 lookups) and
  adds them as `memberPhotos` (name -> link). Only "b2b" (or b3b, b4b)
  splits a name: "&" and "x" are usually a duo's own name.
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
- If a clip looks wrong, flag it in Discover (the ••• under the video): it's
  hidden for you at once, and "Send report" emails the video's link. Adding
  that video to `blockedVideos` in `catalogue/afterglow.json` (see
  `docs/catalogue.md`) takes it out for everyone, and the next night's search
  finds that artist another set.
- The app's bell says when new sets arrive for artists you'd love ("New live
  sets from SUBTRONICS and 2 more you'd love") and opens Discover on them. The
  first time the app sees the clips it only takes note, so nobody gets a pile
  of news on their first day.

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

## Who sounds alike, from lineups (automatic)

Artists from EDMTrain arrive without sound tags, so nothing you like could
reach them. Every night `scripts/lineup-similar.ts` works out which artists
keep sharing bills (and days) and publishes those pairs in `catalogue.json`
as `similar`. A like or a love then spills over to artists who keep playing
alongside them, like it does for artists who sound alike.

- Only pairs where at least one artist has no sound tags (tags stay the
  judge between tagged artists), after at least two festivals together.
- A small bass weekend counts for more than a 140-act city festival, and a
  shared day counts extra. A pair is never more than 70% alike, so a guess
  from lineups never counts as much as a real match of sound.
- Each artist keeps their six closest. Tagging an artist's sound in
  `catalogue/afterglow.json` replaces these guesses for them.

## Artist colours (automatic)

After the photo step, `scripts/artist-colors.ts` takes each artist's colour
from their photo (the most present vivid colour in a small copy of it) and
publishes it in `catalogue.json` as `colors`. Their bubble's glow on My
Sound, their initials, their artist page and their Discover stage then use
it, softened to stay within the night palette. Black-and-white or washed-out
photos keep the app's own colours, and so does anyone without a photo.
Colours are kept from night to night while the photo is the same.

## Pictures from official sites (automatic)

Every night, after the artist colours, the Website workflow runs
`scripts/site-pictures.ts`. For every festival with an official `website`
link (and no `poster` of its own) it reads the picture the site shares
(the one you see when you paste the link into a message: its "og:image")
and adds it to the published `catalogue.json` as `sitePictures`.

- The festival page shows it where the poster goes, credited "From
  orlando.edc.com", whole (a wide banner sits over a soft blurred copy), and
  tapping it opens the zoomable viewer.
- It's often the lineup poster, but it can be key art or a logo, which is
  why it's credited to the site rather than called the poster. A `poster`
  set in `catalogue/afterglow.json` always wins.
- Only https pictures that really are images (JPEG, PNG, WebP, GIF or AVIF)
  are used. A site that can't be read keeps last night's picture.
- Only festivals with a `website` get one, so for more of them, add their
  official site links to the catalogue. EDMTrain's festivals only link to
  EDMTrain, so they don't get one.

