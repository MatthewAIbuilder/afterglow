# Event organizers (the organizer studio)

An event organizer gets their own page on Afterglow and an **organizer
studio** to run it. The first one is **Underground Alchemy** (after parties,
https://undergroundalchemy.net, Instagram @underground.alchemy).

What an organizer can do in the studio:

- **Overview**: how many times people opened their page and their events,
  tapped "Get tickets", saw a promoted event, and found their stickers and
  gifts; per event, how many people show they're going, how many videos were
  filmed there and how many badges that made. Counts only, never who.
- **Events**: add events (name, night, doors, venue, city, a few words,
  tickets link, flyer link, and the festival it's the after party of) with a
  lineup and optional set times. Drafts stay in the studio; **Publish** puts
  the event on Afterglow like a festival (its own page, plans, crowd videos,
  its badge). Linking it to a festival shows it under "After parties" on that
  festival's page.
- **Artists**: everyone on their lineups. A bio and Instagram for each show on
  the artist's page, credited to the organizer. For artists new to Afterglow
  they also give the photo, SoundCloud and sound; for artists Afterglow already
  has, Afterglow's photo and links stay.
- **Promote**: ask Afterglow to promote an event for 3, 7, 14 or 30 days. Once
  HQ approves, it shows at the top of everyone's Festivals tab, always
  labelled **Promoted**. It never changes anyone's recommendations.
- **Collectibles**: their badge (with their logo: the triangle of three rings)
  and each event's badge, their creature (**The Alchemist**, a bubbling potion),
  **Gifts** (a collectible sent as a link, with a few words: anyone who opens it
  collects it), **Stickers and QR codes** (stickers and hunts to print and hide
  at events, like HQ's), and **Request a design** (a badge, sticker, creature,
  gift or flyer; HQ replies).
- **Page**: their name, line, words, website and Instagram.

Everyone else sees the organizer's page (`/org/underground-alchemy`): the
logo, their words and links, what's coming up, and what you can collect.

## The test login

While Stefan's own account isn't ready, the organizer signs in with a test
login: **afterglowmusic.support+alchemy@gmail.com**. That's a "+" address on
the support Gmail: Gmail delivers it to the support inbox, so the
confirmation email arrives there. Nothing about it is special in the code;
HQ decides which emails may run which organizer, and can change it any time
without an app update.

## Try it (step by step)

1. **Rules first.** The organizer pages need the new database rules and
   indexes. If they don't deploy by themselves when this is merged, run
   `firebase deploy --only firestore` (see `firebase-setup.md`).
2. **Set it up in HQ.** Sign in as the support account, open **Organizers**
   and tap **Set up Underground Alchemy**. That makes its page and lets the
   test login in.
3. **Make the test account.** Sign out of the support account (HQ → Sign
   out), then Profile → **Create your profile** → create an account with
   `afterglowmusic.support+alchemy@gmail.com` and a password you'll remember.
   You don't need to finish a profile to use the studio. Afterwards, Switch
   account (hold the Profile tab) → Save this account, so you can hop between
   the support account and the organizer.
4. **Confirm the email.** Settings → **Organizer studio** → **Send the email**.
   Open the support Gmail, tap the link in the email from Firebase, then go back
   and tap **I've confirmed it**. The studio opens.
5. **Add an event.** Events → Add an event → fill it in, add a few artists
   (pick the ones Afterglow suggests when they come up) → **Publish**. Open
   Festivals: it's there, and its page says "Hosted by Underground Alchemy".
6. **Ask for a promotion.** Promote → choose the event and days → Send request.
   Then switch to the support account → HQ → Organizers → **Approve**. The
   event shows at the top of the Festivals tab, labelled Promoted.
7. **Send a gift.** Collectibles → Gifts → name it, add a few words → **Make
   the gift and share its link**. Open the link on another account: it says
   "A gift from Underground Alchemy" and The Alchemist joins your collection.
8. **Print stickers.** Collectibles → Stickers and QR codes. Print from the
   website on a computer (like HQ's stickers, see `stickers.md`).

HQ can also open any organizer's studio from Organizers → **Open its studio**,
to set things up for them.

## Handing over to Stefan

1. Stefan installs Afterglow and creates an account with
   **stefan@undergroundalchemy.net**, then confirms it from his email.
2. In HQ → Organizers → Underground Alchemy: type his email in **Add an
   email** and tap **Add email**.
3. Remove the test login (**Remove** next to it).
4. Optional: HQ → Accounts → find him → give the **Partner** flair, so his
   profile has the partner ring.

Everything he made while testing stays. Delete test events in the studio
before handing over (Events → the event → Delete event).

## Adding another organizer

Add a starter to `src/config/organizers.ts` (id, name, line, website,
Instagram, test login), then use **Set up** in HQ. A drawn logo needs a
design (like `AlchemyMark` in `src/features/organizers/OrgMark.tsx` and the
`alchemy` badge scene); without one the page shows their initials, or a logo
picture link.
