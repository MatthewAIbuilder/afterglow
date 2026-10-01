import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderApp } from './appRoutes';
import { SOUND_LABEL, SOUND_TAGS } from '../../data/models';
import { soundChoices } from '../../features/discover/focus';
import { builtInCatalog } from '../../state/catalog';

/** Tapping a sound name around My Sound lights up those artists, and offers to watch that sound in Discover. */
const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(50);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 8; i++) await settle();
};
const REGION = /^(.+)\. Show these artists$/;
const watchable = new Set(soundChoices(builtInCatalog.clips, builtInCatalog.artist).map((c) => c.tag));

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('tapping a sound on My Sound', () => {
  it('lights up that sound, then opens Discover on it', async () => {
    const app = await renderApp('/sound');
    await flush();
    const regions = app.getAllByLabelText(REGION);
    // A sound name with enough clips to watch.
    const region = regions.find((r) => {
      const label = (r.props.accessibilityLabel as string).match(REGION)![1];
      return SOUND_TAGS.some((t) => SOUND_LABEL[t] === label && watchable.has(t));
    })!;
    const label = (region.props.accessibilityLabel as string).match(REGION)![1];
    await act(async () => region.props.onAccessibilityTap());
    await flush();
    const sound = label.toLowerCase();
    expect(app.getByText(new RegExp(`^\\d+ ${sound} artists?`))).toBeTruthy();
    // The search shows the sound, without opening the keyboard.
    expect(app.getByDisplayValue(label).props.autoFocus).toBe(false);
    await fireEvent.press(app.getByLabelText(`Watch ${sound} live sets in Discover`));
    await flush();
    expect(app.getAllByLabelText(new RegExp(`^${label}, live sets from every lineup\\.`)).length).toBeGreaterThan(0);
  });
});
