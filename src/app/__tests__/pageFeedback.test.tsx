import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/**
 * "Spotted a problem, or got an idea?" at the end of a page: the footer opens the
 * feedback sheet for that page, and what's sent reaches support with the page
 * on it. Signed out, it offers an email with the page in the subject.
 */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 12) => {
  for (let i = 0; i < rounds; i++) await settle();
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
});

describe('feedback from any page', () => {
  it('sends an idea from the end of a page, with the page on it', async () => {
    await mockSocial.service.signUp('maya@example.com', 'maya-pass');
    await mockSocial.service.saveProfile({ handle: 'maya', displayName: 'Maya', bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
    const app = await renderApp('/settings');
    await flush();
    expect(app.getByText('Spotted a problem, or got an idea?')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Share an idea for this page'));
    await flush();
    expect(app.getByText('Got an idea?')).toBeTruthy();
    await fireEvent.changeText(app.getByLabelText('Your idea'), 'A dark mode for the map');
    await fireEvent.press(app.getByText('Send'));
    await flush();
    expect(app.getByText('Thank you!')).toBeTruthy();
    const [sent] = await mockSocial.service.mySupport(10);
    expect(sent.topic).toBe('idea');
    expect(sent.text).toBe('A dark mode for the map\n\n— From /settings');
  });

  it('reports a problem, and offers an email when signed out', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const app = await renderApp('/settings');
    await flush();
    await fireEvent.press(app.getByLabelText('Report a problem on this page'));
    await flush();
    expect(app.getByText('Something not working?')).toBeTruthy();
    await fireEvent.press(app.getByText('Email us'));
    expect(open).toHaveBeenCalledWith(expect.stringContaining('subject=Afterglow%20problem%20(%2Fsettings)'));
    open.mockRestore();
  });
});
