import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/** The hidden toes: one account sees them, nobody else does. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));
// The in-memory backend hands out uid-1, uid-2…: let uid-1 stand in for the toe friend.
jest.mock('../../features/toes/toes', () => {
  const real = jest.requireActual<typeof import('../../features/toes/toes')>('../../features/toes/toes');
  return { ...real, hasToes: (uid: string | null | undefined) => uid === 'uid-1' };
});

const flush = async () => {
  for (let i = 0; i < 8; i++)
    await act(async () => {
      jest.advanceTimersByTime(50);
      await Promise.resolve();
    });
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
});

describe('hidden toes', () => {
  it('show up for the toe friend', async () => {
    await mockSocial.service.signUp('toes@example.com', 'password123');
    const app = await renderApp('/settings');
    await flush();
    expect(app.getByText(/made with ten toes/)).toBeTruthy();
  });

  it('never show for anyone else', async () => {
    await mockSocial.service.signUp('first@example.com', 'password123');
    await mockSocial.service.signOut();
    await mockSocial.service.signUp('second@example.com', 'password123');
    const app = await renderApp('/settings');
    await flush();
    expect(app.queryByText(/toes/)).toBeNull();
    expect(app.queryAllByTestId('hidden-toe', { includeHiddenElements: true })).toHaveLength(0);
  });

  it('peek over the tab bar for the toe friend only', async () => {
    await mockSocial.service.signUp('toes@example.com', 'password123');
    const app = await renderApp('/festivals');
    await flush();
    expect(app.queryAllByTestId('hidden-toe', { includeHiddenElements: true }).length).toBeGreaterThan(0);
  });
});
