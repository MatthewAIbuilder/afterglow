# Track ID (Shazam)

Since version 1.0.2 (2026-10-18; the user asked for ShazamKit "to add individual song info to each post", folded into the same update as the Apple Music fixes).

## What it does

While you tag a video (`src/app/memory-tag.tsx`, the **Track** section from `features/memories/TrackSuggestion.tsx`), the phone asks Shazam which song is playing. It suggests "Shazam hears: title, artist" with **Add it** / **Not it**. Nothing is kept unless you add it. A kept track:

- stays with the memory on the phone (`Memory.track`, `memories.v1`),
- goes with the video when it's shared (`trackTitle`, `trackArtist`, `trackUrl` on `memories/{id}`; rules in `memoryTagsOk`; retagging changes it),
- shows as a small ♪ pill (`features/memories/TrackLine.tsx`) under who was playing on Discover crowd videos and on the shared video page; it opens the song on Apple Music when Shazam gave a link.

The song's artist is often not the DJ. So Track ID never changes "who's playing"; when nobody is tagged yet and the song's artist is on Afterglow (`trackArtistOn`, first name of a collaboration), it offers "{artist} was playing" as a one-tap tag.

## How it works

`modules/afterglow-shazam` (Swift, autolinked): `matchVideo(uri)` builds a ShazamKit signature from up to three 12-second stretches of the video's sound (middle, start, end) with `SHSignatureGenerator.signature(from:)` and asks `SHSession` (iOS 17+). Only a fingerprint of the sound goes to Apple. `src/lib/shazam.ts` wraps it (`canFindTracks`, `findTrack`); Expo Go, Android and the website have no Shazam, so the section doesn't show there (a track already on a video still shows everywhere). `features/memories/track.ts` is the pure part (checks, database fields, artist matching), tested in `features/memories/__tests__/track.test.ts`; the sheet in `src/app/__tests__/trackId.test.tsx`.

Expect matches on maybe half of festival clips: unreleased IDs, edits and mashups usually aren't in Shazam, and loud crowds hide songs.

## One-time setup (the user)

developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → app.afterglowmusic → **App Services** → tick **ShazamKit** (beside MusicKit) → Save. Without it, Shazam finds nothing.
