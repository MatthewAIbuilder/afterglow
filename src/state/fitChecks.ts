import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { cleanFits, type FitCheck, fitKey, keepFit, removeFit } from '../features/fitCheck/fitCheck';
import { dropFitPhoto, keepFitPhoto } from '../features/fitCheck/fitPhoto';

/**
 * Your fit checks, kept on this phone (`fitChecks.v1`, per account; the
 * photos in the app's own folder, so they stay when the picker's copy goes).
 * On the website they last only while the page is open.
 */
export const FITS_KEY = 'fitChecks.v1';

let cache: FitCheck[] | undefined;
let loading: Promise<FitCheck[]> | undefined;
const listeners = new Set<() => void>();

function load(): Promise<FitCheck[]> {
  if (cache) return Promise.resolve(cache);
  loading ??= AsyncStorage.getItem(FITS_KEY)
    .then((raw) => cleanFits(raw ? JSON.parse(raw) : []))
    .catch(() => [] as FitCheck[])
    .then((list) => {
      cache ??= list;
      loading = undefined;
      return cache;
    });
  return loading;
}

function save(next: FitCheck[]) {
  cache = next;
  listeners.forEach((l) => l());
  // A browser's photos don't outlive the page, so nothing is kept there.
  if (Platform.OS !== 'web') void AsyncStorage.setItem(FITS_KEY, JSON.stringify(next)).catch(() => {});
}

export function forgetFitChecks() {
  cache = undefined;
  loading = undefined;
}

export function useFitChecks() {
  const [list, setList] = useState<FitCheck[] | undefined>(cache);
  useEffect(() => {
    let live = true;
    const l = () => live && setList(cache);
    listeners.add(l);
    void load().then(l);
    return () => {
      live = false;
      listeners.delete(l);
    };
  }, []);
  const add = useCallback(async (fit: Omit<FitCheck, 'uri'> & { uri: string }) => {
    const all = await load();
    const was = all.find((f) => fitKey(f) === fitKey(fit));
    const uri = await keepFitPhoto(fit.uri, `${fit.festivalId}-${fit.date}-${fit.at}`);
    save(keepFit(all, { ...fit, uri }));
    if (was && was.uri !== uri) dropFitPhoto(was.uri);
    return uri;
  }, []);
  const markSent = useCallback(async (key: string) => {
    const all = await load();
    save(all.map((f) => (fitKey(f) === key ? { ...f, sent: true } : f)));
  }, []);
  const remove = useCallback(async (key: string) => {
    const all = await load();
    const was = all.find((f) => fitKey(f) === key);
    save(removeFit(all, key));
    if (was) dropFitPhoto(was.uri);
  }, []);
  return { fits: list ?? [], loaded: !!list, add, markSent, remove };
}
