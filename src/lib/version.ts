import Constants from 'expo-constants';
import { APP_NAME } from '../config/app';

/**
 * Which version this is, for the line at the bottom of Profile: the app's
 * version, plus the build the website was deployed from (set as
 * EXPO_PUBLIC_BUILD_ID by the deploy, the commit it was built from).
 */
export function versionLine(version: string | undefined, build: string | undefined) {
  const v = version ? `${APP_NAME} ${version}` : APP_NAME;
  return build ? `${v} · build ${build.slice(0, 7)}` : v;
}

export const VERSION_LINE = versionLine(Constants.expoConfig?.version, process.env.EXPO_PUBLIC_BUILD_ID);
