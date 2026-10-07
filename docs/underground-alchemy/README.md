# Underground Alchemy (Stefan): reference

Everything about Underground Alchemy's organizer account on Afterglow in one
place. How the organizer features work in general: `../organizers.md`.

## Who

- **Company**: Underground Alchemy, after-party events.
- **Contact**: Stefan, stefan@undergroundalchemy.net (his real login, once his
  account is ready).
- **Website**: https://undergroundalchemy.net
- **Instagram**: @underground.alchemy (https://www.instagram.com/underground.alchemy)
- **On EDMTrain**: his events are listed there too; Afterglow imports them each
  night, and he claims them in his studio (see below).

## On Afterglow

- **Organizer id**: `underground-alchemy` (`src/config/organizers.ts`).
- **His page**: https://afterglowmusic.app/org/underground-alchemy
- **Test login** (until his own account is ready):
  `afterglowmusic.support+alchemy@gmail.com`. That's a "+" address on the
  support Gmail, so its emails land in the support inbox.
- **An existing account can be linked instead**: HQ → Accounts → the person →
  Organizer → Underground Alchemy → Save privileges (no email to confirm).
  @ugrnd was set up this way for testing, with the Partner flair.
- **What he gets**: his account opens straight on the organizer studio
  (Overview numbers, Events, On EDMTrain, Artists, Promote, Collectibles,
  Messages, Page), with View the app to see the fan app, a "You run Underground
  Alchemy" card on his profile, "Hosted by Underground Alchemy" on his events,
  his logo on his events' badges, and "The Alchemist" (a potion flask) as his
  collectible creature for stickers and gifts.

## Handing over to Stefan

1. Stefan installs Afterglow and creates an account with
   stefan@undergroundalchemy.net, then confirms it from his email. Or, if he
   already has an account, link it in HQ → Accounts (see above).
2. If you made it by email: HQ → Organizers → Underground Alchemy → add his
   email, then remove the test login.
3. Optional: HQ → Accounts → him → Partner flair.
4. Delete any test events before he starts (Studio → Events → the event →
   Delete event), and unlink test accounts (HQ → Accounts → Organizer → None).

## His EDMTrain events

In the studio, Events → **On EDMTrain**: Afterglow suggests imported events
with his name or at his venues; he taps **This is ours** on each. To change
one, **Edit on Afterglow** copies it into the studio; once published his
version shows instead of EDMTrain's. EDMTrain's own listing is never changed,
and comes back if he unpublishes or deletes his copy.

## Logos

- **`logo-official.png` is the official logo** (the user sent it on
  2026-10-07: the flask with sparkles beside UNDERGROUND ALCHEMY, white on
  clear). The app shows it everywhere (`assets/organizers/underground-alchemy-logo.png`,
  with a square flask icon cut from it, `...-icon.png`; `src/features/organizers/brandAssets.ts`).
  His badges and the drawn fallback show the flask too. He can upload a new
  logo and icon himself: Studio → Page → Logo and icon (his uploads win; "Go
  back to the original" returns to this one).
- The two below came earlier and are kept only for reference.

- `logo-triangle.jpg`: the logo the user sent first (UNDERGROUND over an "A"
  made of three rings in a triangle, then LCHEMY). The app draws this mark
  itself (`AlchemyMark` and `OrgLogo` in `src/features/organizers/OrgMark.tsx`)
  and puts it on his badges (the `alchemy` scene in
  `src/features/badges/EnamelPin.tsx`).
- `logo-flask.svg`: his flask logo (a stoppered flask with a flame and
  liquid inside, next to UNDERGROUND ALCHEMY in an engraved serif),
  sent on 2026-10-06. This is a redrawing from the picture shared in
  chat, not his original file: ask Stefan for the original (SVG or a large
  PNG) before printing it anywhere. It isn't used in the app yet; it could
  become his mark on the page, badges and stickers if he prefers it.

Colours: off-white lettering (about `#EEEBE4`) on black. The app uses
`#E9E6F2` for his page.

## Notes

- His website and Instagram couldn't be read from the cloud sessions, so
  nothing about his events, lineups or bio was made up: he adds them himself.
- Promotions: he asks in the studio (Promote); HQ approves in HQ → Organizers.
  Promoted events are always labelled "Promoted" and never change anyone's
  recommendations.
