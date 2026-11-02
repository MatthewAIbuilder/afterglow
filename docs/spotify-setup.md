# Spotify in Afterglow: add a playlist

Since 2026-11-02 there's no Spotify sign-in (Spotify only allowed 5 people to sign in to Afterglow). Instead, anyone can add **public Spotify playlists** by pasting their link, and Afterglow starts their map from the artists on them. Nothing to set up: no Spotify developer app, no Client ID, no development build. The Spotify app at developer.spotify.com and `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` in EAS aren't used any more and can be deleted.

## Adding one (on your iPhone)

1. In **Spotify**, open a playlist. Good ones: **Your Top Songs 2025** (from Wrapped, in your library), **On Repeat**, or any playlist you made.
2. Tap **•••** (or the share icon), then **Share**, then **Copy link**.
3. If it's your own playlist and private: **•••** → **Make public** first. Afterglow can only read public playlists.
4. In **Afterglow**: **Profile** → **Settings and more** → **Music connections** → under Spotify, paste the link → **Add playlist**.
5. It reads the playlist in a few seconds and says **From your Spotify playlists**, with how many artists it found. **Add another playlist** adds more (up to 10). They're read again once a day.

Albums and artist pages work too. Liked Songs can't be shared, so make a playlist from them if you want them in.

## If it doesn't work

| What it says | Why | What to do |
|---|---|---|
| "That isn't a Spotify playlist link." | What was pasted isn't a Spotify link (a song link isn't enough). | Copy the playlist's link again from Share. |
| "Spotify didn't show that playlist." | The playlist is private or was removed, or Spotify changed its page. | Make it public. If a public one still fails, tell Claude: the page reader may need a fix (`src/features/music/spotify/links.ts`). |
| "Couldn't reach Spotify." | No signal. | Try again with signal. |
| "Add Spotify playlists in the Afterglow app on your phone." | You're on the website. | Use the app (Expo Go works too). |

Plan to playlist (making a playlist from your festival plan) needs a sign-in, so it's for Apple Music only.
