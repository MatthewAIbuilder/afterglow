# Connecting real Spotify accounts

This is the one-time setup to try **Profile → Music connections → Connect Spotify** with your real Spotify account on your iPhone. Written for Windows + iPhone. For how it works inside, see `music-integrations.md`.

## Why a development build (and not Expo Go)

Spotify sends you back to the app after you sign in, using an address registered in Spotify's dashboard. In Expo Go that address is `exp://<your computer's address>/--/music-auth`: it changes with your Wi-Fi, and Spotify no longer accepts that kind of address. A **development build** is your own copy of Afterglow, installed on your iPhone, with its own address `afterglow://music-auth`. Everything else in the app works the same.

In Expo Go, Music connections says "Needs the full version of Afterglow. It can't connect in this preview." That's expected.

Nothing else changes: the project stays an Expo project (no Xcode, no `ios/` folder to maintain). Builds happen in Expo's cloud (EAS).

## What you need

| | Why | Cost |
|---|---|---|
| A **Spotify Premium** account | Since February 2026, Spotify only lets an app in development mode work while its owner has Premium. | Your existing Premium |
| An **Apple Developer Program** membership | Apple only allows your own builds on a real iPhone with one (there's no free way on Windows). | $99 a year |
| A free **Expo account** | To run builds in Expo's cloud. Sign up at expo.dev. | Free tier is enough |
| Node.js on your PC | Already set up if `npx expo start` works for you. | Free |

Spotify's development mode allows **up to 5 Spotify accounts** (yours plus up to 4 testers), listed by hand.

## 1. Create the Spotify app (5 minutes)

1. Go to **developer.spotify.com/dashboard** and log in with your Spotify account.
2. Click **Create app**.
   - App name: `Afterglow (development)`
   - App description: `Festival discovery app, reads which artists I listen to.`
   - Website: leave empty.
   - **Redirect URI**: type exactly `afterglow://music-auth` and click **Add**.
   - Under "Which API/SDKs are you planning to use?", tick **Web API**.
   - Accept the terms and click **Save**.
3. **If the dashboard says the redirect URI is "not secure" or "invalid"**, stop here and read [If Spotify refuses afterglow://music-auth](#if-spotify-refuses-afterglowmusic-auth) below. (Spotify's documentation says custom app addresses are still allowed, but some developers have reported new apps refusing them. Try it first.)
4. Open your app → **Settings**. Copy the **Client ID** (a long mix of letters and numbers).
   - You'll also see **Client secret**. **Don't copy it anywhere.** Afterglow doesn't use it, and it must never go in the app.
5. Still in your app, open **User Management**. Add your own Spotify account (name and the email address on your Spotify account), and anyone else who will test (up to 5 in total).

## 2. Put the Client ID on your PC

In the Afterglow folder on your PC (in PowerShell):

```powershell
git pull
npm install
copy .env.example .env
notepad .env
```

In Notepad, paste your Client ID after `EXPO_PUBLIC_SPOTIFY_CLIENT_ID=` (no spaces, no quotes), save and close. `.env` never leaves your PC: git ignores it.

## 3. Build Afterglow for your iPhone (once, about 20 minutes)

Still in PowerShell, in the Afterglow folder:

1. Log in to Expo:
   ```powershell
   npx eas-cli@latest login
   ```
2. Link the project to your Expo account (it adds a project ID to `app.json`; that's not secret, keep it):
   ```powershell
   npx eas-cli@latest init
   ```
3. Register your iPhone:
   ```powershell
   npx eas-cli@latest device:create
   ```
   Choose "Website", then open the link it shows **on your iPhone** (in Safari) and follow the steps to install the small profile. This tells Apple your iPhone may run your builds.
4. Start the build:
   ```powershell
   npx eas-cli@latest build --profile development --platform ios
   ```
   - When asked for an **iOS bundle identifier**, choose something like `com.yourname.afterglow`. It's permanent for the App Store later, so pick something you're happy with.
   - Log in with your Apple Developer account when asked, and say **yes** to letting EAS create and manage the certificates.
   - The build runs in Expo's cloud. When it's done it shows a link and a QR code.
5. On your iPhone, open that link (or scan the QR code with the Camera) and tap **Install**.
6. On your iPhone, turn on **Settings → Privacy & Security → Developer Mode**, then restart the phone when it asks. (Only needed once.)

You only rebuild when native parts change (a new library, or the app's settings). Everyday code changes load from your PC like in Expo Go.

## 4. Run it

1. On your PC, the first time (and whenever you change `.env`):
   ```powershell
   npx expo start --dev-client --clear
   ```
   `--clear` makes sure the Client ID from `.env` is picked up. After that, `npm run dev` is enough (the same as `npx expo start --dev-client`). Your iPhone and PC must be on the same Wi-Fi. If the phone can't find it, stop it with Ctrl+C and run `npx expo start --dev-client --tunnel`.
2. On your iPhone, open the **Afterglow** app you installed (not Expo Go). It shows your PC's server; tap it (or scan the QR code in the terminal with the Camera).

To keep testing in **Expo Go** as before, run `npm run go` (the same as `npx expo start --go`). Because the project now includes the development build tools, a plain `npx expo start` opens the development build by default; press **s** in the terminal to switch to Expo Go, or use `npm run go`.

## 5. Test the real connection

In the development build on your iPhone:

1. **Connect**: Profile → Music connections. Spotify says "Not connected". Tap **Connect Spotify**.
   - The card shows "Connecting to Spotify…" and Spotify's sign-in sheet opens (Apple asks "Afterglow wants to use spotify.com to sign in"; tap Continue).
   - Sign in if asked, then tap **Agree** on Spotify's permission page. It lists only: your saved content, who you follow, and your top artists.
2. **Back in Afterglow**, the card says "Reading your library…", then **Connected to Spotify** with **Synced**, and three numbers: Last synced (just now), artists analyzed, and on upcoming festivals.
3. **My Sound**: the subtitle starts "Shaped by your Spotify library". If at least 3 of your Spotify artists play Afterglow's lineups, your own artists lead the map. With fewer, a quiet note says how many are on the lineups.
4. **Artist pages**: open one of your Spotify artists from the map. Under the match it says "From your Spotify library". An artist who is only similar says "Close to artists in your Spotify library".
5. **Sync now**: tap it. It shows "Syncing your library…" and "Last synced" goes back to "just now". Tapping it twice doesn't start two reads.
6. **Behaviour still wins**: on the page of one of your Spotify artists, tap **Not for me**. Their match drops to 30% or lower straight away, library or not. (If one of your Spotify artists has clips in Discover, such as ILLENIUM or SUBTRONICS, skipping one of their clips also takes them below 50%.)
7. **Cancel**: Disconnect (below), then tap Connect Spotify and close the sheet without signing in. Nothing is connected and no message appears.
8. **Expired or removed access**: on a computer, go to **spotify.com/account/apps** and click **Remove access** next to Afterglow (development). Back in Afterglow, tap **Sync now**. The card says "Spotify needs you to sign in again", and your last import is still used. Tap **Sign in again** to reconnect. (Spotify can keep accepting the current sign-in for up to an hour after you remove access, so if Sync now still works, try again later.)
9. **No connection**: turn on Airplane Mode, tap **Sync now**. It says "Couldn't sync your library" with "Couldn't reach Spotify…", and your map keeps the last import. Turn Airplane Mode off and tap **Try again**.
10. **Disconnect**: tap **Disconnect & remove imported music data** → **Disconnect & remove**. The card goes back to "Not connected", the numbers disappear, and My Sound and the artist pages no longer mention Spotify. (To remove Afterglow from your Spotify account as well, visit spotify.com/account/apps.)

## If something goes wrong

| What you see | What it means | Fix |
|---|---|---|
| Music connections says "Needs the full version of Afterglow" | You're in Expo Go. | Open the Afterglow development build instead. |
| "Not available in this version of Afterglow yet." | The app didn't get the Client ID. | Check `.env` has `EXPO_PUBLIC_SPOTIFY_CLIENT_ID=...`, then restart with `npx expo start --dev-client --clear`. |
| Spotify's page says **INVALID_CLIENT: Invalid redirect URI** | The address in the dashboard doesn't match exactly. | In the dashboard, the Redirect URI must be exactly `afterglow://music-auth`. |
| Spotify's page says **INVALID_CLIENT: Insecure redirect URI** | Spotify refuses the app address for your app. | See the next section. |
| Signed in fine, then "Spotify didn't allow access" | Spotify refused to share the library: the account isn't in **User Management**, or the app owner's Premium has lapsed. | Add the account in User Management (use the email on the Spotify account); check Premium. |
| "Spotify is busy right now" | Spotify asked apps to slow down. | Wait a few minutes, then Try again. |

## If Spotify refuses afterglow://music-auth

The alternative Spotify recommends is a **universal link**: an https address on a website you control that iPhone knows belongs to your app. It needs:

1. **A domain with https** that you control (for example `afterglow.yourdomain.com`), able to serve two small files.
2. On that domain, a file at `https://<your domain>/.well-known/apple-app-site-association` (no file extension, served as `application/json`):
   ```json
   { "applinks": { "details": [{ "appIDs": ["<TEAM ID>.<bundle identifier>"], "components": [{ "/": "/music-auth" }] }] } }
   ```
   Your Team ID is at developer.apple.com → Membership details. The bundle identifier is the one you picked in step 3.
3. For Android later, `https://<your domain>/.well-known/assetlinks.json` (EAS can print it: `npx eas-cli@latest credentials`).
4. In `.env`, set `EXPO_PUBLIC_SPOTIFY_REDIRECT_URI=https://<your domain>/music-auth`. Also add it to EAS, because the build needs it:
   ```powershell
   npx eas-cli@latest env:create --name EXPO_PUBLIC_SPOTIFY_REDIRECT_URI --value https://<your domain>/music-auth --environment development --visibility plaintext
   ```
5. In the Spotify dashboard, use `https://<your domain>/music-auth` as the Redirect URI.
6. Rebuild (step 3.4). The app then declares that domain automatically (`app.config.ts`), and signs in with iOS's universal-link sign-in (iOS 17.4 or later).

## On TestFlight (the quick way, 2026-10-18)

The TestFlight app is a real build, so Spotify works there with no development build. All it needs is the Client ID:

1. Step 1 above (the Spotify app, with the redirect `afterglow://music-auth`), and add your Spotify email (and up to four testers') under **User Management**.
2. Give the Client ID to Expo for release builds and updates (once, on your PC):
   `npx eas-cli@latest env:create --name EXPO_PUBLIC_SPOTIFY_CLIENT_ID --value <client id> --environment production --visibility plaintext`
   (and `--environment preview` for the Android link build).
3. The next instant update (any change merged to `main`) carries it: no new build needed.

**The big limit:** Spotify's development mode allows only **5 listed accounts**. Anyone else sees Spotify refuse the sign-in. Opening it to everyone needs Spotify's **extended quota**, which Spotify reviews and grants selectively (as of 2025 only to established businesses). For EDC, Spotify is for you and up to four testers; Apple Music has no such limit.
