import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { renderApp } from './appRoutes';

/** Festival mode's Friends tab (check in first, then where everyone is) and its Profile (Moments and Badges). */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i++) await settle();
};
const s = () => mockSocial.service;
async function person(handle: string, name: string) {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: name, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
}

beforeEach(async () => {
  // Saturday night at Cyclops Cove 4, in festival mode.
  jest.useFakeTimers({ now: new Date(2026, 11, 5, 22, 0) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
  await AsyncStorage.setItem('festivalMode.v1', JSON.stringify({ choices: { 'cyclops-cove-4': 'on' } }));
  await AsyncStorage.setItem('tonightShown.v1', 'cyclops-cove-4:2026-12-05');
  mockSocial = fakeSocial();
  forgetGoers();
});

describe('Friends at a festival', () => {
  it('leads with checking in: one tap sends, how you are sits beside it as chips, then side quests and adding friends', async () => {
    await person('sam', 'Sam');
    const crew = await s().createCrew('cyclops-cove-4', 'Bass crew');
    await s().signOut();
    await person('maya', 'Maya');
    await s().joinCrew(crew.id);
    const app = await renderApp('/together');
    await flush();
    expect(app.getByText('At Cyclops Cove 4')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Send “I’m here” to your crew'));
    await flush();
    expect([...mockSocial.updates.values()].some((u) => u.note === 'I’m here' && u.crewId === crew.id)).toBe(true);
    expect(app.getByText(/^Sent “I’m here” · /)).toBeTruthy();
    // How you are: chips, not big buttons.
    expect(app.getByLabelText('I’m OK. Tell my crew')).toBeTruthy();
    expect(app.getByLabelText('Can’t find my crew. Tell them')).toBeTruthy();
    expect(app.getByText('Need help')).toBeTruthy();
    expect(app.queryByText('Ask my crew for help')).toBeNull();
    expect(app.getByLabelText('Check in with a stage, a photo or your own words')).toBeTruthy();
    expect(app.getAllByText('Side quests').length).toBeGreaterThan(0);
    // At the festival: your code, scanning and finding people up top; no inviting or activity feed.
    expect(app.getByLabelText('Show my friend code')).toBeTruthy();
    expect(app.getByLabelText('Scan a friend\'s code')).toBeTruthy();
    expect(app.queryByLabelText('Invite friends to Afterglow')).toBeNull();
    expect(app.queryByText('People you may know')).toBeNull();
    await app.unmount();
  });

  it('without a crew there, offers to start one', async () => {
    await person('maya', 'Maya');
    const app = await renderApp('/together');
    await flush();
    expect(app.getByLabelText('Start a crew for Cyclops Cove 4')).toBeTruthy();
    expect(app.queryByLabelText('Send “I’m here” to your crew')).toBeNull();
    await app.unmount();
  });
});

describe('Profile at a festival', () => {
  it('has Moments and Badges, with side quests first', async () => {
    await person('maya', 'Maya');
    const app = await renderApp('/profile');
    await flush();
    expect(app.getByRole('tab', { name: /Moments/ })).toBeTruthy();
    await fireEvent.press(app.getByRole('tab', { name: /Badges/ }));
    await flush();
    expect(app.getByText(/^Side quests · 0 of 10/)).toBeTruthy();
    expect(app.getByText('Festival pins')).toBeTruthy();
    await app.unmount();
  });

  it('opens on Badges from a side quest notification', async () => {
    const app = await renderApp('/profile?tab=badges');
    await flush();
    expect(app.getByText('Festival pins')).toBeTruthy();
    await app.unmount();
  });
});
