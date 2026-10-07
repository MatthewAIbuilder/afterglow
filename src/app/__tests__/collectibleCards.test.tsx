import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { renderApp } from './appRoutes';

/** A collectible card someone shared: its page shows the card as they have it, and how to earn your own. */
const flush = async () => {
  for (let i = 0; i < 10; i++)
    await act(async () => {
      jest.advanceTimersByTime(50);
      await Promise.resolve();
    });
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 7, 20, 0) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('shared collectible cards', () => {
  it('shows their card, shiny and silver, and how to earn your own', async () => {
    const app = await renderApp('/card/hedex?h=maya&t=2&v=7&s=1');
    await flush();
    expect(app.getByText('@maya’s collectible')).toBeTruthy();
    expect(app.getByText('Shiny')).toBeTruthy();
    expect(app.getByText('Where HEDEX plays')).toBeTruthy();
    await app.unmount();
  });
  it('a link to an artist Afterglow doesn’t have says so', async () => {
    const app = await renderApp('/card/nobody-at-all?h=maya');
    await flush();
    expect(app.getByText('Card not found')).toBeTruthy();
    await app.unmount();
  });
});
