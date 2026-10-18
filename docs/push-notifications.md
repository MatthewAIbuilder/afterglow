# Push notifications

Afterglow has two kinds of notifications:

- **Reminders** (a festival a week and a day before, sets on your route, water,
  quests): scheduled on the phone itself (`features/notifications/ReminderSync.tsx`).
  They work everywhere, Expo Go included.
- **Pushes from other people** (since version 1.0.1): a crew's chat, check-ins
  ("come find me", "I'm OK", "can't find the crew", where someone is), videos and
  photos sent to the crew, the meeting spot, 1-to-1 messages, crew invites from
  friends, and support replies. These need the app's own build (TestFlight), not
  Expo Go.

## How it works (no server of our own)

The user chose "phone to phone" on 2026-10-18: the sender's phone hands the
notification to **Expo's push service**, which passes it to Apple (or Google).

1. `PushRegistration` (root layout) gets this phone's **Expo push token** once
   you're signed in and notifications are allowed. It asks for permission once,
   the first time you're in a crew or 1-to-1 chat, never before.
2. `registerPush` (SocialService) writes the token, with the phone's language,
   wherever people who may notify you can read it:
   - `crews/{id}/push/{uid}`: read by that crew's members,
   - `dms/{id}/push/{uid}`: read by the two people in that chat,
   - `pushTokens/{uid}`: read by friends both ways (crew invites) and the
     support account (support replies).
   Each record keeps up to five phones (`tokens`), `lang` and `at` (server time).
   It's written again when you join a crew or chat and once a day
   (`pushRegistered.v1` remembers the last time).
3. After a chat message, crew update, meeting spot, invite or support reply is
   written, the Firebase adapter reads the other people's records and posts to
   `https://exp.host/--/api/v2/push/send`, one message per language
   (`features/notifications/push.ts`: wording, Spanish, batches of 100). It never
   waits for this and never fails what was sent because of it.
4. Tapping a notification opens its `href` (the crew chat, the crew, Friends or
   Support) through `ReminderSync`'s existing tap handling.
5. Leaving a crew, being removed and the crew ending delete its push records;
   signing out takes this phone's token out of every record first
   (`state/social.tsx`); deleting your account removes them all.

Firestore rules: `pushShape` and the three `push` matches in `firestore.rules`.

**Trade-off the user accepted**: someone who can read your push address (a
crewmate, a 1-to-1 chat partner, a friend both ways) could, with effort, send
your phone junk notifications through Expo. Turning notifications off in the
phone's settings stops them. A Firebase Cloud Function sender (Blaze plan) would
close that gap later without changing the app's records.

## What you need to do (once)

The first build with push (1.0.1) needs Apple to approve the new permission,
which needs you signed in to Apple once:

1. Get the latest code on your PC (the way you usually do, e.g. `git pull`).
2. In the Afterglow folder, run `npm run build:ios`.
3. Sign in to Apple when asked. Say **yes** to every question, especially
   **"set up Push Notifications"** (EAS makes the push key and stores it).
4. It builds and sends itself to TestFlight as before.

If the automatic build on GitHub ran first and stopped at signing, that's
expected: the build from your PC replaces it. From then on, builds and instant
updates go by themselves again.

Android (the download link) doesn't get pushes yet: it needs Firebase Cloud
Messaging (a `google-services.json` from the Firebase console and the FCM key
uploaded to Expo). Reminders still work there.

## Testing on two iPhones

1. Both on the 1.0.1 TestFlight build, signed in, in the same crew.
2. Allow notifications when asked (or Settings → Afterglow → Notifications).
3. Phone A: lock it. Phone B: send a chat message → A shows "Crew name / Name: message".
4. Phone B: check in with "come find me" → A shows "Name: come find me". Tap it: the crew opens.
5. Phone A signs out → B's next message doesn't reach A.
