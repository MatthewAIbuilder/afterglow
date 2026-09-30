import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { color } from '../theme/tokens';

/**
 * Where a music service's sign-in page sends you back (afterglow://music-auth).
 * The sign-in sheet reads the answer itself; if the link also reaches the
 * app's navigation (it can on Android), this steps straight back to where
 * you were.
 */
export default function MusicAuthReturn() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/music');
  }, []);
  return <View style={{ flex: 1, backgroundColor: color.night }} />;
}
