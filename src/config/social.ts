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
