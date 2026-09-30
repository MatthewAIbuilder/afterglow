import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
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

describe('legal pages', () => {
  it('open from Profile and link to each other', async () => {
    const app = await renderApp('/profile');
    await flush();
    await fireEvent.press(app.getByRole('link', { name: 'Privacy' }));
    await flush();
    expect(app.getByText('Privacy Policy')).toBeTruthy();
    expect(app.getByText('What stays on your device')).toBeTruthy();
    await fireEvent.press(app.getByRole('link', { name: 'Terms' }));
    await flush();
    expect(app.getByText('Terms of Use')).toBeTruthy();
  });

  it('an unknown page shows the privacy policy', async () => {
    const app = await renderApp('/legal/cookies');
    await flush();
    expect(app.getByText('Privacy Policy')).toBeTruthy();
  });
});
