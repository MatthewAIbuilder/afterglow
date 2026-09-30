# Privacy Policy, Terms and Community Guidelines

The three pages live in the app (Profile → the links at the bottom, and the sign-up screen) and on the website:

- https://afterglowmusic.app/legal/privacy
- https://afterglowmusic.app/legal/terms
- https://afterglowmusic.app/legal/guidelines

Use the privacy link wherever a store or service asks for a "Privacy Policy URL" (App Store Connect, Google Play, Spotify's developer dashboard, Firebase).

The words are in `src/features/legal/documents.ts`, so the app and the website always match. Change `LEGAL_UPDATED` whenever they change.

## Before a public launch

These were written by Claude from what the app actually does. They are a solid, honest starting point, not legal advice. Before launching widely:

1. **Add a contact email.** Set `SUPPORT_EMAIL` in `src/config/app.ts` (Claude can do it: just give the address). It then appears on all three pages and on the sign-up screen.
2. **Add who runs Afterglow.** Your name or company and where you're based. Terms usually also say which law applies and where disputes are handled. These are left out because they depend on you.
3. **Have someone qualified read them**, especially if you'll have users in the EU or UK (GDPR), California (CCPA), or anyone under 18.

## Where each privacy claim comes from

| Claim | In the code |
|---|---|
| Taste, ratings, going, stars, seen clips, recent searches stay on the device | AsyncStorage keys (`reactions`, `artistRatings.v1`, `going.v1`, `mustSees.v2`, `seen`, `recentSearches.v1`); none are sent to Firebase |
| Memories stay on the phone until shared; only city/region kept | `features/memories/device.ts` (reverse-geocodes, drops coordinates), `state/memories.tsx` |
| Music library: token in secure storage, summary on the phone, nothing sent | `features/music/secrets.ts`, `state/music.tsx`, `features/music/privacy.ts` |
| No push notifications | `expo-notifications` local scheduling only (`ReminderSync`) |
| Account data in Firebase: email, profile, shared videos, follows, likes, crews and crew picks, blocks, reports | `features/social/firebase/service.ts`, `firestore.rules` |
| Festivals and sounds on a profile only when switched on | `saveProfile` publishes them only with `showFestivals` / `showSound` |
| US data location | Firestore `nam5`, Storage `us-east1` (set up 2026-09-30) |
| No ads, analytics or trackers | No analytics SDK is installed (the Firebase `measurementId` isn't used) |
| Account deletion removes profile, handle, shared videos, follows, likes and crew memberships | `deleteAccount` in the Firebase adapter |
| Blocked people can't follow you, like your videos or join a crew you started | `firestore.rules` (follows, likes, crews) |
