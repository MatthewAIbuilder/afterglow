# Crew planning: your own plan, voting, splitting up and meeting up

The user, 2026-10-29: "you should be able to also custom create [your] list and change it… a mode in group chats where… everyone can vote to decide who they're gonna see at what time… if the group is splitting up… the app [could] auto suggest a meet up spot at a certain time… set up times so we get notified when we're supposed to meet up… we're not taking full advantage of the friend mode / crew mode / group chat vibe."

The plan builds on what exists rather than replacing it:
- **Your plan.** `features/plan` ranks the lineup and builds the full-day route. Stars are kept in `state/plan.tsx` (`mustSees.v2`), and "Also on ★" switches the route.
- **Crews.** Crews (`features/crews`) already have chat, check-ins and "Where's the crew".
- **Meeting spot.** Each crew has one meeting spot, `crews/{id}/meta/meet`, a text field.
- **Crew stars in your plan.** `withFriends.ts` provides `meetUps` and `elsewhereDuring`.
- **Crew route.** "Our route" (`crewRoute.ts`) already lists splits (who heads off, when it ends: `backAt`).

The parts are in order. Part 1 ships before EDC Orlando (freeze Nov 3). Parts 2 to 5 come after EDC, using what EDC teaches us, with set times that are real.

## Part 1: Make the plan yours (before EDC, on the phone only)

All of this is planning state: kept on the phone, per festival, never fed to the taste engine. The store is `planEdits.v1` in `state/plan.tsx`; the pure logic is in `features/plan/edits.ts`.

- **Not this one.** Takes an act out of your plan for this festival only. It leaves the plan and the route, and its star goes too. Their match and your taste stay as they are. A "Taken out (N)" row at the end of Your festival brings acts back.
- **Go with this one.** On a route stop that has "Also on", or a clash between two of your stars, you choose the set you're seeing. It becomes your *first choice*: starred, and worth more than any other star in the route, so it wins every clash it's in. Choosing it drops first choice from the sets it clashed with.
- **Only my picks.** A switch on Your festival, "Suggested" / "Only mine". With Only mine, your plan and route hold just what you starred. Breaks fill the rest, and nothing gets suggested.
- **Add anything.** Starring any act on the lineup already puts them in your plan. The Lineup tab and the artist page carry the star.
- Everything that reads your plan follows these edits:
  - the route and Your picks;
  - Tonight and festival mode;
  - set reminders;
  - the plan card you share;
  - LiveNow;
  - check-in guesses.

## Part 2: Vote on the lineup with your crew (after EDC)

A **"Vote on the lineup"** page per crew, reached from the crew page and from a card in crew chat. It's the shared version of your picks, designed as a page of its own, not a list.

- **Before set times: the lineup round.**
  - One act at a time, as a big glass card with the artist's photo, their sound colours and a play button for a live clip.
  - Three answers: **Must see**, **Maybe**, **Skip**.
  - Crewmates' faces gather on each act as they vote.
  - A results view ranks the lineup by the crew's total (Must see 2, Maybe 1, Skip 0), with "Everyone's in" acts glowing.
- **After set times: the clash round.**
  - For every time slot where the crew's top acts overlap, everyone picks a side.
  - Results read "3 of 4: John Summit over Odd Mob". A tie says it's a split, and Part 3 handles it.
- **What happens with the result.**
  - The crew's winners feed "Our route": a winning act counts like a star from everyone.
  - Your own plan is never changed by a vote. It shows "Your crew chose X" beside the clash, with "Go with the crew".
- **Crew chat.**
  - "Maya voted on 12 acts" (grouped, at most one line per person per hour).
  - "Voting closes Thursday" when the organiser sets a deadline.
  - "The crew picked…" once the round is done.
- **Server.**
  - Data:
    - `crews/{id}/votes/{uid}` = { lineup: {artistId: 0|1|2}, clashes: {slotKey: artistId}, at };
    - members can read;
    - you can write only your own;
    - it's deleted when you leave the crew, and with the crew.
  - Rules tested in the emulator, as always.
  - Counting happens on the phone (pure `features/crews/votes.ts`), so there's nothing to run on a server.
- **Visual.** Night-sky backdrop, the crew's faces as a ring around each act, a soft fill rising as votes come in, and haptics on each vote. Reduced motion turns the motion off.

## Part 3: Splitting up and meeting up again (after EDC)

When the crew's plan (Part 2) or everyone's own plans send people to different sets at the same time:

- **Splits, said plainly.** "Maya and Sam: Odd Mob (Stage 2). You, Jo and Lee: John Summit (Main). Both end 1:30 AM." This comes from `crewRoute` splits plus each member's own route.
- **Suggested meetup.** The app suggests where and when to meet again:
  - **Where:** at the stage of the next set the whole crew shares, or the crew's meeting spot when there's none.
  - **When:** the later of the two set ends plus the walk (`WALK_MINUTES`), e.g. "Meet at the Main Stage sign, 1:40 AM, before Subtronics".
  - Without a venue map the app can't see distances, so it suggests stages and the crew's own spot. It never guesses a place that isn't real.
- **One tap: "Make it our meetup"** turns the suggestion into a crew meetup (Part 4).

## Part 4: Meetups with times and reminders (after EDC)

- **Crew meetups.**
  - Anyone in the crew can set one: place (a stage, the meeting spot, or their own words, e.g. "the big flag by the ferris wheel"), time and a note.
  - Data: `crews/{id}/meetups/{meetupId}` = { place, at, note?, by, createdAt }.
  - Several per day; everyone sees the day's meetups in time order on the crew page and the Friends tab in festival mode.
- **Reminders on every member's phone.**
  - Local notifications: "Meet the crew at Main Stage in 15 min" and "Time to meet the crew".
  - They're scheduled on each phone when the meetup arrives. Set reminders already work this way (`ReminderSync`), so they still fire with no signal.
  - Changing or cancelling a meetup reschedules them.
- **"I'm on my way" / "I'm here"** on a meetup, through the existing check-in outbox (works with no signal, keeps the time it happened).
- **Repeating spots.** "Every night at 2 AM at the meeting spot" for a festival weekend.
- Recurring and suggested meetups land in crew chat as cards.

## Part 5: More crew vibe (ideas to choose from after EDC)

- **Crew countdown and pre-game.**
  - A shared countdown on the crew page.
  - A crew warm-up playlist from everyone's top acts (the solo warm-up exists).
  - "Who's ready": each member's Get ready progress.
- **Venue map with stage pins.**
  - The user or an organizer drops stage pins on a festival's official map picture (HQ upload).
  - Real walking times, and meetups placed on the map.
  - Not before an official map image the user has rights to.
- **Live crew pulse.** A strip of faces at the top of crew chat showing each person's latest check-in stage and how long ago. "Where's the crew" exists; this makes it ambient.
- **Set reactions in chat.** During a set you're at with your crew, quick reactions ("🔥 this drop") grouped under that set.
- **Crew recap.** After the festival: the sets you saw together, splits and reunions, the crew's top act, and photos from the crew's memories. It builds on the recap planned in `docs/after-edc-plan.md`.
- **Crew badges.** "Moved as one" (no splits all weekend), "Found each other" (met at every meetup), "Crew of 5+".
- **Camp and travel.** Shared lists (who's bringing what), ride or flight times, the hotel. A simple checklist per crew.

## Order and size

| Part | When | Size | Server change |
|---|---|---|---|
| 1. Make the plan yours | Before EDC | Small, phone only | None |
| 2. Crew voting | After EDC, first | Large (new page) | `votes` collection and rules |
| 3. Splits and suggested meetups | After EDC, with 2 | Medium (pure logic) | None |
| 4. Meetups with reminders | After EDC, with 3 | Medium | `meetups` collection and rules |
| 5. Crew vibe extras | Pick after EDC | Varies | Some |
