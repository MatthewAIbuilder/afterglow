/**
 * Social profiles: the Firebase project the app talks to. These values are
 * public by design (every Firebase app ships them); access is controlled by
 * the security rules in firestore.rules and storage.rules, never by hiding
 * them. Environment variables (`.env`, EAS, or the website build's GitHub
 * variables) win when set; otherwise the app uses Afterglow's own project
 * (`afterglowmusic`), so every build, the website included, has accounts.
 * See docs/firebase-setup.md.
 */
const AFTERGLOW_FIREBASE = {
  apiKey: 'AIzaSyAkLBeCZNuuYFXUF9EYyEcCJ5WR7dinE6E',
  authDomain: 'afterglowmusic.firebaseapp.com',
  projectId: 'afterglowmusic',
  storageBucket: 'afterglowmusic.firebasestorage.app',
  messagingSenderId: '25740581285',
  appId: '1:25740581285:web:76651f884f3a1232a2b04c',
};

// `||`, not `??`: a CI variable that isn't set arrives as an empty string.
export const FIREBASE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || AFTERGLOW_FIREBASE.apiKey,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || AFTERGLOW_FIREBASE.authDomain,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || AFTERGLOW_FIREBASE.projectId,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || AFTERGLOW_FIREBASE.storageBucket,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || AFTERGLOW_FIREBASE.messagingSenderId,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || AFTERGLOW_FIREBASE.appId,
};

/** Everything profiles need is filled in. */
export const firebaseConfigured = (c: typeof FIREBASE_CONFIG = FIREBASE_CONFIG) => !!(c.apiKey && c.projectId && c.appId && c.storageBucket);

/**
 * Sign in with Apple and with Google (docs/sign-in-providers.md). Each stays
 * hidden until it's switched on in the Firebase console, so a button never
 * leads to "not allowed".
 *
 * - `APPLE_SIGN_IN`: on once Apple is switched on in Firebase (Authentication →
 *   Sign-in method). iPhone only (the build has the Sign in with Apple capability).
 * - `APPLE_ON_WEB`: the website too, which needs an Apple Services ID and key in
 *   Firebase as well.
 * - `GOOGLE_WEB_CLIENT_ID`: the "Web client ID" Firebase shows under Google →
 *   Web SDK configuration once Google is switched on. Public by design. Empty
 *   hides "Continue with Google" everywhere.
 */
// Apple was switched on in Firebase on 2026-10-21. Only builds from 1.0.5 have the capability, and this code only reaches them.
export const APPLE_SIGN_IN = true;
export const APPLE_ON_WEB = false;
// Afterglow's web client (Firebase → Google → Web SDK configuration), sent by the user on 2026-10-21.
export const GOOGLE_WEB_CLIENT_ID: string = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '25740581285-s3k5c9s1frah414hm5vsah5em2mgdjnf.apps.googleusercontent.com';
