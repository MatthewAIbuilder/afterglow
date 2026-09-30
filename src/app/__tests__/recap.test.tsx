import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderApp } from './appRoutes';

/** Your recap, once Cyclops Cove (Dec 4 to 6 2026) is over. */
const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(50);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 8; i++) await settle();
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 11, 20, 12) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});
afterEach(() => {
  jest.useRealTimers();
});

describe('festival recap', () => {
  it('the festival page opens your recap once it is over', async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ subtronics: 'love' }));
    const app = await renderApp('/festival/cyclops-cove-4');
    await flush();
    await fireEvent.press(app.getByLabelText('See your recap of Cyclops Cove 4'));
    await flush();
    expect(app.getByText('Your recap')).toBeTruthy();
    expect(app.getByLabelText('Your recap of Cyclops Cove 4')).toBeTruthy();
    expect(app.getByLabelText('Share your recap as text')).toBeTruthy();
  });

  it('nothing to recap for a festival you had nothing to do with', async () => {
    const app = await renderApp('/festival/cyclops-cove-4');
    await flush();
    expect(app.queryByLabelText('See your recap of Cyclops Cove 4')).toBeNull();
  });

  it('Profile lists your recaps', async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
    const app = await renderApp('/profile');
    await flush();
    expect(app.getByLabelText('Your recap of Cyclops Cove 4')).toBeTruthy();
  });

  it('the bell says your recap is ready', async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
    const app = await renderApp('/notifications');
    await flush();
    expect(app.getByText('Your recap of Cyclops Cove 4 is ready')).toBeTruthy();
  });
});
