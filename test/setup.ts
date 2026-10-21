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
  notificationAsync: () => Promise.resolve(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Soft: 'soft' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  // A plain view that also takes the player's commands (kept in `__injected`), so tests can drive it through onMessage.
  const injected: string[] = [];
  const WebView = React.forwardRef((props: object, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({ injectJavaScript: (js: string) => void injected.push(js), reload: () => {} }));
    return React.createElement(View, props);
  });
  return { WebView, __injected: injected };
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
    // This phone's push address (push.ts).
    getExpoPushTokenAsync: jest.fn(async () => ({ type: 'expo', data: 'ExponentPushToken[test-phone]' })),
  };
});

// Sharing a picture: capture and the share sheet, recorded for the tests.
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn(async () => 'file:///tmp/plan.png') }));
// Face ID: there, and says yes unless a test sets __result.
jest.mock('expo-local-authentication', () => {
  const state = { result: { success: true } as { success: boolean } };
  return {
    __state: state,
    hasHardwareAsync: jest.fn(async () => true),
    isEnrolledAsync: jest.fn(async () => true),
    authenticateAsync: jest.fn(async () => state.result),
  };
});
// Sign in with Apple: Apple's sheet answers with `__state.next` (the token stands for the person), or is cancelled when null.
jest.mock('expo-apple-authentication', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const React = jest.requireActual<typeof import('react')>('react');
  const state: { available: boolean; next: { identityToken: string; givenName?: string } | null; nonces: string[] } = { available: true, next: { identityToken: 'sam' }, nonces: [] };
  return {
    __state: state,
    AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
    AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
    AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
    isAvailableAsync: jest.fn(async () => state.available),
    signInAsync: jest.fn(async (o: { nonce?: string }) => {
      if (!state.next) throw Object.assign(new Error('cancelled'), { code: 'ERR_REQUEST_CANCELED' });
      state.nonces.push(o.nonce ?? '');
      return { user: 'apple-user', identityToken: state.next.identityToken, authorizationCode: 'code', fullName: state.next.givenName ? { givenName: state.next.givenName } : null, email: null, realUserStatus: 1, state: null };
    }),
    formatFullName: (n: { givenName?: string }) => n.givenName ?? '',
    AppleAuthenticationButton: ({ onPress }: { onPress: () => void }) =>
      React.createElement(Pressable, { onPress, accessibilityRole: 'button', accessibilityLabel: 'Continue with Apple' }, React.createElement(Text, null, 'Continue with Apple')),
  };
});
// Keeping the screen awake (the totem).
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn(), activateKeepAwakeAsync: jest.fn(async () => {}), deactivateKeepAwake: jest.fn(async () => {}) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) }));

// The secure store: an in-memory keychain the tests can read (`__items`).
// Tests read the app in English, whatever language the computer running them uses.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en', regionCode: 'US' }],
}));

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
    parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/').replace(/(?<![:/])\/{2,}/g, '/');
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
    create() {
      if (!files.has(this.uri)) files.set(this.uri, '');
    }
    write(content: string) {
      files.set(this.uri, content);
    }
    textSync() {
      return files.get(this.uri) ?? '';
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
// The camera page: permissions the tests can set (granted by default), and a camera that's ready at once,
// whose recording finishes with a file when stopped (`__lastRecording` holds the options it was started with).
jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  const perms = { camera: { granted: true, canAskAgain: true, status: 'granted' }, mic: { granted: true, canAskAgain: true, status: 'granted' } };
  const state: { lastRecording?: object; stop?: () => void } = {};
  const CameraView = React.forwardRef((props: { onCameraReady?: () => void }, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({
      recordAsync: (options: object) =>
        new Promise((resolve) => {
          state.lastRecording = options;
          state.stop = () => resolve({ uri: 'file:///cache/Camera/REC.mov' });
        }),
      stopRecording: () => state.stop?.(),
    }));
    React.useEffect(() => {
      props.onCameraReady?.();
    }, []);
    return React.createElement(View, { ...props, testID: 'camera-view' });
  });
  const hook = (key: 'camera' | 'mic') => () => {
    const [p, setP] = React.useState(perms[key]);
    const ask = async () => {
      const next = { ...perms[key], granted: true, status: 'granted' };
      perms[key] = next;
      setP(next);
      return next;
    };
    return [p, ask, ask];
  };
  return {
    CameraView,
    useCameraPermissions: hook('camera'),
    useMicrophonePermissions: hook('mic'),
    __perms: perms,
    __state: state,
  };
});
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));
// Picking files in HQ: hands back whatever a test puts in `__next` (cancelled when empty).
jest.mock('expo-document-picker', () => {
  const __state: { next: { uri: string; name: string; mimeType?: string; size?: number }[] } = { next: [] };
  return {
    __state,
    getDocumentAsync: jest.fn(async () => (__state.next.length ? { canceled: false, assets: __state.next.map((a) => ({ lastModified: 0, ...a })) } : { canceled: true, assets: null })),
  };
});
// Framing photos: records each crop and hands back a "saved" file.
jest.mock('expo-image-manipulator', () => {
  const __calls: { uri: string; actions: unknown[] }[] = [];
  return {
    __calls,
    SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
    ImageManipulator: {
      manipulate: (uri: string) => {
        const call = { uri, actions: [] as unknown[] };
        __calls.push(call);
        const ctx = {
          crop: (rect: unknown) => (call.actions.push({ crop: rect }), ctx),
          resize: (size: unknown) => (call.actions.push({ resize: size }), ctx),
          renderAsync: async () => ({ saveAsync: async (o?: { base64?: boolean }) => ({ uri: 'file:///framed.jpg', width: 1, height: 1, ...(o?.base64 ? { base64: 'QUFBQQ==' } : {}) }) }),
        };
        return ctx;
      },
    },
  };
});
// Background location (the festival trail): not granted, nothing recording, unless a test says so.
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn(), isTaskDefined: jest.fn(() => true) }));
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  ActivityType: { Fitness: 3 },
  requestBackgroundPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  getBackgroundPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  startLocationUpdatesAsync: jest.fn(async () => undefined),
  stopLocationUpdatesAsync: jest.fn(async () => undefined),
  hasStartedLocationUpdatesAsync: jest.fn(async () => false),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: false })),
  getForegroundPermissionsAsync: jest.fn(async () => ({ granted: false })),
  geocodeAsync: jest.fn(async () => []),
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
// Liquid Glass: the copy by default (as on the website); `__state.available` draws Apple's glass for a test.
jest.mock('expo-glass-effect', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const __state = { available: false };
  return {
    __state,
    GlassView: (props: object) => createElement(View, { testID: 'liquid-glass', ...props }),
    GlassContainer: View,
    isLiquidGlassAvailable: () => __state.available,
    isGlassEffectAPIAvailable: () => __state.available,
  };
});
jest.mock('expo-audio', () => ({ setAudioModeAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-video', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    VideoView: (props: object) => jest.requireActual<typeof import('react')>('react').createElement(View, { ...props, testID: 'video-view' }),
    useVideoPlayer: () => ({
      play: jest.fn(),
      pause: jest.fn(),
      loop: false,
      muted: false,
      currentTime: 0,
      duration: 0,
      timeUpdateEventInterval: 0,
      replay: jest.fn(),
      replace: jest.fn(),
      addListener: () => ({ remove: () => {} }),
    }),
  };
});

// Social profiles: never Firebase in tests. Screens get an in-memory backend that isn't set up;
// the social tests replace it with their own (fakeSocial) where profiles are available.
jest.mock('../src/features/social/services', () => ({
  defaultSocialService: () => jest.requireActual<typeof import('../src/features/social/__tests__/fakeSocial')>('../src/features/social/__tests__/fakeSocial').fakeSocial({ available: false }).service,
}));

// The network: online unless a test says otherwise (`require('expo-network').__setState({ isConnected: false })`).
jest.mock('expo-network', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  let state: { isConnected?: boolean; isInternetReachable?: boolean } = { isConnected: true, isInternetReachable: true };
  const listeners = new Set<() => void>();
  return {
    useNetworkState: () => React.useSyncExternalStore((l: () => void) => (listeners.add(l), () => listeners.delete(l)), () => state),
    __setState: (next: typeof state) => {
      state = next;
      listeners.forEach((l) => l());
    },
  };
});

// The phone's own New Event screen: in tests it "saves" straight away, and remembers what it was given.
jest.mock('expo-calendar/legacy', () => ({
  createEventInCalendarAsync: jest.fn(async () => ({ action: 'saved', id: 'event-1' })),
}));

// Tests use the bundled catalogue only, never the hosted one.
jest.mock('../src/config/data', () => ({ ...(jest.requireActual('../src/config/data') as object), CATALOG_URL: '' }));
// Steps: a phone with a motion counter, allowed, 4,210 steps tonight; `__state.allowed = false` asks first.
jest.mock('expo-sensors', () => {
  const state = { allowed: true, steps: 4210 };
  const accel = new Set<CallableFunction>();
  return {
    __state: state,
    /** Send an accelerometer reading to whoever listens (in g). */
    __accel: (reading: object) => accel.forEach((l) => l(reading)),
    Accelerometer: {
      isAvailableAsync: jest.fn(async () => true),
      setUpdateInterval: jest.fn(),
      addListener: jest.fn((l: CallableFunction) => {
        accel.add(l);
        return { remove: () => accel.delete(l) };
      }),
    },
    DeviceMotion: {
      isAvailableAsync: jest.fn(async () => false),
      getPermissionsAsync: jest.fn(async () => ({ granted: false })),
      setUpdateInterval: jest.fn(),
      addListener: jest.fn(() => ({ remove: () => {} })),
    },
    Pedometer: {
      isAvailableAsync: jest.fn(async () => true),
      getPermissionsAsync: jest.fn(async () => ({ granted: state.allowed, canAskAgain: true, status: state.allowed ? 'granted' : 'undetermined' })),
      requestPermissionsAsync: jest.fn(async () => {
        state.allowed = true;
        return { granted: true, canAskAgain: true, status: 'granted' };
      }),
      getStepCountAsync: jest.fn(async () => ({ steps: state.steps })),
      watchStepCount: jest.fn(() => ({ remove: () => {} })),
    },
  };
});


// Native maps (the festival map on phones): a plain view that remembers the camera moves asked of it.
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  const calls: { method: string; args: unknown[] }[] = [];
  const MapView = React.forwardRef((props: { children?: unknown; onMapReady?: () => void; testID?: string }, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({
      fitToCoordinates: (...args: unknown[]) => calls.push({ method: 'fitToCoordinates', args }),
      animateToRegion: (...args: unknown[]) => calls.push({ method: 'animateToRegion', args }),
      animateCamera: (...args: unknown[]) => calls.push({ method: 'animateCamera', args }),
    }));
    React.useEffect(() => {
      props.onMapReady?.();
      // Only on mount, like the real map.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return React.createElement(View, { ...props, testID: props.testID ?? 'native-map' }, props.children);
  });
  const Marker = (props: { children?: unknown; onPress?: () => void }) => React.createElement(Pressable, { onPress: props.onPress }, props.children);
  const Nothing = () => null;
  return { __esModule: true, default: MapView, Marker, Polyline: Nothing, Circle: Nothing, __calls: calls };
});
