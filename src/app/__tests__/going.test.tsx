import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { renderApp } from './appRoutes';

/** Who else is going, on a festival page, through the real routes with the in-memory backend. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 8; i++) await settle();
};
const s = () => mockSocial.service;
async function person(handle: string, name: string, festivals: string[], showFestivals = true) {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: name, bio: '', showFestivals, showSound: false }, { festivals, sounds: [] });
  return u.uid;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetGoers();
});

describe('who else is going', () => {
  it('shows people you follow first on the festival page, and the full list', async () => {
    const maya = await person('maya', 'Maya', ['edc-orlando-26']);
    await person('bojo', 'Bo', ['edc-orlando-26']);
    await person('hidden', 'Hidden', ['edc-orlando-26'], false);
    await person('sam', 'Sam', ['edc-orlando-26']);
    await s().follow(maya);
    const app = await renderApp('/festival/edc-orlando-26');
    await flush();
    expect(app.getByText('Maya is going, plus 1 other on Afterglow')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Maya is going, plus 1 other on Afterglow. See who.'));
    await flush();
    expect(app.getByText('People you follow')).toBeTruthy();
    expect(app.getByLabelText('Maya, @maya')).toBeTruthy();
    expect(app.getByText('Also going')).toBeTruthy();
    expect(app.getByLabelText('Bo, @bojo')).toBeTruthy();
    // Someone who hides their festivals, and you, never appear.
    expect(app.queryByLabelText('Hidden, @hidden')).toBeNull();
    expect(app.queryByLabelText('Sam, @sam')).toBeNull();
  });

  it('nothing when no one else is going, or you’re signed out', async () => {
    await person('sam', 'Sam', ['edc-orlando-26']);
    const app = await renderApp('/festival/edc-orlando-26');
    await flush();
    expect(app.queryByText(/is going|are going/)).toBeNull();
  });
});
