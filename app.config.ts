import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json holds the app's settings; this passes them through unchanged. (It
 * once added a universal link for Spotify's sign-in, which Afterglow no longer
 * has: Spotify is added by playlist link.) Because this file exists, config
 * plugins go into app.json's `plugins` by hand.
 */
export default ({ config }: ConfigContext): ExpoConfig => config as ExpoConfig;
