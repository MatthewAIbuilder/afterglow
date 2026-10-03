import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { showWhatsNew, WHATS_NEW } from '../../features/whatsNew/whatsNew';
import { showWhatsNewInTests } from '../../features/whatsNew/WhatsNewLauncher';
import { renderApp } from './appRoutes';

const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i++)
    await act(async () => {
      jest.advanceTimersByTime(100);
      await Promise.resolve();
    });
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 4, 10) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe("what's new", () => {
  it('is for people who already use the app, once', () => {
    expect(showWhatsNew(null, true)).toBe(true);
    expect(showWhatsNew(WHATS_NEW.key, true)).toBe(false);
    expect(showWhatsNew(null, false)).toBe(false);
  });

  it('lists the update with a way to try each thing', async () => {
    const app = await renderApp('/whats-new');
    await flush();
    expect(app.getByText('Fresh tonight')).toBeTruthy();
    await fireEvent.press(app.getByLabelText(/^The festival map\./));
    await flush();
    expect(app.getByTestId('festival-map')).toBeTruthy();
  });

  it('opens by itself over a tab for someone who used the app before', async () => {
    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ subtronics: 'love' }));
    showWhatsNewInTests(true);
    const app = await renderApp('/festivals');
    await flush(20);
    expect(app.getByText('Fresh tonight')).toBeTruthy();
    expect(await AsyncStorage.getItem('whatsNew.v1')).toBe(WHATS_NEW.key);
    showWhatsNewInTests(false);
  });
});
