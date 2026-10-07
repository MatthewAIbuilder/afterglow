import { useKeepAwake } from 'expo-keep-awake';

/** Keeps the screen on while the caller is shown (the totem). */
export function useScreenOn() {
  useKeepAwake('afterglow-totem');
}
