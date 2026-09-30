/* Jest setup for screen tests: native modules the test environment doesn't have. */
import { jest } from '@jest/globals';
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import 'react-native-gesture-handler/jestSetup';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));

// Reanimated's own mock, with the few functions this app uses that it leaves out. Patched at the mock's own path,
// because expo-router's testing library re-mocks reanimated with that module.
jest.mock('react-native-reanimated/mock', () => {
  const mock = jest.requireActual<Record<string, any>>('react-native-reanimated/mock');
  const React = require('react');
  const { View } = require('react-native');
  const value = (v: unknown) => {
    const sv = {
      value: v,
      get: () => sv.value,
      set: (n: unknown) => {
        sv.value = typeof n === 'function' ? n(sv.value) : n;
      },
    };
    return sv;
  };
  const extras: Record<string, unknown> = {
    useReducedMotion: () => false,
    useFrameCallback: () => ({ setActive: () => {}, isActive: false }),
    useAnimatedRef: () => React.useRef(null),
    useAnimatedScrollHandler: () => () => {},
    useAnimatedReaction: () => {},
    useSharedValue: (v: unknown) => React.useState(() => value(v))[0],
    runOnJS: (fn: (...a: unknown[]) => unknown) => fn,
    runOnUI: (fn: (...a: unknown[]) => unknown) => fn,
    scrollTo: () => {},
    withDecay: () => 0,
    withRepeat: (v: unknown) => v,
    LayoutAnimationConfig: ({ children }: { children: unknown }) => children,
  };
  const out: Record<string, any> = { ...mock, default: { ...(mock.default ?? {}) } };
  for (const [k, v] of Object.entries(extras)) if (typeof out[k] !== 'function' || k === 'useSharedValue') out[k] = v;
  if (!out.default.View) out.default.View = View;
  return out;
});
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('expo-haptics', () => ({
  selectionAsync: () => Promise.resolve(),
  impactAsync: () => Promise.resolve(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Soft: 'soft' },
}));
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return { WebView: View };
});

// Local notifications: an in-memory schedule the tests can read, with permission granted.
jest.mock('expo-notifications', () => {
  const scheduled = new Map<string, unknown>();
  return {
    __scheduled: scheduled,
    SchedulableTriggerInputTypes: { DATE: 'date' },
    setNotificationHandler: jest.fn(),
    getPermissionsAsync: jest.fn(async () => ({ status: 'granted', canAskAgain: true })),
    requestPermissionsAsync: jest.fn(async () => ({ status: 'granted', canAskAgain: true })),
    getAllScheduledNotificationsAsync: jest.fn(async () => [...scheduled.keys()].map((identifier) => ({ identifier }))),
    cancelScheduledNotificationAsync: jest.fn(async (id: string) => void scheduled.delete(id)),
    scheduleNotificationAsync: jest.fn(async (req: { identifier: string }) => {
      scheduled.set(req.identifier, req);
      return req.identifier;
    }),
    useLastNotificationResponse: () => undefined,
  };
});

// Sharing a picture: capture and the share sheet, recorded for the tests.
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn(async () => 'file:///tmp/plan.png') }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) }));

// The secure store: an in-memory keychain the tests can read (`__items`).
jest.mock('expo-secure-store', () => {
  const items = new Map<string, string>();
  return {
    __items: items,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    getItemAsync: jest.fn(async (k: string) => items.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void items.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void items.delete(k)),
  };
});
// Sign-in pages never open in tests: tests that connect a service pass their own services.
jest.mock('expo-auth-session', () => ({
  AuthRequest: jest.fn(),
  makeRedirectUri: () => 'afterglow://music-auth',
  ResponseType: { Code: 'code' },
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: () => ({ type: 'failed' }) }));
