# Sign in with Apple and Google

Since version 1.0.5 (2026-10-21; the user: "I don't think we ever added apple or google log in ability either", then "go ahead with both").

The sign-in screen (`src/app/account.tsx`) shows **Continue with Apple** and **Continue with Google** above email and password, each only once it's switched on (below). Email and password still work as before, and existing accounts are untouched.

## What you do (once)

### 1. Switch them on in Firebase

1. Go to **console.firebase.google.com** → the **afterglowmusic** project → **Authentication** (left menu, under Build) → **Sign-in method** tab.
2. **Add new provider** → **Apple** → switch **Enable** on → **Save**. Leave the other boxes empty (they're only for Apple on the website).
3. **Add new provider** → **Google** → switch **Enable** on. Pick your email as the support email → **Save**.
4. Click **Google** again in the list and open **Web SDK configuration**. Copy the **Web client ID** (it ends in `.apps.googleusercontent.com`) and send it to Claude. It's public (like the rest of the Firebase settings), so it's fine to paste in chat.

### 2. Let Google send people back to the app

1. Go to **console.cloud.google.com**, and pick the **afterglowmusic** project at the top.
2. Menu → **APIs & Services** → **Credentials**.
3. Under **OAuth 2.0 Client IDs**, click **Web client (auto created by Google Service)**.
4. Under **Authorized redirect URIs** → **Add URI** → type exactly `https://afterglowmusic.app/google-auth` → **Save**.
5. If Google asks you to set up the **OAuth consent screen** (Google Auth Platform → Branding), fill in the app name **Afterglow**, your support email, and the links to the privacy policy and terms on afterglowmusic.app, then publish it ("In production"), so anyone can sign in, not just test users.

### 3. Make the new iPhone build from your PC

Sign in with Apple has to be switched on inside the app itself, so this version needs a new build, and the first one must come from your PC (Expo signs in to Apple to add the capability, which the automatic GitHub build can't do):

1. In the Afterglow folder on your PC, run `git pull`, then `npm run build:ios`.
2. Sign in to Apple when it asks, and say **yes** if it asks to add the Sign in with Apple capability or to make a new provisioning profile.
3. It goes to TestFlight by itself, as before.

After that, builds work the usual way again.

Then tell Claude it's done: Claude turns the buttons on (`APPLE_SIGN_IN`, `GOOGLE_WEB_CLIENT_ID` in `src/config/social.ts`), and that reaches phones as an instant update, no further build.

## What to test

- iPhone (TestFlight 1.0.5): Profile → sign out → **Continue with Apple** → choose to share or hide your email → you land on making your profile, with your name filled in. Sign out and continue with Apple again: straight back in.
- **Continue with Google** (iPhone, the Android link, the website): pick a Google account → back in Afterglow. A new account goes on to making the profile.
- With your existing email-and-password account's Gmail address, **Continue with Google** signs you into that same account (Google vouches for Gmail addresses). Apple with the same email says there's already an account and to sign in with email and password.
- Edit profile → **Delete account** on an Apple or Google account asks you to confirm with Apple or Google, not for a password.
- Expo Go can't finish either sign-in (Apple's answer is addressed to Expo Go, not Afterglow); use TestFlight.

## How it works

- `features/social/providerAuth.ts` (pure, tested in `__tests__/providerAuth.test.ts`): the one-time code (nonce: kept on the phone, only its SHA-256 sent to Apple or Google, Firebase checks the token against the code, so a token caught on its way is useless to anyone else), Google's sign-in address (`response_type=id_token`, `prompt=select_account`) and reading its answer (the state must match).
- `features/social/providerSignIn.ts` (phone): Apple through `expo-apple-authentication` (Apple's own sheet and button; the full name, given only the first time, prefills the profile's name through `/profile-edit?name=`); Google through its page in the system's secure browser sheet (`expo-web-browser`), answering to `public/google-auth.html` on the website, which hands it straight back to `afterglow://google-auth` (`src/app/google-auth.tsx` steps back if Android also opens it as a link). So only Google's web client ID is needed: no iPhone or Android client, nothing about Google built in. `providerSignIn.web.ts` (website): Firebase's own Apple or Google window.
- `SocialService.signInWithProvider(proof)` returns the user and whether the account is new; `deleteAccount(password | proof)` asks Apple or Google again for an account without a password (and lets go of the Apple sign-in through `revokeAccessToken`, which works once Apple's key is in Firebase; it never blocks deleting). `SocialUser.via` says how an account signs in. New error kinds: `account-exists`, `cancelled` (never shown).
- `features/social/ProviderButtons.tsx`: the buttons (Apple's own on iPhone, white with Google's G), shown only where they work; on delete, only the account's own.
- `app.json`: `ios.usesAppleSignIn` and the `expo-apple-authentication` plugin; version 1.0.5.

## Not yet

- **Apple on the website** (`APPLE_ON_WEB`): needs an Apple Services ID, a key and the return address set up in Apple's developer site and Firebase. Until then an Apple account deletes itself from the iPhone app (the delete box says so on the website).
- **Switch account** keeps passwords in the keychain, so an Apple or Google account can't be saved there yet: sign out and continue with Apple or Google instead.
- **Revoking Apple's sign-in on delete** needs Apple's key in Firebase (the same one as Apple on the website).
