/**
 * Social profiles: the Firebase project the app talks to. These values are
 * public by design (every Firebase app ships them); access is controlled by
 * the security rules in firestore.rules and storage.rules, never by hiding
 * them. They come from environment variables at build time (`.env`, or EAS
 * environment variables). Empty means profiles aren't set up in this build,
 * and the app says so instead of offering sign-in. See docs/firebase-setup.md.
 */
export const FIREBASE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

/** Everything profiles need is filled in. */
export const firebaseConfigured = (c: typeof FIREBASE_CONFIG = FIREBASE_CONFIG) => !!(c.apiKey && c.projectId && c.appId && c.storageBucket);
