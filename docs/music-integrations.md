# Music connections (Spotify, Apple Music)

Afterglow can read a person's music library to get a head start on their taste. This guide covers how it's built, what's private, and the one-time setup still needed before real accounts can connect.

## How it fits together

```
Afterglow screens (Music connections, My Sound, artist pages)
        │  useMusic() / useTaste()
        ▼
MusicConnectionsProvider (src/state/music.tsx)
        │  connect / sync / disconnect, saved normalised snapshots
        ▼
Music provider interface: MusicService (src/features/music/service.ts)
        │
        ├── Spotify adapter      (src/features/music/spotify/)
        └── Apple Music adapter  (src/features/music/apple/)
        │
        ▼
Normalised music signals: MusicLibrarySnapshot → MusicArtistSignal (models.ts)
        │  combineLibraries (library.ts) → importedMusic (imported.ts)
        ▼
Taste engine: the separate, capped "imported" layer (features/taste/engine.ts)
        │
        ▼
My Sound map, Discover ranking, Your festival, Tune, breakdowns
```

Nothing outside `src/features/music/` imports an adapter (an architecture test enforces it). Screens only ever see `MusicConnection` state and the imported layer, never a provider's response.

### The normalised model (`src/features/music/models.ts`)

- `MusicProviderId`: `spotify` | `apple-music`. A new service is a new id, an adapter implementing `MusicService`, and a line in `services.ts`.
- `MusicArtistSignal`: one artist from one service: name, folded `key` for matching, the service's artist id (optional), `savedTracks`, `savedAlbums`, `followed` (undefined when the service doesn't say), `topRank`, `recent`, `genres`, and which `sources` mention them. Only what the service said: an unknown stays undefined.
- `MusicLibrarySnapshot`: one sync of one service: `syncedAt`, the artists, how many saved songs were read, and `gaps` (parts the service didn't give, so a missing part is never read as "none").
- `MusicConnection` / `MusicState`: per service, connected / syncing / last error / last good snapshot. No tokens.

Adapters keep only names, ids, counts and genres. Song titles, album names, playlists and account details never leave the adapter (tests check this).

### How imported music affects taste

1. `strength.ts` turns each artist into a library strength from 0 to 1 (`LIBRARY_STRENGTH`): followed 0.5; saved songs on a log scale (1 song 0.15, 3 songs 0.3, 7+ 0.45); top-artist rank 0.35 down to 0.1; played recently 0.2. One saved song is a weak hint; a followed favourite you play a lot is 1.
2. `library.ts` merges services: an artist in both is one record (matched by folded name), keeping the strongest evidence of each (never adding saved counts, which may be the same songs).
3. `imported.ts` matches library artists to catalogue artists by folded name ("Subtronics" finds SUBTRONICS). Library artists Afterglow doesn't have never become Afterglow artists; when their genres clearly map to a sound (`genres.ts`; broad labels like "electronic" or "dance" are ignored) they count through that sound only.
4. `computeTaste(..., imported)` adds the imported layer separately from behaviour and returns it as `imported`, so it can be tuned on its own:
   - `IMPORT_WEIGHT` 0.6: a library strength of 1 counts 0.6, below one like (1.0).
   - Spill-over to similar artists works like likes (same `SPILL`, same similarity).
   - Library artists outside the catalogue reach only artists at least `IMPORT_SOUND_MIN_SIMILARITY` 0.5 alike, at `IMPORT_SOUND_SHARE` half weight, adding at most `IMPORT_SOUND_CAP` 0.3.
   - Everything that reaches an artist only by sounding like your library (spill from similar library artists plus the sounds of library artists Afterglow doesn't have) is at most `IMPORT_SPILL_CAP` 0.3, and it only fills the room the artist's own library strength leaves (`own + spill × (1 − own / IMPORT_CAP)`). So an artist who merely sounds like your library never ties with one who is in it, and a stronger library artist always ranks higher. (Before Milestone 44, a big library spilled every similar act up to the same cap as the listener's favourite.)
   - Everything imported for one artist is capped at `IMPORT_CAP` 0.6.
   - Once you've reacted to or rated an artist in Afterglow, the library counts `IMPORT_OWN_SHARE` half for them.
   - Ratings are still taken at their word, and one skip outweighs a whole library.
5. `startingPrior(base, imported)`: everyone starts from the built-in starting guess (`data/mock/tasteProfile.ts`) so a newcomer's map isn't empty. That guess is made up, so once a library names at least `PRIOR_YIELDS_AT` 3 Afterglow artists it steps aside and every match starts at 50%: your library decides who leads the map (a house fan's favourite used to sit below five made-up bass favourites). Disconnecting brings the guess back. My Sound's "only N of your artists…" note uses the same threshold (`LITTLE_LIBRARY`).

A heavy library artist ends around 56% on its own, a single like around 60%: the engine moves in small steps, so "strongly represented" on My Sound means leading the map (centre, biggest bubbles), not a high percentage. Real behaviour then takes over quickly.

The map fills only with what's real: imported artists are "informed" and join My Sound; if few of your artists are on Afterglow's lineups, My Sound says so rather than padding the map.

## Privacy

Music-library data is private by default. `src/features/music/privacy.ts` lists every field (`MUSIC_FIELD_PRIVACY`):

- **Private** (never leaves the phone, never shown to others): everything a service returned (ids, names of artists Afterglow doesn't have, saved counts, follows, ranks, recent plays, genres, sync times, gaps), which services are connected and any sync error.
- **Potentially shareable, only with consent**: favourite artists as Afterglow artists (Afterglow id and name), and top sounds. `shareableMusicProfile` returns nothing unless each part has consent, and takes only Afterglow ids, so a service's record can't reach it. Future profiles, follows and social features must go through it.

Rules the code follows:

- Tokens live only in the secure store (`secrets.ts`: iOS Keychain / Android Keystore, this device only, while unlocked). AsyncStorage (`musicLibrary.v1`) holds normalised snapshots and status only. An architecture test checks that nothing writing AsyncStorage touches the secure store.
- Error messages never include tokens, codes or response bodies. Nothing is logged.
- Tokens are only ever sent to `api.spotify.com` / `accounts.spotify.com` / `api.music.apple.com`; paging links elsewhere are refused.
- "Disconnect & remove imported music data" deletes the service's snapshot and its token. Spotify and Apple offer no in-app revoke; the confirmation explains the import is removed, and the service's own settings (spotify.com/account/apps; iPhone Settings > Privacy & Security > Media & Apple Music) remove the permission itself.
- A failed sync never replaces the last good snapshot. An expired sign-in shows "Connect again" and keeps the last import in use until you disconnect.
- Start over (My Sound) clears taste you built in Afterglow, not connections.

## What works now, and what needs setup

| | In this cloud session / tests | Expo Go on iPhone | Needs |
|---|---|---|---|
| Normalising, merging, taste integration, privacy | Fully tested with fixtures | Yes | Nothing |
| Music connections screen, My Sound notes, states | Tested with test doubles | Yes (shows "not available" until set up) | Nothing |
| Spotify sign-in and sync | Tested against recorded response shapes, PKCE and state checks | No: shows "Needs the full version" | Spotify Client ID, a development build (see spotify-setup.md) |
| Apple Music sign-in and sync | API reading tested with fixtures | No (Expo Go has no MusicKit) | The app's own build (1.0.1 on), MusicKit switched on for the app's identifier |

Nothing in the app pretends to connect: without setup, both services say "Not available in this version of Afterglow yet." or "Needs the full version of Afterglow."

### Environment variables

Put these in a local `.env` (git ignores it; see `.env.example`) or in EAS environment variables. Neither is a secret, and no secret ever goes in the app.

- `EXPO_PUBLIC_SPOTIFY_CLIENT_ID`: the Spotify app's Client ID.
- `EXPO_PUBLIC_APPLE_MUSIC_TOKEN_URL`: an https link that returns `{ "token": "<MusicKit developer token>" }`.

Secrets that must stay **outside** the app and the repo: the Spotify client secret (not used at all: PKCE needs none), the Apple MusicKit private key (.p8), its Key ID and your Team ID (used only by the service that signs developer tokens).

### Spotify

**Step-by-step setup and a test checklist: [`spotify-setup.md`](spotify-setup.md).**

How the connection works:

- **Sign-in**: Authorization Code with PKCE (S256), no client secret anywhere. `spotify/auth.ts` (pure, tested) makes the verifier, challenge and a random `state`, builds the authorize link, and reads the answer: a code only counts if it arrives at the exact redirect address with the same `state`; a denial is only believed with the right `state` too. `spotify/signIn.ts` opens it in the system sheet with `expo-web-browser`'s `openAuthSessionAsync` (ASWebAuthenticationSession on iPhone, a Custom Tab on Android). `tokens.ts` exchanges the code and refreshes.
- **Redirect**: `afterglow://music-auth` by default. `EXPO_PUBLIC_SPOTIFY_REDIRECT_URI` can switch to an https universal link if Spotify's dashboard refuses the custom scheme for a new app; `app.config.ts` then adds the Associated Domains entitlement and an Android App Link for that host, and the sheet uses the universal-link callback (iOS 17.4+). Anything else (http, `exp://`, a query string) is ignored.
- **Expo Go**: Spotify is shown as needing the full app (`needsOwnApp`, from `Constants.executionEnvironment`), because Expo Go's `exp://` return address can't be registered. Use a development build (`expo-dev-client`, `eas.json` profile `development`).
- **Tokens**: kept only in the secure store, refreshed a minute before they run out and once more on a 401. A refused refresh (revoked at spotify.com/account/apps, or older than Spotify's 6-month refresh-token limit) clears the session and shows "Sign in again", keeping the last import until you disconnect.
- **Connection state** (`state/music.tsx`): one sign-in at a time (`connecting` while the sheet is open), one read at a time (a second Sync now joins the running one), a sign-in or read that finishes after a disconnect is dropped and anything it stored is forgotten, a secure-store sign-in with no connection behind it is forgotten on launch (the iPhone keychain outlives an uninstall), and a connected library with no import yet or older than a day is read again on launch.
- **Screen states** (`copy.ts`, `connectionStatus`): not connected, connecting, connected, syncing, synced, sign in again (expired, revoked or not allowed), sync failed (network, busy, unknown), plus "not available" when the build can't connect. Synced shows Last synced, artists analyzed and on upcoming festivals (`reach.ts`). No account details are shown or stored.

Spotify's rules this relies on (checked 2026-09-29 against sources quoting Spotify's changelog; developer.spotify.com itself is blocked from the cloud session):

- Development mode (February 2026): the app owner needs Premium; up to 5 listed users; existing apps migrated 2026-03-09.
- Still available: `GET /me/tracks`, `GET /me/following?type=artist`, `GET /me/top/artists`. Removed: follow/unfollow writes, `/me/following/contains`, batch artist lookups, artist top tracks. Artist `genres` remain; `popularity` and `followers` are gone (Afterglow doesn't read them).
- Redirects: https or loopback IP only for web addresses (no `http://`, no `localhost`, since November 2025); custom schemes documented as still supported, though some developers report new apps refusing them (hence the universal-link option).
- Refresh tokens expire 6 months after sign-in.

If Spotify stops offering a part to an app, that part becomes a gap ("Spotify didn't share your top artists this time…") and the rest still syncs. If every part is refused (typically an account missing from User Management), the sync fails as "Spotify didn't allow access".

### Apple Music

Built in version 1.0.1 (2026-10-18). The native part is a small local Expo module, `modules/afterglow-musickit` (Swift, autolinked from `modules/`): `developerToken()` asks MusicKit for the app's own developer token (`DefaultMusicTokenProvider`, iOS 16+), and `authorize(developerToken)` shows Apple's permission prompt (`MusicAuthorization.request()`) and returns the Music User Token (`MusicUserTokenProvider`). `apple/nativeMusicKit.ts` wraps it (only in the app's own iPhone builds; Expo Go and the website fall back to `noMusicKit`). Because MusicKit makes the developer token itself, **no token service, key or secret is needed**; `EXPO_PUBLIC_APPLE_MUSIC_TOKEN_URL` still works and wins if it's ever set. `app.json` has `NSAppleMusicUsageDescription`.

**One-time setup (the user, 2 minutes):** developer.apple.com → Certificates, Identifiers & Profiles → **Identifiers** → `app.afterglowmusic` → **App Services** tab → tick **MusicKit** → Save. Without it, MusicKit gives no developer token and Connect says it couldn't reach Apple Music.

Test on an iPhone with an Apple Music subscription: Profile → Music connections → Apple Music → Connect → Apple's prompt → Allow → it syncs.

Apple's API has no list of favourite artists, so Apple Music reads library songs, library artists (for catalogue ids and genres), heavy rotation and recently played; `followed` stays unknown.

## Testing

```
npx jest --ci src/features/music src/features/taste src/app/__tests__/music.test.tsx
```

- `features/music/__tests__/fixtures.ts`: realistic Spotify and Apple Music responses and a fake `fetch`. No real accounts or credentials.
- `spotify.test.ts`, `apple.test.ts`: normalising, paging, refresh, expired and revoked access, gaps, denied, rate limits, tokens never leaving the service's API, failed token exchange, Expo Go.
- `spotifyAuth.test.ts`: PKCE (RFC 7636 test vector), the authorize link, state and redirect checks, denied/cancelled/failed sheets, the redirect setting.
- `reach.test.ts`: "on upcoming festivals".
- `src/state/__tests__/music.test.tsx`: the provider on its own: connecting, duplicate syncs, disconnect mid sign-in and mid sync, forgotten orphan sign-ins, the launch re-read.
- `features/taste/__tests__/coldStart.test.ts`: a new listener's messy Spotify library, end to end against the real catalogue: duplicates, missing names, artists Afterglow doesn't have, lineup artists, the library leading the first map, and behaviour taking over.
- `library.test.ts`: merging services, duplicates, provider leakage, catalogue matching, genres.
- `features/taste/__tests__/imported.test.ts`: the imported layer is conservative, capped, reported separately, and likes/skips/ratings still work.
- `store.test.ts`: failed syncs keep the last snapshot, disconnect removes everything, copy for every state.
- `privacy.test.ts`: field classification and consent.
- `src/app/__tests__/music.test.tsx`: the screen in disconnected, connected, syncing, failed and expired states, disconnecting, My Sound's notes, the artist page and Start over, with test-double services.

What can't be tested in the cloud: a real Spotify or Apple sign-in, the redirect back into the app, MusicKit's permission prompt, and live API responses. Those need the setup above and a phone.
