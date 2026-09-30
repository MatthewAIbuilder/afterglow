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
jest.mock('expo-web-browser', () => ({
  WebBrowserResultType: { CANCEL: 'cancel', DISMISS: 'dismiss' },
  maybeCompleteAuthSession: () => ({ type: 'failed' }),
  openAuthSessionAsync: jest.fn(async () => ({ type: 'cancel' })),
}));

// Memories: files, picker, location, Photos, stills and the video player, all in memory.
jest.mock('expo-file-system', () => {
  const files = new Map<string, string>();
  const join = (...parts: unknown[]) =>
    parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/').replace(/\/+/g, '/').replace(':/', '://');
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(...parts);
    }
    get exists() {
      return files.has(this.uri);
    }
    async copy(dest: File) {
      files.set(dest.uri, files.get(this.uri) ?? 'video');
    }
    async move(dest: File) {
      files.set(dest.uri, files.get(this.uri) ?? 'still');
      files.delete(this.uri);
    }
    delete() {
      files.delete(this.uri);
    }
  }
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(...parts);
    }
    get exists() {
      return true;
    }
    create() {}
    list() {
      return [...files.keys()].filter((k) => k.startsWith(`${this.uri}/`)).map((k) => new File(k));
    }
  }
  return { __files: files, File, Directory, Paths: { document: new Directory('file:///docs'), cache: new Directory('file:///cache') } };
});
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: false })),
  getLastKnownPositionAsync: jest.fn(async () => null),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 0, longitude: 0 } })),
  reverseGeocodeAsync: jest.fn(async () => []),
}));
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  Asset: Object.assign(
    jest.fn().mockImplementation(() => ({ getCreationTime: async () => null, getLocation: async () => null })),
    { create: jest.fn(async () => ({})) },
  ),
}));
jest.mock('expo-video-thumbnails', () => ({ getThumbnailAsync: jest.fn(async () => ({ uri: 'file:///cache/still.jpg', width: 90, height: 160 })) }));
jest.mock('expo-video', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    VideoView: (props: object) => jest.requireActual<typeof import('react')>('react').createElement(View, { ...props, testID: 'video-view' }),
    useVideoPlayer: () => ({ play: jest.fn(), pause: jest.fn(), loop: false, muted: false, replace: jest.fn() }),
  };
});

// Social profiles: never Firebase in tests. Screens get an in-memory backend that isn't set up;
// the social tests replace it with their own (fakeSocial) where profiles are available.
jest.mock('../src/features/social/services', () => ({
  defaultSocialService: () => jest.requireActual<typeof import('../src/features/social/__tests__/fakeSocial')>('../src/features/social/__tests__/fakeSocial').fakeSocial({ available: false }).service,
}));
