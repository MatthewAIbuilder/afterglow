import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json holds the app's settings. This adds one thing on top, only when
 * it's needed: if Spotify's redirect is an https universal link (set with
 * EXPO_PUBLIC_SPOTIFY_REDIRECT_URI because Spotify's dashboard refused the
 * afterglow:// scheme), the app declares that it opens links on that domain,
 * so the sign-in can come back to it. With the default redirect this changes
 * nothing. See docs/spotify-setup.md.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const redirect = process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI?.trim() ?? '';
  const link = /^https:\/\/([a-z0-9.-]+\.[a-z]{2,})(\/[A-Za-z0-9._~\-/]*)?$/i.exec(redirect);
  if (!link) return config as ExpoConfig;
  const [, host, path = '/'] = link;
  return {
    ...config,
    ios: {
      ...config.ios,
      associatedDomains: [...(config.ios?.associatedDomains ?? []), `applinks:${host}`],
    },
    android: {
      ...config.android,
      intentFilters: [
        ...(config.android?.intentFilters ?? []),
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host, pathPrefix: path }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
  } as ExpoConfig;
};
