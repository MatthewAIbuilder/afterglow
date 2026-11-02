# Music connections (Apple Music, Spotify playlists)

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
| Spotify playlists by link | Link reading and the embed page tested with fixtures | Yes | Nothing (a public playlist) |
| Apple Music sign-in and sync | API reading tested with fixtures | No (Expo Go has no MusicKit) | The app's own build (1.0.1 on), MusicKit switched on for the app's identifier |

Nothing in the app pretends to connect: without setup, both services say "Not available in this version of Afterglow yet." or "Needs the full version of Afterglow."

### Environment variables

Put these in a local `.env` (git ignores it; see `.env.example`) or in EAS environment variables. Neither is a secret, and no secret ever goes in the app.

- `EXPO_PUBLIC_APPLE_MUSIC_TOKEN_URL`: an https link that returns `{ "token": "<MusicKit developer token>" }`.

Secrets that must stay **outside** the app and the repo: the Apple MusicKit private key (.p8), its Key ID and your Team ID (used only by the service that signs developer tokens).

### Spotify (by playlist link, since 2026-11-02)

Spotify's sign-in was removed on 2026-11-02 (the user: "we can take Spotify out because I don't think we'll ever have access to it... unless there's a way we can just have them share a playlist"). Spotify only lets 5 listed people sign in to an app in development mode, and extended access needs a large company, so instead you **add playlists by link**:

- **Adding** (Music connections → Spotify → paste a link → Add playlist): `spotify/links.ts` `parseSpotifyLink` takes open.spotify.com links (with `/intl-xx/`, `?si=…`, or words around them), `spotify:playlist:…` URIs, and short `spotify.link` addresses (opened first to see where they lead). Playlists, albums and artists work. The link is read straight away, so a private or wrong link says so at once (`bad-link`, `not-public`, `network`); a link that fails leaves the playlists already added alone.
- **Reading**: each link's public embed page, `https://open.spotify.com/embed/<kind>/<id>` (what any website shows when it embeds a playlist; no key, no account). `readEmbedPage` finds the page's JSON data script (usually `__NEXT_DATA__`) and its `trackList` (`title`, `subtitle` = artists, `uri`); `libraryFromEmbeds` turns every song into a "saved" song for `normalizeSpotify`, each song counted once across links. Only artist names and counts are kept, never song titles. If Spotify changes that page, adding a link says "Spotify didn't show that playlist", and `readEmbedPage` is the one place to fix.
- **Kept**: up to 10 links (`SPOTIFY_LINKS_MAX`) with their names, in the secure store under the Spotify key; each sync (Sync now, and on launch once a day) reads them all. Disconnecting forgets them and the import.
- **Where**: the phone app, Expo Go included (it's only `fetch`). The website says to add playlists in the app (a browser isn't allowed to read Spotify's pages from another site).
- **Not offered for Spotify**: Plan to playlist (it needs a sign-in; `canMakePlaylist`), followed artists, top artists, recent listening.
- **Untested against the real page from the cloud session** (open.spotify.com is blocked here); the tests use a page in the shape Spotify's embed has had.
- Removed with the sign-in: `spotify/auth.ts`, `signIn.ts`, `tokens.ts`, `api.ts`, `playlist.ts`, the `music-auth` route, `EXPO_PUBLIC_SPOTIFY_CLIENT_ID`, `EXPO_PUBLIC_SPOTIFY_REDIRECT_URI` and `app.config.ts`'s universal link. `docs/spotify-setup.md` now explains adding a playlist.

### Apple Music

Built in version 1.0.1 (2026-10-18). The native part is a small local Expo module, `modules/afterglow-musickit` (Swift, autolinked from `modules/`): `developerToken()` asks MusicKit for the app's own developer token (`DefaultMusicTokenProvider`, iOS 16+), and `authorize(developerToken)` shows Apple's permission prompt (`MusicAuthorization.request()`) and returns the Music User Token (`MusicUserTokenProvider`). `apple/nativeMusicKit.ts` wraps it (only in the app's own iPhone builds; Expo Go and the website fall back to `noMusicKit`). Because MusicKit makes the developer token itself, **no token service, key or secret is needed**; `EXPO_PUBLIC_APPLE_MUSIC_TOKEN_URL` still works and wins if it's ever set. `app.json` has `NSAppleMusicUsageDescription`.

**One-time setup (the user, 2 minutes):** developer.apple.com → Certificates, Identifiers & Profiles → **Identifiers** → `app.afterglowmusic` → **App Services** tab → tick **MusicKit** → Save. Without it, MusicKit gives no developer token and Connect says it couldn't reach Apple Music.

Test on an iPhone with an Apple Music subscription: Profile → Music connections → Apple Music → Connect → Apple's prompt → Allow → it syncs.

Since 1.0.2 a failed connect says why (`musicKitProblem` in `apple/musicKit.ts`; MusicKit's error names come back from the module): **not-ready** (MusicKit gave no developer token: MusicKit not ticked, or Apple still switching it on), **music-app** (the Music app was never opened: accept Apple's welcome screen), **signed-out** (nobody signed in to Apple Music), **no-library** (`MusicSubscription.hasCloudLibraryEnabled` is off: no subscription or Sync Library off). Before 1.0.2 all of these said "Not available in this version of Afterglow yet." or "didn't connect".

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
