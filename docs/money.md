# Making money without a paywall

Everything in Afterglow stays free. Afterglow earns a small commission when
someone buys something they were going to buy anyway, through a partner link:
tickets, a place to stay, things to pack.

## What's already built (and hidden until you add links)

None of this shows in the app until a real link is added. Once one is, it
works fully. There are no placeholders and no "coming soon" text.

| Where | What appears | What turns it on |
| --- | --- | --- |
| Festival page, Info tab | "Places to stay ↗" beside Get tickets / Official site | a `stay` link on that festival in `catalogue/afterglow.json` |
| Get ready → Before you go | "Places to stay nearby ↗" under "Sort travel" | the same `stay` link |
| Festival page and Get ready | the note "Afterglow may earn a commission… It doesn’t change your price." | a `stay` link, or `"ticketsPartner": true` beside `tickets` |
| Get ready → Pack | "Shop ↗" under an item, then Amazon's required sentence ("As an Amazon Associate, Afterglow earns from qualifying purchases.") or a general note | a link for that item in `src/config/partners.ts` (`SHOP_LINKS`) |
| Terms of Use and Privacy Policy | a paragraph about partner links | any partner link at all |

Partner links open in the phone's browser (or the seller's app). Afterglow
sends nothing about the person and adds no trackers, so the App Store privacy
answers don't change.

Look after yourself never gets partner links.

## What to send Claude

Paste any of these into a session. Claude adds them and checks them:

- **Places to stay:** `Cyclops Cove 4 stay link: https://…`
- **Partner tickets:** `EDC Orlando partner ticket link (official seller): https://…`
- **Packing list:** `Shop links: power bank https://…, earplugs https://…, water bottle https://…, sunscreen https://…, rain poncho https://…`
  (The items are: photo ID, power bank, earplugs, water bottle, sun, rain, meeting spot. Photo ID and meeting spot shouldn't get links.)

## How to get each one

### 1. Before any program: the basics (about 30 minutes)

1. Decide whose name payouts go to. For a start, your own name as a sole proprietor is fine. Every program asks for a US tax form (W‑9), which takes your Social Security number or, if you'd rather not share it, a free EIN.
2. Optional: get an EIN at irs.gov (search "Apply for an EIN online"). It's free and takes about 10 minutes.
3. Have a bank account or PayPal ready for payouts.
4. Every program asks for your website: use **https://afterglowmusic.app**. Describe Afterglow as "a free app for planning music festivals: lineups, set times, and a personal festival schedule."

### 2. Places to stay: Stay22 (best fit, start here)

Stay22 builds a link that shows hotels and rentals around an address for set dates, and pays a commission on bookings. It's free and made for event sites.

1. Go to **stay22.com** and sign up as a partner (creator / publisher).
2. Fill in the payout and tax details.
3. In the dashboard, find the link or map maker (Stay22 calls its links "Allez" links). Enter:
   - the venue's address (for example "Sunset Cove Amphitheater, Boca Raton, FL"),
   - check-in the day before the festival starts, check-out the day after it ends.
4. Open the link on your phone to check it shows places near the venue on the right dates.
5. Send Claude one link per festival.

Booking.com and Expedia have partner programs too, but they're harder to join for a new app. Stay22 already shows their listings.

### 3. Packing list: Amazon Associates

1. Go to **affiliate-program.amazon.com** and sign up with your normal Amazon account.
2. Add https://afterglowmusic.app as your website. Add the app's App Store link once it's live.
3. **Timing matters:** Amazon closes accounts that don't make 3 sales within 180 days. Apply close to launch, not months before.
4. Once you're in, open amazon.com while signed in. A grey "SiteStripe" bar sits at the top of every product page. Find a good product (a power bank, high-fidelity earplugs, a collapsible water bottle, a festival-safe sunscreen, a poncho), click **Get link**, and copy it.
5. Send Claude the links. Don't send prices: Amazon doesn't allow showing prices copied from its site, and Afterglow doesn't show them.

Better rates elsewhere: festival brands like earplug and hydration pack makers often pay 10 to 15% through networks like Impact, ShareASale or Awin (look for "affiliate" or "partners" at the bottom of their websites). Their links work the same way, and the app shows the general note instead of Amazon's.

### 4. Tickets

Only the festival's official seller, ever. Afterglow never links to resale sites as "Get tickets".

- **Promoter referral links (best).** Festivals that sell through Front Gate, Tixr, See Tickets or AXS often give out tracked links or codes ("ambassador", "street team", "affiliate"). Once Afterglow has users, email the promoter. A template:

  > Hi, I make Afterglow (https://afterglowmusic.app), a free festival planning app. [N] people have [festival] in their plans, and the festival page has a "Get tickets" button that sends them to your official ticket page. Do you have an affiliate or ambassador link I could use for that button? Happy to share how many people tap it.

- **Ticketmaster** runs a partner program through **impact.com**. Sign up at impact.com as a publisher, search for Ticketmaster and apply. Once you're approved, make a link to the festival's Ticketmaster page.
- Send Claude: the festival, the link, and that it's a partner link.

### 5. Later: Afterglow Plus (optional extras, not built yet)

Afterglow Plus already exists as a switch you can flip by hand in Firebase (it removes the edge glow on your videos). Selling it needs:

1. The Apple Developer account (already on the plan for the development build).
2. In App Store Connect: sign the **Paid Apps agreement**, and add bank and tax details (Agreements, Tax, and Banking).
3. Then ask Claude to build the purchase with Apple's in-app purchase in the development build. Apple takes 15% under its Small Business Program, which you apply for in App Store Connect.

Don't sell anything people use today. Keep Plus to looks: no watermark, extra friend-code colours, profile ring styles, app icons, a supporter badge.

## What we're not doing

No ad networks (banners or videos). They'd earn very little at first, make
the app look cheap, need tracking disclosures on the App Store, and add a
native module.

## Rules to keep

- Every partner link has its notice next to it. The app does this automatically, and the Terms and Privacy Policy update themselves.
- Amazon's exact sentence must appear wherever Amazon links are. The app does this.
- Tickets: official sellers only. Stay and shop links: things that genuinely help at a festival.
