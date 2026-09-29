import * as SecureStore from 'expo-secure-store';

/**
 * Where music-service credentials live: the phone's secure store (the iOS
 * Keychain, Android's Keystore), never AsyncStorage. Kept on this device
 * only (not in backups) and readable only while the phone is unlocked.
 * Nothing that goes through here is ever logged.
 */
export type SecretStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const secureSecrets: SecretStore = {
  get: (key) => SecureStore.getItemAsync(key, OPTIONS),
  set: (key, value) => SecureStore.setItemAsync(key, value, OPTIONS),
  remove: (key) => SecureStore.deleteItemAsync(key, OPTIONS),
};

/** Secure-store keys, one per service. */
export const SECRET_KEY = {
  spotify: 'afterglow.music.spotify',
  'apple-music': 'afterglow.music.apple-music',
} as const;
