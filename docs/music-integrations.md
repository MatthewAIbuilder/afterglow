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
   - Everything imported for one artist is capped at `IMPORT_CAP` 0.6.
   - Once you've reacted to or rated an artist in Afterglow, the library counts `IMPORT_OWN_SHARE` half for them.
   - Ratings are still taken at their word, and one skip outweighs a whole library.

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
| Spotify sign-in and sync | Tested against recorded response shapes | Probably not (see redirect below) | Spotify Client ID, a development build |
| Apple Music sign-in and sync | API reading tested with fixtures | No (Expo Go has no MusicKit) | MusicKit module in a development build, developer-token service |

Nothing in the app pretends to connect: without setup, both services say "Not available in this version of Afterglow yet." or "Needs the full version of Afterglow."

### Environment variables

Put these in a local `.env` (git ignores it; see `.env.example`) or in EAS environment variables. Neither is a secret, and no secret ever goes in the app.

- `EXPO_PUBLIC_SPOTIFY_CLIENT_ID`: the Spotify app's Client ID.
- `EXPO_PUBLIC_APPLE_MUSIC_TOKEN_URL`: an https link that returns `{ "token": "<MusicKit developer token>" }`.

Secrets that must stay **outside** the app and the repo: the Spotify client secret (not used at all: PKCE needs none), the Apple MusicKit private key (.p8), its Key ID and your Team ID (used only by the service that signs developer tokens).

### Spotify, one-time setup

1. Sign in at developer.spotify.com > Dashboard > Create app. Name it, tick "Web API". As of Spotify's February 2026 changes, a development-mode app needs its owner to have Spotify Premium and allows up to 5 listed users; wider use needs Spotify's extended quota approval.
2. Redirect URI: add `afterglow://music-auth` (the app's scheme from app.json plus the path in `config/music.ts`). Spotify requires HTTPS or loopback for web redirects and still allows custom schemes for apps, but has recommended universal links; if the dashboard rejects the scheme, set up a universal link and point `MUSIC_REDIRECT` at it.
3. Under "User Management", add the Spotify accounts that will test.
4. Copy the Client ID into `EXPO_PUBLIC_SPOTIFY_CLIENT_ID`.
5. Build a development build (`npx eas-cli@latest build --profile development --platform ios`), install it, open Profile > Music connections > Spotify > Connect.

Expo Go's redirect is `exp://<your computer's address>/--/music-auth`, which changes with your network, so Spotify sign-in is only practical in a development build.

Scopes requested (the minimum): `user-library-read` (saved songs), `user-follow-read` (followed artists), `user-top-read` (top artists, about six months and the last four weeks). Nothing that writes, no playlists, no playback, no email. If Spotify stops offering a part to an app (it has removed endpoints before), that part becomes a gap and the rest still syncs.

### Apple Music, one-time setup

1. In the Apple Developer account: Certificates, Identifiers & Profiles > Keys > create a key with MusicKit. Download the .p8 once; note the Key ID and Team ID. Enable MusicKit for the app's identifier.
2. Host a tiny token service (any serverless function) that signs a developer token (ES256 JWT, `iss` = Team ID, `kid` = Key ID, up to 6 months) and returns `{ "token": "..." }`. Put its https link in `EXPO_PUBLIC_APPLE_MUSIC_TOKEN_URL`. This repo deliberately contains no backend.
3. Add a MusicKit native module (an Expo module wrapping `MusicAuthorization.request()` and `MusicUserTokenProvider`, or a maintained community package) and implement `AppleMusicAuthorizer` from `src/features/music/apple/musicKit.ts` with it. Pass it instead of `noMusicKit` in `src/features/music/services.ts`. Add `NSAppleMusicUsageDescription` to `ios.infoPlist` in app.json, e.g. "Afterglow reads your library to learn which artists you love."
4. Build a development build and test on an iPhone with an Apple Music subscription.

Apple's API has no list of favourite artists, so Apple Music reads library songs, library artists (for catalogue ids and genres), heavy rotation and recently played; `followed` stays unknown.

## Testing

```
npx jest --ci src/features/music src/features/taste src/app/__tests__/music.test.tsx
```

- `features/music/__tests__/fixtures.ts`: realistic Spotify and Apple Music responses and a fake `fetch`. No real accounts or credentials.
- `spotify.test.ts`, `apple.test.ts`: normalising, paging, refresh, expired and revoked access, gaps, denied, rate limits, tokens never leaving the service's API.
- `library.test.ts`: merging services, duplicates, provider leakage, catalogue matching, genres.
- `features/taste/__tests__/imported.test.ts`: the imported layer is conservative, capped, reported separately, and likes/skips/ratings still work.
- `store.test.ts`: failed syncs keep the last snapshot, disconnect removes everything, copy for every state.
- `privacy.test.ts`: field classification and consent.
- `src/app/__tests__/music.test.tsx`: the screen in disconnected, connected, syncing, failed and expired states, disconnecting, My Sound's notes, the artist page and Start over, with test-double services.

What can't be tested in the cloud: a real Spotify or Apple sign-in, the redirect back into the app, MusicKit's permission prompt, and live API responses. Those need the setup above and a phone.
