import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { VERSION_LINE } from '../../lib/version';
import { useSocial } from '../../state/social';
import { cleanAsked, HQ_ASKED_KEY, HQ_ASKED_MAX, hqRequests } from './hqRequests';
import type { MemoryTagInput } from './models';

/**
 * Sends HQ the requests a video's tags call for (a new past festival's
 * badge, a new artist), by itself and quietly: signed in only, each once
 * per phone, never in the way of saving the video.
 */
export function useHqRequests() {
  const social = useSocial();
  const { service, user, availability } = social;
  return useCallback(
    async (tag: MemoryTagInput) => {
      if (!user || !availability.ok) return;
      try {
        const asked = cleanAsked(JSON.parse((await AsyncStorage.getItem(HQ_ASKED_KEY)) ?? '[]'));
        const due = hqRequests(tag, asked);
        if (!due.length) return;
        const sent: string[] = [];
        for (const r of due) {
          await service
            .contactSupport({ topic: r.topic, text: r.text, platform: Platform.OS, version: VERSION_LINE })
            .then(() => sent.push(r.key))
            .catch(() => {});
        }
        if (sent.length) await AsyncStorage.setItem(HQ_ASKED_KEY, JSON.stringify([...asked, ...sent].slice(-HQ_ASKED_MAX)));
      } catch {
        // Never in the way: it's asked again next time.
      }
    },
    [service, user, availability.ok],
  );
}
