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

describe('the festivals you’re going to, at the top of Festivals', () => {
  it('one card each, side by side: a countdown, your top artists there and who’s going', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 15, 12) });
    const maya = await person('maya', 'Maya', ['edc-orlando-26']);
    await person('robin', 'Robin', []);
    await s().follow(maya);
    await AsyncStorage.setItem('going.v1', JSON.stringify(['edc-orlando-26', 'cyclops-cove-4']));
    const app = await renderApp('/festivals');
    await flush();
    expect(app.getByLabelText(/^Up next: EDC Orlando 2026, .*Maya is going/)).toBeTruthy();
    expect(app.getByLabelText(/^Up next: Cyclops Cove 4, /)).toBeTruthy();
    expect(app.getByText('Up next')).toBeTruthy();
    expect(app.getAllByText('Your top artists here').length).toBeGreaterThan(0);
    expect(app.getByText('Maya is going')).toBeTruthy();
  });

  it('a new install brings back the festivals your profile shows, instead of publishing none over them', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 15, 12) });
    // Your account, with EDC and Cyclops Cove on its profile, signed in on a phone with nothing saved.
    const me = await person('jordan', 'Jordan', ['edc-orlando-26', 'cyclops-cove-4']);
    const app = await renderApp('/festivals');
    await flush();
    await settle(4000);
    await flush();
    expect(app.getByLabelText(/^Up next: EDC Orlando 2026, /)).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem('going.v1')) ?? '[]')).toEqual(['edc-orlando-26', 'cyclops-cove-4']);
    expect((await s().profileOf(me))?.festivals).toEqual(['edc-orlando-26', 'cyclops-cove-4']);
  });
});
