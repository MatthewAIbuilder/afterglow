import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { color } from '../theme/tokens';
import { goBack } from '../lib/nav';

/**
 * Where Google's sign-in comes back to the app (afterglow://google-auth,
 * passed on by the website's google-auth page). The sign-in sheet reads the
 * answer itself; if the link also reaches the app's navigation (it can on
 * Android), this steps straight back to where you were.
 */
export default function GoogleAuthReturn() {
  useEffect(() => {
    if (router.canGoBack()) goBack();
    else router.replace('/');
  }, []);
  return <View style={{ flex: 1, backgroundColor: color.night }} />;
}
