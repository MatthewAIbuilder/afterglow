import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { feedIsLive } from './playback';

/** True while Discover is the screen you're looking at and the app is in the foreground. */
export function useFeedLive() {
  const focused = useIsFocused();
  const [appState, setAppState] = useState<string>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState);
    return () => sub.remove();
  }, []);
  return feedIsLive(focused, appState);
}
