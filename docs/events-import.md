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
