import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as ExpoCamera from 'expo-camera';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { State } from 'react-native-gesture-handler';
import { renderApp } from './appRoutes';

/** The camera page: opened from Discover, tap or hold to record, then the tagging sheet. */
const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 8; i++) await settle();
};
const camera = ExpoCamera as unknown as {
  __perms: { camera: { granted: boolean; canAskAgain: boolean; status: string } };
  __state: { lastRecording?: { maxDuration?: number } };
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  camera.__perms.camera = { granted: true, canAskAgain: true, status: 'granted' };
});
afterEach(() => {
  jest.restoreAllMocks();
});

async function openCamera() {
  const app = await renderApp('/');
  await flush();
  await fireEvent.press(app.getByLabelText('Open the camera to film a memory'));
  await flush();
  return app;
}

describe('the camera', () => {
  it('opens from Discover’s camera button, live and ready', async () => {
    const app = await openCamera();
    expect(app.getByTestId('camera-view')).toBeTruthy();
    expect(app.getByText('New memory')).toBeTruthy();
    expect(app.getByText('Tap to record · hold to film while you hold')).toBeTruthy();
  });

  it('opens with a swipe right on Discover, but not a short one', async () => {
    const app = await renderApp('/');
    await flush();
    const swipe = (dx: number) =>
      act(async () =>
        fireGestureHandler(getByGestureTestId('swipe-to-camera'), [
          { state: State.BEGAN, translationX: 0, velocityX: 0 },
          { state: State.ACTIVE, translationX: dx / 2, velocityX: 100 },
          { state: State.END, translationX: dx, velocityX: 100 },
        ]),
      );
    await swipe(40);
    await flush();
    expect(app.queryByTestId('camera-view')).toBeNull();
    await swipe(300);
    await flush();
    expect(app.getByTestId('camera-view')).toBeTruthy();
  });

  it('hold: films while held, then tags the video', async () => {
    const app = await openCamera();
    await fireEvent(app.getByLabelText('Record a video'), 'pressIn');
    await settle(1500);
    expect(app.getByText('Filming while you hold · slide away to lock')).toBeTruthy();
    expect(app.getByLabelText(/^Recording, 0:01$/)).toBeTruthy();
    await fireEvent(app.getByLabelText('Stop recording'), 'pressOut');
    await flush();
    expect(camera.__state.lastRecording).toEqual({ maxDuration: 60 });
    // The tagging sheet took the camera's place.
    expect(app.getByLabelText('Save to Memories')).toBeTruthy();
    expect(app.queryByTestId('camera-view')).toBeNull();
  });

  it('slide away while holding: locks, keeps filming after you let go, and a tap stops', async () => {
    const app = await openCamera();
    const at = (x: number, y: number) => ({ nativeEvent: { pageX: x, pageY: y } });
    await fireEvent(app.getByLabelText('Record a video'), 'pressIn', at(200, 700));
    await settle(500);
    // Not far enough yet.
    await fireEvent(app.getByLabelText('Stop recording'), 'touchMove', at(170, 690));
    expect(app.getByText('Filming while you hold · slide away to lock')).toBeTruthy();
    // Any direction: here, up and to the left.
    await fireEvent(app.getByLabelText('Stop recording'), 'touchMove', at(150, 620));
    expect(app.getByText('Locked · tap to stop')).toBeTruthy();
    await fireEvent(app.getByLabelText('Stop recording'), 'pressOut');
    await settle(3000);
    expect(app.getByText('Locked · tap to stop')).toBeTruthy();
    expect(app.queryByLabelText('Save to Memories')).toBeNull();
    await fireEvent(app.getByLabelText('Stop recording'), 'pressIn', at(200, 700));
    await fireEvent(app.getByLabelText('Stop recording'), 'pressOut');
    await flush();
    expect(app.getByLabelText('Save to Memories')).toBeTruthy();
  });

  it('tap: keeps filming after you let go, and the next tap stops', async () => {
    const app = await openCamera();
    await fireEvent(app.getByLabelText('Record a video'), 'pressIn');
    await settle(100);
    await fireEvent(app.getByLabelText('Stop recording'), 'pressOut');
    await settle(3000);
    expect(app.getByText('Tap to stop')).toBeTruthy();
    await fireEvent(app.getByLabelText('Stop recording'), 'pressIn');
    await fireEvent(app.getByLabelText('Stop recording'), 'pressOut');
    await flush();
    expect(app.getByLabelText('Save to Memories')).toBeTruthy();
  });

  it('a slip of the finger isn’t a clip', async () => {
    const app = await openCamera();
    await fireEvent(app.getByLabelText('Record a video'), 'pressIn');
    await settle(400);
    await fireEvent(app.getByLabelText('Stop recording'), 'pressOut');
    await flush();
    expect(app.getByText('Hold a little longer to film.')).toBeTruthy();
    expect(app.queryByLabelText('Save to Memories')).toBeNull();
  });

  it('closing mid-recording keeps nothing', async () => {
    const app = await openCamera();
    await fireEvent(app.getByLabelText('Record a video'), 'pressIn');
    await settle(100);
    await fireEvent(app.getByLabelText('Stop recording'), 'pressOut');
    await settle(2000);
    await fireEvent.press(app.getByLabelText('Close the camera'));
    await flush();
    expect(app.queryByTestId('camera-view')).toBeNull();
    expect(app.queryByLabelText('Save to Memories')).toBeNull();
  });

  it('asks for the camera first, explaining why', async () => {
    camera.__perms.camera = { granted: false, canAskAgain: true, status: 'undetermined' };
    const app = await renderApp('/');
    await flush();
    await act(async () => router.push('/camera'));
    await flush();
    expect(app.getByText('Film your festival')).toBeTruthy();
    expect(app.queryByTestId('camera-view')).toBeNull();
    await fireEvent.press(app.getByText('Allow camera'));
    await flush();
    expect(app.getByTestId('camera-view')).toBeTruthy();
  });

  it('says where to turn it on once it’s been refused', async () => {
    camera.__perms.camera = { granted: false, canAskAgain: false, status: 'denied' };
    const app = await renderApp('/');
    await flush();
    await act(async () => router.push('/camera'));
    await flush();
    expect(app.getByLabelText('Camera access is off. Open Settings to allow it.')).toBeTruthy();
  });
});
