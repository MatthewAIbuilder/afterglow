import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { cleanClaims } from '../../features/profile/milestones';
import { forgetBadgeClaims, useBadgeClaims } from '../badgeClaims';

beforeEach(async () => {
  await AsyncStorage.clear();
  forgetBadgeClaims();
});

describe('claimed badges', () => {
  it('keeps every kind of claim when read back', () => {
    const keys = ['pin:edc-orlando-2026', 'pin:underground-alchemy--abc123XYZ', 'ms:first-festival', 'past:edc-orlando-2024'];
    expect(cleanClaims([...keys, 7, 'nonsense', 'pin:', 'past:has space'])).toEqual(keys);
  });

  it('stay claimed after the app starts again (a reload, signing back in)', async () => {
    const first = await renderHook(() => useBadgeClaims());
    await waitFor(() => expect(first.result.current.claimed).toBeDefined());
    await act(async () => {
      first.result.current.claim('past:edc-orlando-2024');
      first.result.current.claim('pin:edc-orlando-2026');
      first.result.current.claim('ms:first-festival');
    });
    await first.unmount();

    // The app starts over: the store reads what's saved on the phone.
    forgetBadgeClaims();
    const again = await renderHook(() => useBadgeClaims());
    await waitFor(() => expect(again.result.current.claimed).toBeDefined());
    expect([...(again.result.current.claimed ?? [])].sort()).toEqual(['ms:first-festival', 'past:edc-orlando-2024', 'pin:edc-orlando-2026']);
  });
});
