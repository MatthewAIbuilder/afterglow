# Levity at The Criterion · Fri Oct 9 2026

Promo pieces for Levity's show at The Criterion, Oklahoma City. Every QR code opens
https://afterglowmusic.app/artist/levity?film=1 : Levity's page with **Film the set** at the top.
On the night itself the card shows for everyone (it says "TONIGHT · THE CRITERION" once the show is in the nightly feed).

Words only, by choice: no Levity logo, photos or creature, and every piece except the sticker says Afterglow isn't affiliated with Levity or The Criterion.

| File | What it's for |
| --- | --- |
| `sticker-3in.pdf` / `.png` | One 3 × 3 inch sticker, for a sticker printer (Sticker Mule, StickerApp: upload the PDF, choose die cut or rounded square) |
| `sticker-sheet-letter.pdf` | Six stickers on a Letter page, to print at home on sticker paper and cut along the dashed lines |
| `flyer-4x6in.pdf` / `.png` | A 4 × 6 inch card or flyer (prints at any photo counter as a 4 × 6 print) |
| `story-1080x1920.png` | Instagram story (the words stay clear of Instagram's own buttons) |
| `post-1080x1350.png` | Instagram feed post |

## What someone sees when they scan

1. Their phone's camera opens Levity's page on the website (no app needed).
2. **Post a video** → choose a video from Photos (or take one) → trim to the best minute → Levity is already picked → **Share**. They make an account the first time.
3. It shows on Levity's page and in Discover, for every Levity fan.

## Caption for the post or story

> Seeing Levity at The Criterion tonight? Film a minute of the set and post it on Afterglow, every angle of the night in one place. Scan the code or go to afterglowmusic.app/artist/levity 🎥

## Before handing them out

- Ask The Criterion whether handing out stickers or flyers is OK (many venues have rules).
- Scan a test print with an iPhone camera first.

## Another show

Copy `kit.json` to a new folder, change the artist, venue, city, day, date and `out`, then run
`node scripts/promo-kit.mjs docs/promo/<folder>/kit.json` (needs Chromium; in cloud sessions set `CHROMIUM_PATH` to `/opt/pw-browsers/chromium-*/chrome-linux/chrome`).
