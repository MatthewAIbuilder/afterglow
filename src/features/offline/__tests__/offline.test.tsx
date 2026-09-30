import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineNotice } from '../OfflineNotice';
import { isOffline, NOTICE_TEXT, OFFLINE_AFTER_MS, BACK_ONLINE_MS } from '../status';

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const Notice = () => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <OfflineNotice />
  </SafeAreaProvider>
);

const network = jest.requireMock<{ __setState: (s: object) => void }>('expo-network');
const setNet = (s: object) => act(() => network.__setState(s));
const wait = (ms: number) => act(() => jest.advanceTimersByTime(ms));

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  network.__setState({ isConnected: true, isInternetReachable: true });
  jest.useRealTimers();
});

describe('offline', () => {
  it('counts as offline only when the phone says so', () => {
    expect(isOffline({ isConnected: false })).toBe(true);
    expect(isOffline({ isConnected: true, isInternetReachable: false })).toBe(true);
    expect(isOffline({ isConnected: true, isInternetReachable: true })).toBe(false);
    expect(isOffline({})).toBe(false);
  });

  it('shows the notice after a moment offline, then "Back online" briefly', async () => {
    const view = await render(<Notice />);
    expect(view.queryByText(NOTICE_TEXT.offline)).toBeNull();
    await setNet({ isConnected: false });
    await wait(OFFLINE_AFTER_MS - 100);
    expect(view.queryByText(NOTICE_TEXT.offline)).toBeNull();
    await wait(200);
    expect(view.getByText(NOTICE_TEXT.offline)).toBeTruthy();
    await setNet({ isConnected: true, isInternetReachable: true });
    await wait(10);
    expect(view.getByText(NOTICE_TEXT.back)).toBeTruthy();
    await wait(BACK_ONLINE_MS);
    expect(view.queryByText(NOTICE_TEXT.back)).toBeNull();
  });

  it('a blip shorter than the wait shows nothing', async () => {
    const view = await render(<Notice />);
    await setNet({ isConnected: false });
    await wait(1000);
    await setNet({ isConnected: true, isInternetReachable: true });
    await wait(OFFLINE_AFTER_MS + BACK_ONLINE_MS);
    expect(view.queryByText(NOTICE_TEXT.offline)).toBeNull();
    expect(view.queryByText(NOTICE_TEXT.back)).toBeNull();
  });
});
