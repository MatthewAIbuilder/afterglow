import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderApp } from './appRoutes';

/** Tonight's preview in Discover, on Saturday night of Cyclops Cove 4 (Dec 4 to 6 2026). */
const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 12) => {
  for (let i = 0; i < rounds; i++) await settle();
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 11, 5, 22, 0) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
  await AsyncStorage.setItem('tonightShown.v1', 'cyclops-cove-4:2026-12-05');
});

describe('tonight in Discover', () => {
  it('What to discover offers tonight’s artists, and Discover then shows only them', async () => {
    const app = await renderApp('/discover-focus');
    await flush();
    await fireEvent.press(app.getByLabelText(/^Tonight, Saturday at Cyclops Cove 4 · 1 artist, in set order$/));
    await flush();
    expect(app.getByLabelText(/^Tonight, who plays Saturday at Cyclops Cove 4, in set order\./)).toBeTruthy();
    expect(app.getByText('Saturday at Cyclops Cove 4 · in set order')).toBeTruthy();
    expect(app.getAllByText('SUBTRONICS').length).toBeGreaterThan(0);
    expect(app.queryByText('ILLENIUM')).toBeNull();
  });

  it('the Tonight screen opens the preview', async () => {
    const app = await renderApp('/tonight');
    await flush();
    await fireEvent.press(app.getByLabelText(`Preview tonight's sets in Discover, in set order`));
    await flush();
    expect(app.getByText('Saturday at Cyclops Cove 4 · in set order')).toBeTruthy();
  });
});
