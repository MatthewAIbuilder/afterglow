# Stickers and hunts

Collectibles people get by scanning a code: hand out stickers at a festival (the Ferris wheel line, the water station), or put a code on a poster. Every copy of a sticker has the same code, so a photo of one works too. That's on purpose: it brings people to the app.

## Making stickers (Afterglow HQ)

1. Sign in with the support account and open **Stickers** in HQ.
2. Optional: make a **hunt** first, e.g. "Night Market 2027". A hunt is a set to collect ("find all 6"). Give it an end date if it should stop after the weekend.
3. Make a **sticker**: give it a name ("Ferris wheel · Night Market"), pick a creature, choose its hunt (or "No hunt"), and optionally an end date (year-month-day, like 2027-06-14; it can be found until that day is over everywhere in the world, so it never stops early wherever the festival is).
4. Each sticker row shows how many people found it, with **Print**, **Link** (share its link) and **Take down** (its code stops working; people who found it keep it, a scan made just before that was still waiting for signal still counts, and its hunt can still be finished without it).

The creatures are the festival places (Ferris wheel, Rail rider, Sunrise, Camp lantern, Confetti popper, Water frog, Mirror ball, Totem, Tent, Glow stick, Glow shroom, Bass bin, Campfire, Main stage, Bubble, Mixtape, the Portal potty, Refill, Charger, Fan, Silent disco, Shuttle, Hammock, Food truck, Care tent, Lost and found and Pick-up point) and the sound creatures.

**Quickest: the festival places kit.** Under New hunt, type the hunt's name (and end date), then press **Make the festival places kit**: it makes the hunt and one sticker for each spot people pass (the Portal potty, Refill, Charger, Care tent, Food truck, Lost and found, Pick-up point, Silent disco, Shuttle, Hammock, Main stage, Campfire and Tent), ready for Print all. Printed ones say what to do there ("Scan to open the portal", "Scan while you fill up"…), and some say a word of their own when found (the Refill: "fill your bottle and have a drink"). To show them on a tablet at the festival, see `docs/totem.md`. Artists' hand-made creatures aren't offered: a physical sticker with an artist's name or creature needs their (or the festival's) permission first.

## Printing

Printing works from the **website** on a computer (https://afterglowmusic.app/admin):

1. In HQ, tap **Print** on a sticker (four copies on a page) or **Print all** on a hunt (one of each).
2. Tap **Print**. In the print window, choose **Save as PDF** to send to a sticker printer, or print a test sheet at home.
3. Each sticker is 3 × 3.75 inches: the creature, its name and its code on a white square.
4. Scan your test print with your iPhone's camera before ordering lots.

## What people see

- Scanning with a phone's camera opens the website (or the app's scanner opens it in the app). The creature appears as a grey figure, then lights up once Afterglow confirms it, with confetti.
- With no signal it's saved on the phone and checked as soon as there's signal.
- Signed out, it's kept on that phone or browser; making an account keeps it everywhere (signing in on a new phone brings your stickers back).
- It shows in **Profile → Your garden → Stickers you've found**, with each hunt's progress.
- Tapping a hunt (in the garden, or "See the hunt" on a sticker's page) opens the hunt: every sticker in it, found ones in colour, the rest as grey "Still out there" figures. Once all are found it turns gold ("Hunt complete") and becomes a card to share as a picture (or as text on the website). That card is the thing people post, so it's worth giving hunts and stickers good names.
- After a sticker's end date, scanning it says it can't be found any more. A scan from before the end date still counts if it's sent up to 3 days later.

## Before handing them out

- Many festivals have rules about handing things out on site: ask the organiser.
- Deploy the database rules once after this update: `firebase deploy --only firestore,storage`.

## Running a hunt at an event (a checklist)

1. **Pick the places.** 4 to 6 spots people pass anyway (the Ferris wheel queue, the water station, the camp gate, a rail at a stage). Fewer is better for a first hunt: people finish it, and the finished card is what gets shared.
2. **Make it in HQ.** One hunt named after the event ("Night Market 2027"), then one sticker per place, each with the place's creature and a name people will smile at ("Ferris wheel · Night Market"). Give them the event's last day as their end date.
3. **Print and test.** Print all from the hunt, scan every test sticker with an iPhone camera and with the app (Friends → Scan), and open the hunt in your garden to check it fills in.
4. **Hand them out.** At each place, or all of them at once so people go and find the creatures on a map you make. Ask the organiser first.
5. **Afterwards.** HQ shows how many people found each sticker. Take a sticker down if its code gets passed around: people who found it keep it, and the hunt can still be finished without it.
