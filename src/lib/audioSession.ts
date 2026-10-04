import { setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

let done = false;

/**
 * Let Discover's clips play with sound on an iPhone whose silent switch is on,
 * like crowd videos already do (expo-video sets the same session), so a
 * YouTube clip never starts silent just because no crowd video has played
 * yet. Once, when Discover first shows: opening the app to plan doesn't stop
 * your music. Not on the website.
 */
export function allowClipSound(): void {
  if (done || Platform.OS === 'web') return;
  done = true;
  setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'doNotMix' }).catch(() => {
    done = false;
  });
}
