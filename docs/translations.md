# Languages

Afterglow speaks English and Spanish. It follows the phone's language (or the
browser's, on the website); Settings → Look → Language can pick one instead.
Changing it there restarts the app, like a new theme.

## How it works

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

## What's translated (2026-10-06, first step)

Tab bar, Settings, the welcome, the crash and not-found pages, back / close /
share buttons, the offline notice, festival dates, countdowns and set times.
Everything else is still English and is next, screen by screen: Discover,
Festivals and the festival page, My Sound, Profile and Friends, then the rest.
Not planned: catalogue data (artist and festival names, the user's own
lineup notes), people's own posts, the legal pages (they need a qualified
translation), and Afterglow HQ (only the support account sees it).

The phone's own permission pop-ups (camera, photos, location…) are in
Spanish in the development / App Store build (`locales/es.json`, `app.json`
`locales`); Expo Go always shows its own.
