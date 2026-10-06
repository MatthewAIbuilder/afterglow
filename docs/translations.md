# Languages

Afterglow speaks English and Spanish. It follows the phone's language (or the
browser's, on the website); Settings → Look → Language can pick one instead.
Changing it there restarts the app, like a new theme.

## How it works

**The website's nightly scripts** (`scripts/*.ts`, run with tsx in Node) use some of the app's plain logic, so `src/i18n/index.ts` must never import React Native, Expo or `./storedLanguage` at the top (it `require`s them inside a try; in Node everything is English). A test checks.

- `src/i18n/translate.ts`: the pure part (which language, filling `{slots}`, month and day names).
- `src/i18n/index.ts`: `t()` and `tn()`, worked out once as the app starts from the saved choice (`storedLanguage.ts`, a tiny file like the theme; browser storage on the website) and the phone's languages (`expo-localization`).
- `src/i18n/es.ts`: the Spanish list, keyed by the English line exactly as written in the code.

```ts
import { t, tn } from '../i18n';

<Text>{t('Settings')}</Text>
t('Every weekend of {festival}', { festival: f.name })
tn(count, '{n} new reply', '{n} new replies')   // both lines go in es.ts
```

A line with no Spanish entry shows in English, so a screen that hasn't been
translated yet still works. Dates: use `months()` / `weekdays()` from
`src/i18n`, and put word order in a translated line (`'{month} {day}'` is
`'{day} de {month}'` in Spanish). Times show on the 24-hour clock in Spanish
(`formatTime`). Festival dates come from `datesLine()` (the catalogue's
words in English, worked out from the start and end date otherwise).

## Adding a screen

1. Wrap each user-facing line in `t('…')` (pass names and numbers as `{slots}`, never glue sentences together from pieces).
2. Add each line to `src/i18n/es.ts`.
3. `npx jest --ci src/i18n`: it fails on any `t('…')` line missing from `es.ts`, and on any translation that drops a `{slot}`.

Tests always run in English (`test/setup.ts` mocks the phone's language), so
golden tests and screen tests don't change. `src/i18n/__tests__/spanish.test.ts`
runs the language code as a Spanish phone.

## What's translated

- 2026-10-06, first step: tab bar, Settings, the welcome, the crash and not-found pages, back / close / share buttons, the offline notice, festival dates, countdowns and set times.
- 2026-10-06, second step: Discover (the feed, its pages: focus, search, Tonight, tips, quest ring button, crew stories, flag and ••• menus, why notes), the Festivals tab (shelves, timeline, Up next, near you, calendar, map, compare, request), a festival's page (For you / Lineup / Videos / Info, the plan, full day, timetable, your hours, must-sees, poster and share text, Tune, the cards on it) and the plan's own wording (reasons, route labels, clashes, share text). Also artist rows and ratings, crew update times, friends-going lines.

The Spanish lists live by area in `src/i18n/es/` (discover, festivals, festivalPage, plan, sound, profile, profileLogic, friends, crews), spread into `src/i18n/es.ts`, which keeps shared lines.

- 2026-10-06, third step: My Sound (overview, list, map, spectrum, lenses, search, artist sheet, your sound, your artists, the rating scale), Profile (yours and other people's: header, passport, badges, milestones, highlights, year card, recap, edit profile, backgrounds, themes' descriptions), Friends (the tab, find people, friend codes, send to a friend, comments, likes, sign in / create account, switch account, report and block) and crews (crew page, chat, invites, check-ins, stories, meeting spots, where everyone is, care check-ins and help alerts, the crew route).

- 2026-10-06, fourth step: the artist page (follow, rating, why lines, listen links, next shows, set lines, crowd videos, story, collectibles, share text) and Memories and the camera (Memories page, a memory, tagging and the past picker, sharing to Discover, a shared video, the camera and its permission messages). Crowd clip titles the app makes ("From the crowd", "Throwback · …") stay English in storage and reports and are translated where shown (`shownClipTitle`, `community/clips.ts`).

- 2026-10-06, last step: quests and glow levels, secrets, What's new, notifications (inbox and phone notifications), sprouts and the garden, artist collectible looks, stickers and hunts, Look after yourself (see `docs/care-spanish-review.md` for the lines a qualified reviewer should check), festival week, Get ready, festival mode's Lineup tab, the plan card, send set times, who's going, the poster, request a festival, Your clips, Pick artists, This or that, music connections, support, share and save alerts, the legal pages' frame (the documents themselves say "only in English for now" in Spanish).

**The whole app is now in Spanish**, apart from what's deliberately English: catalogue data (artist, festival, stage and sound names, lineup notes, sticker and hunt names), people's own words, glow level and theme names, the legal documents (need a professional translation), Afterglow HQ, the organizer studio (`/studio`, for event organizers; their public page and cards are translated) and the sticker print sheet, text sent to support (flag reports, request and crash emails), Amazon's required associate statement, preset crew messages as sent (shown translated through `presetLabel`), link previews built for the website, and developer-only errors.

Helpers: `tc('time', 'Leave')` for one English word with two meanings (Spanish entry `'time|Leave'`, falling back to plain `'Leave'`); `presetLabel(text)` in `crews/updates.ts` for preset crew messages (check-ins, quick replies, care notes), which are sent in English and shown in each phone's own language (people's own words are never translated); `dayWord(day)` for a day name mid-sentence (lower case in Spanish), `breakLabel(label)` in `plan/hours.ts` for the stored break presets (saved in English, shown translated). Code that compared a shown line with English (`soon === 'Over'`) must compare with `t('Over')`.

The phone's own permission pop-ups (camera, photos, location…) are in
Spanish in the development / App Store build (`locales/es.json`, `app.json`
`locales`); Expo Go always shows its own.
