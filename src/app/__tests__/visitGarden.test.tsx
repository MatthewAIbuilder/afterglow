import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/** Visiting someone's garden from their profile, and your own garden shown on yours (or not). */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (n = 10) => {
  for (let i = 0; i < n; i++) await settle();
};
const s = () => mockSocial.service;
const person = async (handle: string, name: string) => {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: name, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 3, 20, 0) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
});

describe('gardens', () => {
  it('a friend’s garden opens from their profile, and a tap makes one dance', async () => {
    const maya = await person('maya', 'Maya Lin');
    await s().publishGarden([
      { k: 's', kind: 'plur', stage: 3 },
      { k: 's', kind: 'seedling', stage: 1 },
      { k: 'a', artistId: 'subtronics', name: 'SUBTRONICS', tier: 1 },
    ]);
    await s().signOut();
    await person('sam', 'Sam');
    const app = await renderApp('/u/maya');
    await flush();
    expect(app.getByText('Maya’s garden')).toBeTruthy();
    expect(app.getByText('3 living there · Visit')).toBeTruthy();
    await fireEvent.press(app.getByTestId('visit-garden'));
    await flush();
    expect(app.getByText('@maya’s garden')).toBeTruthy();
    expect(app.getByText('2 sprouts and 1 artist collectible. Tap one to make it dance.')).toBeTruthy();
    // Nothing to move; a tap dances (and opens nothing).
    await fireEvent.press(app.getByLabelText('PLUR sprout, In bloom.'));
    await settle(1000);
    expect(app.getByText('@maya’s garden')).toBeTruthy();
    expect(maya).toBeTruthy();
  });

  it('your garden shows on your profile by itself, and comes down when you hide it', async () => {
    const me = await person('sam', 'Sam');
    const app = await renderApp('/garden');
    await flush();
    await settle(4500);
    await flush();
    expect(mockSocial.gardens.get(me)?.residents.length).toBeGreaterThan(0);
    await fireEvent(app.getByLabelText('Show my garden on my profile'), 'valueChange', false);
    await flush();
    await settle(4500);
    await flush();
    expect(mockSocial.gardens.has(me)).toBe(false);
    await act(async () => router.push('/u/sam'));
    await flush();
    expect(app.queryByTestId('visit-garden')).toBeNull();
    expect(app.getByText('Hidden from your profile. Open your garden to show it.')).toBeTruthy();
  });

  it('a friend who hasn’t shared a garden yet still shows where it will be, and why it isn’t there', async () => {
    await person('maya', 'Maya Lin');
    await s().signOut();
    await person('sam', 'Sam');
    const app = await renderApp('/u/maya');
    await flush();
    expect(app.queryByTestId('visit-garden')).toBeNull();
    expect(app.getByTestId('garden-not-shared')).toBeTruthy();
    expect(app.getByText('Not shared yet. It shows here once Maya opens the latest Afterglow with something growing.')).toBeTruthy();
    expect(app.getByText('Make kandi for Maya')).toBeTruthy();
  });

  it('Make kandi from your garden: pick a friend you follow, then make theirs', async () => {
    const maya = await person('maya', 'Maya Lin');
    await s().signOut();
    await person('sam', 'Sam');
    await s().follow(maya);
    const app = await renderApp('/garden');
    await flush();
    await fireEvent.press(app.getByLabelText('Make kandi for a friend'));
    await flush();
    expect(app.getByText('Who’s it for?')).toBeTruthy();
    await fireEvent.press(app.getByTestId('kandi-for-maya'));
    await flush();
    expect(app.getByText('Kandi for Maya')).toBeTruthy();
    expect(app.getByText('Leave it in Maya’s garden')).toBeTruthy();
  });
});
