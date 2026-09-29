import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export type FestivalsView = 'list' | 'grid';
const STORAGE_KEY = 'festivalsView.v1';

/** Cards or tiles on the Festivals tab, remembered on the device. */
export function useFestivalsView() {
  const [view, setView] = useState<FestivalsView>('list');
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw === 'grid' || raw === 'list') setView(raw);
      })
      .catch(() => {});
  }, []);
  const change = useCallback((next: FestivalsView) => {
    setView(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);
  return { view, setView: change };
}
