import * as SecureStore from 'expo-secure-store';

/**
 * Passwords for accounts saved for quick switching: only in the phone's
 * keychain (iOS Keychain, Android Keystore), on this device only and while
 * it's unlocked, never in AsyncStorage, never sent anywhere, never logged.
 */
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const key = (uid: string) => `afterglow.account.${uid.replace(/[^A-Za-z0-9._-]/g, '_')}`;

/** Phones keep passwords; the website asks each time. */
export const KEEPS_PASSWORDS = true;

export const readPassword = (uid: string) => SecureStore.getItemAsync(key(uid), OPTIONS).catch(() => null);
export const savePassword = (uid: string, password: string) => SecureStore.setItemAsync(key(uid), password, OPTIONS);
export const forgetPassword = (uid: string) => SecureStore.deleteItemAsync(key(uid), OPTIONS).catch(() => {});
