import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Share } from 'react-native';
import { renderApp } from './appRoutes';

const flush = async () => {
  for (let i = 0; i < 6; i++)
    await act(async () => {
      await Promise.resolve();
    });
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('sharing festivals and artists', () => {
  it('a festival page shares its link', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const app = await renderApp('/festival/edc-orlando-26');
    await flush();
    await fireEvent.press(app.getByLabelText('Share EDC Orlando 2026'));
    await flush();
    expect((share.mock.calls[0][0] as { message: string }).message).toContain('https://afterglowmusic.app/festival/edc-orlando-26');
    share.mockRestore();
  });

  it('an artist page shares its link and where they play', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const app = await renderApp('/artist/subtronics');
    await flush();
    await fireEvent.press(app.getByLabelText('Share SUBTRONICS'));
    await flush();
    const message = (share.mock.calls[0][0] as { message: string }).message;
    expect(message).toContain('https://afterglowmusic.app/artist/subtronics');
    expect(message).toContain('Playing');
    share.mockRestore();
  });

  it('a link to something that isn’t there says so, and Back goes to Discover', async () => {
    const app = await renderApp('/festival/nope');
    await flush();
    expect(app.getByText('Festival not found')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Back'));
    await flush();
    expect(app.getByLabelText('Search artists, festivals and people')).toBeTruthy();
    await act(async () => router.push('/artist/nope'));
    await flush();
    expect(app.getByText('Artist not found')).toBeTruthy();
  });
});
