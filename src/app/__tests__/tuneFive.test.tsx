import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderApp } from './appRoutes';

// Screen tests run on fake timers once rendered, and the next card comes a frame later: move the clock on.
const flush = async () => {
  for (let i = 0; i < 6; i++)
    await act(async () => {
      jest.advanceTimersByTime(50);
      await Promise.resolve();
    });
};
const stored = async () => JSON.parse((await AsyncStorage.getItem('artistRatings.v1')) ?? '{}');

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('five answers in Tune your lineup', () => {
  it('every answer between love and not for me is kept, and shows on the lineup', async () => {
    const app = await renderApp('/tune/edc-orlando-26');
    await flush();
    await fireEvent.press(app.getByLabelText('Like A LITTLE SOUND'));
    await flush();
    await fireEvent.press(app.getByLabelText('AARON HIBELL is OK'));
    await flush();
    expect(await stored()).toEqual({ 'a-little-sound': 'like', 'aaron-hibell': 'ok' });
    // Undo takes back the last answer only.
    await fireEvent.press(app.getByLabelText('Undo the last answer'));
    await flush();
    expect(await stored()).toEqual({ 'a-little-sound': 'like' });
    // On the lineup: "you like them".
    await act(async () => router.replace('/festival/edc-orlando-26'));
    await flush();
    expect(app.getAllByLabelText(/^A LITTLE SOUND, \d+ percent match, you like them/).length).toBeGreaterThan(0);
  });
});
