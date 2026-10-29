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

## Shows on artist pages (automatic)

In the same step, after the festivals, the script also asks EDMTrain for
club nights and concerts (everything that isn't a festival) in the next six
months, and adds them to `catalogue.json` as `shows`
(`src/data/import/edmtrainShows.ts`). Each artist's page then has an
**Upcoming shows** section: the date, the event or venue, the town, and
anyone else on Afterglow on the same bill ("with CRANKDAT"). The next five
show first, with "See all" for the rest. Tapping a show opens its page on
EDMTrain, and the section ends with "Show info from EDMTrain ↗", as
EDMTrain asks.

- Only artists already on Afterglow get shows (yours, and the ones the
  festival import added). A club night never adds a new artist.
- Names are matched the same way as for festivals (ignoring capitals and
  accents). A b2b act ("SUBTRONICS B2B CRANKDAT") counts for each of its
  artists who is on Afterglow.
- Festivals and livestreams are left out (festivals have their own pages),
  and so are shows that are over or have no venue or EDMTrain link.
- To keep the file small: at most 6 upcoming shows per artist, 8 Afterglow
  artists per show and 1,500 shows in all, soonest first. If they'd still
  take too much room, the farthest ones go first.
- If EDMTrain doesn't answer this second question, the festivals are still
  published, with no shows that night (the run's log has a warning).
- Shows are only what EDMTrain publishes; nothing is added by hand.

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

## SoundCloud pages (automatic)

You chose this on 2026-10-06: SoundCloud from the artists themselves in
Discover, automatic, with no developer key. Every night, after the artist
photos step, the Website workflow runs `scripts/soundcloud-artists.ts`.

- For each artist on Afterglow (festivals you curated first, then the
  rest, soonest first) it tries up to three likely page links made from the
  name (`john-summit`, `johnsummit`, `johnsummitmusic`) and asks
  SoundCloud's public oEmbed address about each
  (`https://soundcloud.com/oembed?format=json&url=…`).
- A page counts only when the name SoundCloud gives it is the artist's name
  exactly (ignoring capitals, accents and punctuation). Back-to-back acts are
  skipped: they have no page of their own.
- At most 150 questions a night, a quarter of a second apart. Pages found
  are kept in the published `catalogue.json` (`soundcloud`) and never asked
  about again; artists with no page found are listed in `soundcloudMisses`
  and asked again after 30 days. Merges during the day only keep what's
  found (`SOUNDCLOUD_REQUESTS=0`).
- A link you set yourself on the artist in `catalogue/afterglow.json`
  (`"soundcloud": "https://soundcloud.com/…"`) always wins and is never
  looked up: that's how to fix a wrong match. Someone who taps "Wrong
  artist" on a SoundCloud card in Discover hides it on their phone and can
  email you a report.
- It never stops the night: if SoundCloud can't be reached or blocks the
  questions, you'll see a warning in the workflow run, last night's pages
  stay, and the rest wait for the next night. The run prints a line like
  "SoundCloud: 312 of 1124 artists (12 new, 140 asked tonight, 40 not found)".
- Discover plays the pages in SoundCloud's own embedded player (their
  uploads), with the artist's photo softly behind it. A SoundCloud card only
  shows for artists you're a good match for (or have liked), at most one in
  six cards, never two in a row, behind the live-set videos.
- The cloud sessions that build Afterglow can't reach soundcloud.com, so this
  was tested with made-up answers only: **the first nightly run is the real
  test.** Check its "SoundCloud pages" step in the Actions tab.

## Discover clips from YouTube (automatic)

Every night, after the festival and photo steps, the Website workflow runs
`scripts/youtube-clips.ts`. It searches YouTube for live sets and adds them
to Discover as one-minute clips, a third of the way into each set (past the
intro). The feed keeps growing: each artist can have up to **4 different
sets**.

- **Who it searches for, in order**: first artists on upcoming festivals
  with no clip yet (festivals you added by hand first, soonest first, in
  billing order). Then artists with fewer than 4 clips, fewest first (those
  on upcoming festivals before the rest).
- **One search, up to two sets**: a search lists 15 videos, and the step
  keeps up to 2 good ones from it. Each must be a different set from the
  ones the artist already has: never the same video twice, and never two
  videos whose titles say the same set ("Live at Lost Lands 2025" and
  "Full Set | Lost Lands 2025"). A set from a year the artist has no clip
  from yet goes a step ahead. Once an artist has clips the search words
  change ("live set", then "full set", then "festival set"), so each search
  turns up different videos.
- **Waiting**: an artist with no set found is tried again after a month; an
  artist searched for more sets with nothing new found waits three weeks.
- **File size**: every clip makes the website's catalogue file bigger, and
  the app refuses a file over 2,000,000 characters. Extra sets stop once the
  file would pass 85% of that (the step's log says so); an artist's first
  clip, and the clips found on earlier nights, may fill it to 95%. When the
  file is short of room, extra sets from earlier nights are left out before
  anyone's first clip.
- **Shorts (upright crowd clips)**: so Discover also has phone-filmed,
  full-screen clips like real posts, 20 of the night's 90 searches (more
  when the long sets need fewer) look for "<artist> live #shorts" among
  short videos. A Short is kept only if it was filmed upright, runs 15
  seconds to 3 minutes, its title names the artist and says it's live
  footage (live, set, festival, drop, crowd, stage…), and it isn't an
  interview, tutorial, reaction, remix, edit, lyric video or the like. Each
  artist can have up to 2 Shorts on top of their 4 sets (so Shorts never
  push the long sets out), artists on upcoming festivals first, fewest
  Shorts first; an artist with nothing new waits three weeks. A Short plays
  whole from its start in the tall player and loops like any clip. In
  Discover they're mixed in about one in every four cards, never two in a
  row and never the same artist twice in a row. Expect up to about 40 new
  Shorts a night (often fewer: many crowd videos don't name the artist).
- **What the log says**: at the end of the **YouTube clips** step, how many
  clips there are in all (and how many are Shorts), how many are new
  tonight (first clips, more sets and Shorts, with the searches each took),
  and, for artists on upcoming lineups, how many have no live set yet and
  how many have fewer than 4.

- **Any channel** (the owner's choice), but the video must name the artist,
  look like a set ("live", "set", "full set", festival words), run at least
  10 minutes, be public and allow playing inside other apps. Reactions,
  interviews, trailers, aftermovies, music videos and lyric videos are left
  out. The artist's own channel and well-known festival and live-set channels
  (Insomniac, Tomorrowland, Lost Lands, Boiler Room, Cercle and others) come
  first.
- YouTube's free daily allowance covers about 90 searches a night (a search
  costs 100 of the 10,000 daily units; reading the videos' details costs 1),
  so Discover gains roughly 50 to 110 live sets (70 searches) and up to 40 Shorts (20 searches) a night until every artist has 4
  sets or nothing new turns up. Clips found before are kept. Only the nightly run (and
  "Run workflow") searches: runs after a merge just keep the clips, so they
  don't use up the day's allowance.
- Each video is used once. If the clips step fails anyway, it runs again
  without searching; if that fails too, the run stops before the deploy, so
  the live site keeps its clips.

### Getting lost clips back

Clips are carried from one release of the website to the next. If a release
ever goes out without them (as on 5 October 2026), get them back from an
earlier one:

1. Open the [Firebase console](https://console.firebase.google.com), pick
   **afterglowmusic**, then **Hosting** in the left menu, and scroll to
   **Release history**.
2. Find the last release from before the clips went missing. Its
   **Version** column shows an id (letters and numbers, e.g.
   `aaeb73690b23c50f`). Copy it.
3. On GitHub, open **Actions → Website → Run workflow**, paste the id into
   "Only to get lost Discover clips back", and press **Run workflow**.
4. When it finishes, the **Clips from an earlier release** step says how many
   clips it found, and **YouTube clips** says how many the site now has.
   The earlier release's clips top each artist up to 4 sets; videos already
   used aren't added twice.
- The clip's credit line in Discover names the YouTube channel. Clips you add
  yourself in `catalogue/afterglow.json` always stay and count towards the
  artist's 4.
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


**Upright videos.** Each night the job also asks YouTube for every clip's player size (50 videos per unit of quota) and marks videos uploaded upright (`"vertical": true`), so Discover gives them the tall, full-height player instead of a wide box with black sides. A video filmed with black bars burned into a wide frame still reads as wide: YouTube's player mustn't be cropped, so those keep the wide player (report them with ••• if they look bad).

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


## Set times from official pages (automatic)

Every night, before the website is built, Afterglow reads the official page
of every upcoming festival that has one (`website`, set in the catalogue or
from **HQ → Data → Official page**) and no set times yet
(`scripts/set-times.ts`, logic in `src/features/admin/pageSetTimes.ts`). It reads
the page's text with the same reader HQ uses for pasted set times (day
headings, stage headings, "10:00 PM – 11:30 PM SUBTRONICS", table rows) and
matches every name to an artist already on Afterglow. Nobody is invented.

The user chose on 2026-10-06 that set times **publish by themselves** when
the reading is clearly right:

- at least 8 set times,
- at least 60% of the acts with set times are on Afterglow (the rest are left out and listed),
- at least 40% of the festival's lineup has a set time,
- no day the festival doesn't have, a stage for nearly every set, and AM/PM written on most times.

They go into the published `catalogue.json` as a `"lineups"` entry marked
`"source": "page"` and are live with that night's deploy. Set times entered
by hand (in the catalogue file or from HQ) always win, and the page only
adds acts to a lineup, never removes any. A page that can't be read one
night keeps what was published the night before.

The nightly "Festival news" issue (an email) lists what went live
("Set times published") and what was found but not clear enough ("Set times
found but not published", with the reasons), so you can bring those in from
HQ → Data. If something published is wrong, enter the right set times in HQ:
they replace the page's.

Pages that only show set times as a picture (a poster) or build them with
scripts can't be read this way; for those, use HQ → Data → read a photo.

## Set times from Clashfinder (automatic, waiting on permission)

Clashfinder (clashfinder.com) has fan-made timetables for most festivals,
usually up within hours of the official set times, including Insomniac's,
whose own set times are only a picture. The user chose it on 2026-10-29
("do whatever you need to do") after the official-page reader could only
reach 1 of 53 festivals.

Every night, right after the official pages, `scripts/clashfinder-set-times.ts`
(logic in `src/features/admin/clashfinder.ts`) takes every festival starting
in the next 21 days that still has no set times, finds its clashfinder (same
name, starting within a day; Clashfinder's own pick first, then the fullest),
reads it (late-night sets stay on their night, names match artists already on
Afterglow, "(DJ Set)" notes ignored) and runs the same checks as the official
pages. Tested against EDC Colombia 2026: 126 of 132 acts matched, 115 set
times identical to the hand-entered ones.

- **Account**: the GitHub secrets `CLASHFINDER_USERNAME` and
  `CLASHFINDER_PRIVATE_KEY` (the user's Clashfinder account, added
  2026-10-29). Without them the step does nothing.
- **Permission**: Clashfinder's data is CC BY-NC 3.0 ("free for
  non-commercial use, contact halvin@clashfinder.com for other uses").
  Until they say yes, `CLASHFINDER_PUBLISH` in the script is `false`: nothing
  is published, and the nightly "Festival news" issue lists what would be.
  Once they agree, set it to `true` (and add the credit they ask for).
- **Limits**: at most 8 timetables a night, 31 s apart (Clashfinder allows 10
  requests per 5 minutes from March 2027).
- Published lineups are marked `"from": "clashfinder"` (the app ignores the
  marker) and `"source": "page"`, so they only ever add, and set times
  entered by hand always win. A night Clashfinder can't be reached keeps last
  night's.

## Festival news by email (page watch)

Every night, after the website is built, Afterglow looks at the official
page of every upcoming festival that has one, and compares it with the night
before (`scripts/page-watch.ts`, logic in `src/data/import/pageWatch.ts`).
When something is new, it opens a GitHub issue titled "Festival news" and
GitHub emails it to you. It lists, per festival:

- new names on the page that Afterglow knows but that aren't on the lineup
  yet (a lineup drop or an addition),
- "Set times may be out" when the page starts talking about set times and
  lists times,
- a new share picture (often a new lineup poster), with its link.

Nothing is taken from the pages: you bring the news in from **Afterglow HQ →
Data** (paste the lineup or set times, or read a photo of them), then close
the issue.

To watch a festival, give it its official page: **HQ → Data**, pick the
festival, paste its page into **Official page** (the lineup or set-times
page is best, starting with https://), tap **Watch this page**, then
**Publish to everyone**. The link also shows on the festival's page. The
first night only takes a first look; news is reported from the second night
on. Pages that build their lineup with scripts or only show it as a picture
can only be noticed through their share picture.

If no emails arrive: GitHub → your profile picture → Settings →
Notifications, and check that "Issues" emails are on for repositories you
own. Tonight's look is published as `/page-watch.json` on the website.
