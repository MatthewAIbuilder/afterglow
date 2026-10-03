# Your own copy of Afterglow on your iPhone (the development build)

Expo Go is a general-purpose app that can open any Expo project, so it only
has the features Expo put in it. A **development build** is Afterglow's own
app, installed on your iPhone with its own name and icon. It's what lets these
work, now or in the next steps:

- Spotify sign-in (built; Expo Go can't complete it)
- Sign in with Apple and with Google (next: the App Store expects them)
- Heart rate from Apple Health in Look after yourself (later)
- Real push notifications, so a crewmate's "come find me" or a support reply
  reaches you with the app closed (later)

You keep coding and testing the same way: your PC runs the project, the app
on your phone loads it, and changes show up straight away. Expo Go keeps
working too (`npm run go`).

Everything below works from Windows: Expo builds the iPhone app in the cloud
(no Mac needed).

---

## Step 1: join the Apple Developer Program ($99 a year)

1. On your iPhone or PC, go to **developer.apple.com/programs/enroll** and
   tap **Start your enrollment**.
2. Sign in with your Apple ID (the one on your iPhone is fine). Turn on
   two-factor authentication if it asks.
3. Choose **Individual / Sole Proprietor**. It's the quickest (usually 1 to 2
   days) and needs nothing but your ID. Your legal name shows on the App Store
   as the seller. (Choose **Organization** only if you have a registered
   company and a D-U-N-S number; it can take a couple of weeks. You can move
   to a company later.)
4. Pay the $99. The easiest way is the **Apple Developer** app on your iPhone:
   download it, sign in, tap Account, then **Enroll Now**; it pays with your
   Apple ID.
5. Wait for the email "Welcome to the Apple Developer Program". Until then,
   do step 2.

## Step 2: an Expo account (free, while you wait)

1. Go to **expo.dev/signup** and make an account. Remember the username.
2. On your PC, open the terminal in the Afterglow folder (the same place you
   run `npm run go`) and sign in:

   ```
   npx eas-cli@latest login
   ```

3. Link the project to your Expo account (once):

   ```
   npx eas-cli@latest init
   ```

   Say **yes** when it asks to create a project. It adds a project id to
   `app.json`; that change is fine to keep (I'll put it in GitHub for you if
   you send me the line it added, or just commit it).

## Step 3: register your iPhone (once Apple has approved you)

Apple only lets a development build run on phones you've registered.

1. On your PC, in the Afterglow folder:

   ```
   npm run device
   ```

   (That's `npx eas-cli@latest device:create`.) Choose **Website**: it shows
   a QR code.
2. Scan the QR code with your iPhone camera and open the link in **Safari**.
   It downloads a profile: tap **Allow**.
3. On the iPhone: **Settings**, then near the top **Profile Downloaded**, then
   **Install** (enter your passcode). That registers the phone.

## Step 4: make the build (about 15 to 25 minutes, in the cloud)

1. On your PC, in the Afterglow folder:

   ```
   npm run build:dev
   ```

   (That's `npx eas-cli@latest build --profile development --platform ios`.)
2. It asks a few questions. Answer:
   - **Log in to your Apple account?** Yes. Use the Apple ID from step 1.
     (It may send a code to your iPhone.)
   - **Generate a new Apple Distribution Certificate / Provisioning
     Profile?** Yes to each. Expo makes and keeps them for you.
   - **Select devices**: make sure your iPhone is ticked (space bar to tick,
     Enter to go on).
3. Leave it running. You can close the terminal: the build carries on at
   **expo.dev** under your project's **Builds**. You get an email when it's
   done.

## Step 5: install it on your iPhone

1. When the build finishes, the terminal (and the build page on expo.dev)
   shows a QR code. Scan it with your iPhone camera and tap **Install**.
2. iPhone (iOS 16 or later) needs **Developer Mode** once: **Settings**,
   **Privacy & Security**, scroll to the bottom, **Developer Mode**, turn it
   on, and restart when it asks. After the restart, tap **Turn On**.
3. Afterglow's own icon is now on your home screen.

## Step 6: run it

1. On your PC, in the Afterglow folder:

   ```
   npm run dev
   ```

   (Expo Go is still `npm run go`.)
2. Open **Afterglow** on your iPhone (the new icon, not Expo Go). It shows the
   computers running Afterglow on your Wi-Fi: tap yours. Or scan the QR code
   from the terminal with the iPhone camera.
3. It loads like Expo Go did. Shake the phone for the developer menu.

Your `.env` file (Firebase and Spotify settings) is read on your PC as
before, so accounts work in the development build the same way.

### When you need to build again

Only when something native changes: a new package that needs it, a new
permission, or a change to `app.json`. I'll tell you when a change needs a
new build ("needs `npm run build:dev`"). Everything else (screens, logic,
data) loads straight from your PC.

---

## Troubleshooting

| What you see | Why | What to do |
| --- | --- | --- |
| `You don't have permission` / `not enrolled` during the build | Apple hasn't finished approving the account. | Wait for the welcome email, then run `npm run build:dev` again. |
| The app installs but shows **Untrusted Developer** or won't open | Developer Mode is off. | Step 5.2. |
| The install link says the app **can't be installed** | The phone wasn't registered before the build. | Run `npm run device` (step 3), then `npm run build:dev` again and tick the phone. |
| The app opens to a list with no computers | The phone and PC aren't on the same Wi-Fi, or the PC isn't running it. | Run `npm run dev` on the PC; same Wi-Fi; or try `npx expo start --dev-client --tunnel`. |
| `npm run dev` opens Expo Go instead | Wrong command. | `npm run dev` is the development build; `npm run go` is Expo Go. |

## What comes after

- **TestFlight and the App Store**: `docs/app-store.md` (a production build,
  then `submit`).
- **Spotify on the development build**: `docs/spotify-setup.md`.
