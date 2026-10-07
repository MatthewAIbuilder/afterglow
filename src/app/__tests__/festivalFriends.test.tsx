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
    await s().joinCrew(crew.id, mockSocial.codeOf(crew.id));
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
    // At the festival: the round buttons up top (find, your code, scanning, sprouts, inviting); no activity feed.
    expect(app.getByLabelText('Find people')).toBeTruthy();
    expect(app.getByLabelText('Show my friend code')).toBeTruthy();
    expect(app.getByLabelText('Scan a friend\'s code')).toBeTruthy();
    expect(app.getByLabelText('Your garden: give a sprout or kandi')).toBeTruthy();
    expect(app.getByLabelText('Invite friends to Afterglow')).toBeTruthy();
    expect(app.queryByText('People you may know')).toBeNull();
    await app.unmount();
  });

  it('is laid out for the night: the round buttons, then each crew as one card with its chat and checking in, then messages, then tonight', async () => {
    await person('sam', 'Sam');
    const crew = await s().createCrew('cyclops-cove-4', 'Bass crew');
    await s().signOut();
    await person('maya', 'Maya');
    await s().joinCrew(crew.id, mockSocial.codeOf(crew.id));
    const app = await renderApp('/together');
    await flush();
    // The crew's card: its chat (once, never again under Messages), checking in and the meeting spot, all inside.
    expect(app.getAllByLabelText(/^Bass crew: open the crew chat/)).toHaveLength(1);
    expect(app.getByText('Tell your crew')).toBeTruthy();
    expect(app.getByLabelText('Pick a meeting spot for if you lose each other')).toBeTruthy();
    // In that order down the page.
    const tree = JSON.stringify(app.toJSON());
    const order = ['Find', 'Your crew', 'Tell your crew', 'Tonight', 'Badges to collect'].map((label) => tree.indexOf(`"${label}"`));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // Opening the crew from its card goes to its chat.
    await fireEvent.press(app.getByLabelText(/^Bass crew: open the crew chat/));
    await flush();
    expect(app.getByLabelText('Crew settings')).toBeTruthy();
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
    expect(app.getByText(/^Side quests · 0 of 12/)).toBeTruthy();
    expect(app.getByText('Festival pins')).toBeTruthy();
    await app.unmount();
  });

  it('keeps your garden and gifts, and giving a sprout, a tap away', async () => {
    await person('maya', 'Maya');
    const app = await renderApp('/profile');
    await flush();
    expect(app.getByLabelText(/^My garden: .*\. Your sprouts, collectibles and gifts$/)).toBeTruthy();
    expect(app.getByLabelText('Give a sprout')).toBeTruthy();
    await fireEvent.press(app.getByLabelText(/^My garden: /));
    await flush();
    expect(app.getByRole('header', { name: 'Your garden' })).toBeTruthy();
    await app.unmount();
  });

  it('opens on Badges from a side quest notification', async () => {
    const app = await renderApp('/profile?tab=badges');
    await flush();
    expect(app.getByText('Festival pins')).toBeTruthy();
    await app.unmount();
  });
});
