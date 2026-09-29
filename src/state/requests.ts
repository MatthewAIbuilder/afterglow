import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { cleanRequests } from '../features/festivals/request';

const STORAGE_KEY = 'festivalRequests.v1';

/** Festivals you've asked for, saved on the device (so the app can say you already did). */
export function useRequests() {
  const [requests, setRequests] = useState<{ name: string; at: number }[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => (raw ? cleanRequests(JSON.parse(raw)) : []))
      .catch(() => [])
      .then((stored) => setRequests((current) => [...stored, ...current]));
  }, []);

  const add = useCallback((name: string) => {
    setRequests((current) => {
      const next = cleanRequests([...current, { name, at: Date.now() }]);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return { requests, add };
}
