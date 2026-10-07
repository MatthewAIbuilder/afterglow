import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'notForMeTip.v1';

/**
 * Whether Discover has explained what Not for me does: once, the first time
 * you tap it, so you know your no counts for your feed.
 */
let shown: boolean | undefined;
let loading: Promise<boolean> | undefined;

/**
 * True the first time it's asked on this phone (and marks it shown);
 * false ever after, or when the phone can't say.
 */
export async function takeNotForMeTip(): Promise<boolean> {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => raw === '1')
    .catch(() => true);
  const before = shown ?? (await loading);
  if (before || shown) return false;
  shown = true;
  AsyncStorage.setItem(STORAGE_KEY, '1').catch(() => {});
  return true;
}

/** For tests: forget what's loaded. */
export function forgetNotForMeTip() {
  shown = undefined;
  loading = undefined;
}
