# Stickers and hunts

Collectibles people get by scanning a code: hand out stickers at a festival (the Ferris wheel line, the water station), or put a code on a poster. Every copy of a sticker has the same code, so a photo of one works too. That's on purpose: it brings people to the app.

## Making stickers (Afterglow HQ)

1. Sign in with the support account and open **Stickers** in HQ.
2. Optional: make a **hunt** first, e.g. "Night Market 2027". A hunt is a set to collect ("find all 6"). Give it an end date if it should stop after the weekend.
3. Make a **sticker**: give it a name ("Ferris wheel · Night Market"), pick a creature, choose its hunt (or "No hunt"), and optionally an end date (year-month-day, like 2027-06-14; it can be found until the end of that day).
4. Each sticker row shows how many people found it, with **Print**, **Link** (share its link) and **Take down** (its code stops working; people who found it keep it).

The creatures are the six festival places (Ferris wheel, Rail rider, Sunrise, Camp lantern, Confetti popper, Water frog) and the sound creatures. Artists' hand-made creatures aren't offered: a physical sticker with an artist's name or creature needs their (or the festival's) permission first.

## Printing

Printing works from the **website** on a computer (https://afterglowmusic.app/admin):

1. In HQ, tap **Print** on a sticker (four copies on a page) or **Print all** on a hunt (one of each).
2. Tap **Print**. In the print window, choose **Save as PDF** to send to a sticker printer, or print a test sheet at home.
3. Each sticker is 3 × 3.75 inches: the creature, its name and its code on a white square.
4. Scan your test print with your iPhone's camera before ordering lots.

## What people see

- Scanning with a phone's camera opens the website (or the app's scanner opens it in the app). The creature appears as a grey figure, then lights up once Afterglow confirms it, with confetti.
- With no signal it's saved on the phone and checked as soon as there's signal.
- Signed out, it's kept on that phone or browser; making an account keeps it everywhere.
- It shows in **Profile → Your garden → Stickers you've found**, with each hunt's progress.
- After a sticker's end date, scanning it says it can't be found any more. A scan from before the end date still counts if it's sent up to 3 days later.

## Before handing them out

- Many festivals have rules about handing things out on site: ask the organiser.
- Deploy the database rules once after this update: `firebase deploy --only firestore,storage`.
