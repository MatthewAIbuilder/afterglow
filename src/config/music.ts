/**
 * Music connections: the one-time developer setup for Apple Music (Spotify
 * needs none: it's added by playlist link). Nothing
 * secret lives here or anywhere in the app (see docs/music-integrations.md).
 *
 * Values come from environment variables at build time (a local `.env` file,
 * which git ignores, or EAS environment variables). Empty means that service
 * isn't set up in this build, and the app says so instead of offering Connect.
 */

/**
 * Apple Music: an https link to a small service you host that returns a
 * MusicKit developer token as `{ "token": "..." }`. The token is signed with
 * a private MusicKit key, which must never be put in the app, so the app
 * only ever fetches the signed token.
 */
export const APPLE_MUSIC_TOKEN_URL: string = process.env.EXPO_PUBLIC_APPLE_MUSIC_TOKEN_URL ?? '';

/** A connected library is read again when the app opens, once it's older than this. */
export const MUSIC_RESYNC_MS = 24 * 60 * 60 * 1000;
