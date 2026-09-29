import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'welcomed.v1';

/**
 * Whether you've been through (or past) the first-run welcome, saved on the
 * device. `welcomed` is undefined until the saved answer has loaded.
 */
export function useWelcomed() {
  const [welcomed, setWelcomed] = useState<boolean | undefined>();
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => setWelcomed((current) => current || raw === 'true'))
      .catch(() => setWelcomed((current) => current ?? false));
  }, []);
  const markWelcomed = useCallback(() => {
    setWelcomed(true);
    AsyncStorage.setItem(STORAGE_KEY, 'true').catch(() => {});
  }, []);
  return { welcomed, markWelcomed };
}
