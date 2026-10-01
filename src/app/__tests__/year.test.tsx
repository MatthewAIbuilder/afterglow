import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { Share } from 'react-native';
import { renderApp } from './appRoutes';

const flush = async () => {
  for (let i = 0; i < 6; i++)
    await act(async () => {
      await Promise.resolve();
    });
};
const year = new Date().getFullYear();

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('your year', () => {
  it('Profile offers your year once there is something in it, and it shares as text', async () => {
    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ subtronics: 'love', illenium: 'like' }));
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const app = await renderApp('/profile');
    await flush();
    await fireEvent.press(app.getByLabelText(new RegExp(`^Your ${year} on Afterglow\\.`)));
    await flush();
    expect(app.getAllByText(`Your ${year}`).length).toBeGreaterThan(0);
    expect(app.getByText('Your top artists')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Share your year as text'));
    await flush();
    const message = (share.mock.calls[0][0] as { message: string }).message;
    expect(message.split('\n')[0]).toBe(`My ${year} on Afterglow`);
    expect(message).toContain('SUBTRONICS');
    share.mockRestore();
  });

  it('is not offered to a newcomer', async () => {
    const app = await renderApp('/profile');
    await flush();
    expect(app.queryByLabelText(new RegExp(`^Your ${year} on Afterglow`))).toBeNull();
  });
});
