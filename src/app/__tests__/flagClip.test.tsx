import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { ActionSheetIOS, Alert, Linking, type AlertButton } from 'react-native';
import { renderApp } from './appRoutes';
import { builtInCatalog } from '../../state/catalog';

/** Flagging a wrong YouTube clip in Discover: hidden at once, a report offered, and undo. */
const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(50);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 8; i++) await settle();
};
const MENU = /^Something wrong with this clip of (.+)\? Hide it or report it$/;

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});
afterEach(() => {
  jest.restoreAllMocks();
});

/** Open Discover, pick "Wrong artist" on the first YouTube clip, and answer the follow-up with `answer`. */
async function flagFirst(answer: 'Undo' | 'Not now' | 'Send report') {
  const app = await renderApp('/');
  await flush();
  const button = app.getAllByLabelText(MENU)[0];
  const name = (button.props.accessibilityLabel as string).match(MENU)![1];
  const artistId = builtInCatalog.artists.find((a) => a.name === name)!.id;
  const clipIds = builtInCatalog.clipsOf(artistId).map((c) => c.id);
  jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementationOnce((_o, cb) => cb(0));
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons?: AlertButton[]) => buttons?.find((b) => b.text === answer)?.onPress?.());
  await fireEvent.press(button);
  await flush();
  const saved = JSON.parse((await AsyncStorage.getItem('clipFlags.v1')) ?? '{}');
  return { app, name, clipIds, saved };
}

describe('flagging a wrong clip', () => {
  it('hides it on this phone straight away', async () => {
    const { app, name, clipIds, saved } = await flagFirst('Not now');
    const flagged = Object.keys(saved);
    expect(flagged).toHaveLength(1);
    expect(clipIds).toContain(flagged[0]);
    expect(saved[flagged[0]].reason).toBe('wrong-artist');
    // That clip is gone from the feed (any other clip of theirs can stay).
    const left = app.queryAllByLabelText(new RegExp(`^Something wrong with this clip of ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\?`));
    expect(left.length).toBeLessThan(clipIds.length);
  });

  it('undo brings it back', async () => {
    const { saved } = await flagFirst('Undo');
    expect(saved).toEqual({});
  });

  it('sends a report by email', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { name } = await flagFirst('Send report');
    await flush();
    const url = open.mock.calls[0]?.[0] as string;
    expect(url.startsWith('mailto:afterglowmusic.support@gmail.com?subject=')).toBe(true);
    expect(decodeURIComponent(url)).toContain(`Wrong clip: ${name} (wrong artist)`);
  });
});
