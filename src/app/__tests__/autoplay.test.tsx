import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderApp } from './appRoutes';

/** Autoplay in Discover: watch the clip on screen to its end and the next one is lined up, unless you stay. */
const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 8; i++) await settle();
};
const UP_NEXT = /^Next clip in \d seconds?\. Tap to stay on this one\.$/;

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

/** Open Discover and play the clip on screen to its last second, as the YouTube player would report it. */
async function watchToTheEnd() {
  const app = await renderApp('/');
  await flush();
  const web = app.getAllByLabelText('Live set video')[0];
  const html = String(web.props.source.html);
  const start = Number(html.match(/"start":(\d+(?:\.\d+)?)/)![1]);
  const end = Number(html.match(/"end":(\d+(?:\.\d+)?)/)![1]);
  const say = (m: object) => act(async () => web.props.onMessage({ nativeEvent: { data: JSON.stringify(m) } }));
  await say({ type: 'ready' });
  await say({ type: 'state', state: 1 });
  await say({ type: 'time', time: end - 1.2 });
  await say({ type: 'time', time: end - 0.3 });
  await flush();
  return { app, start, end, say };
}

describe('sound', () => {
  it('Discover plays with sound on a silenced iPhone, and the clip on screen starts unmuted', async () => {
    const injected = jest.requireMock<{ __injected: string[] }>('react-native-webview').__injected;
    injected.length = 0;
    const audio = jest.requireMock<{ setAudioModeAsync: jest.Mock }>('expo-audio');
    await watchToTheEnd();
    expect(audio.setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: true, interruptionMode: 'doNotMix' });
    // YouTube remembers a mute across players: coming on screen unmutes before it plays.
    expect(injected).toContain('window.afterglow && window.afterglow.restart(true, true); true;');
  });
});

describe('playing the next clip', () => {
  it('counts down once a clip is watched to the end, then moves on without counting a skip', async () => {
    const { app } = await watchToTheEnd();
    expect(app.getByLabelText(UP_NEXT)).toBeTruthy();
    expect(app.getByText(/^Next clip in 3/)).toBeTruthy();
    await settle(1000);
    expect(app.getByText(/^Next clip in 2/)).toBeTruthy();
    await settle(1000);
    await settle(1000);
    await settle(100);
    expect(app.queryByLabelText(UP_NEXT)).toBeNull();
    const reactions = JSON.parse((await AsyncStorage.getItem('reactions.v1')) ?? '{}');
    expect(Object.values(reactions).some((r) => (r as { skipped?: boolean }).skipped)).toBe(false);
  });

  it('Stay keeps the clip looping', async () => {
    const { app, start, end, say } = await watchToTheEnd();
    await fireEvent.press(app.getByLabelText(UP_NEXT));
    expect(app.queryByLabelText(UP_NEXT)).toBeNull();
    // It loops and plays to the end again: still no countdown on this visit.
    await say({ type: 'time', time: start + 1 });
    await say({ type: 'time', time: end - 1.2 });
    await say({ type: 'time', time: end - 0.3 });
    await flush();
    expect(app.queryByLabelText(UP_NEXT)).toBeNull();
  });

  it('can be switched off', async () => {
    await AsyncStorage.setItem('autoplay.v1', 'false');
    const { app } = await watchToTheEnd();
    expect(app.queryByLabelText(UP_NEXT)).toBeNull();
  });
});
