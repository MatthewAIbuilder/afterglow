/**
 * Music connections: the one-time developer setup for each service. Nothing
 * secret lives here or anywhere in the app (see docs/music-integrations.md).
 *
 * Values come from environment variables at build time (a local `.env` file,
 * which git ignores, or EAS environment variables). Empty means that service
 * isn't set up in this build, and the app says so instead of offering Connect.
 */

/**
 * Spotify: the Client ID of the app registered at developer.spotify.com.
 * Public by design (Authorization Code with PKCE: no client secret exists in
 * the app). Its Redirect URI must list MUSIC_REDIRECT (below).
 */
export const SPOTIFY_CLIENT_ID: string = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';

/**
 * Apple Music: an https link to a small service you host that returns a
 * MusicKit developer token as `{ "token": "..." }`. The token is signed with
 * a private MusicKit key, which must never be put in the app, so the app
 * only ever fetches the signed token.
 */
export const APPLE_MUSIC_TOKEN_URL: string = process.env.EXPO_PUBLIC_APPLE_MUSIC_TOKEN_URL ?? '';

/** Where a service sends you back after signing in: afterglow://music-auth (the app's scheme in app.json). */
export const MUSIC_REDIRECT = { scheme: 'afterglow', path: 'music-auth' } as const;

/** A connected library is read again when the app opens, once it's older than this. */
export const MUSIC_RESYNC_MS = 24 * 60 * 60 * 1000;
