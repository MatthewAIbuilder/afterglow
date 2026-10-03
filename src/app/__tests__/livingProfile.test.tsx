import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderApp, showTab } from './appRoutes';

/** The living profile: the orbit, what you're feeling, your artists, milestones and the passport. */
const NOW = new Date(2026, 9, 3, 20);
const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i++) await settle();
};

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('the living profile', () => {
  it('puts your artists round your photo, says what you are feeling, and lists your artists', async () => {
    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ subtronics: 'love', levity: 'like' }));
    await AsyncStorage.setItem('reactions.v1', JSON.stringify({ c2: { liked: true, saved: false, skipped: false }, c4: { liked: true, saved: false, skipped: false } }));
    await AsyncStorage.setItem('seen.v1', JSON.stringify({ c2: NOW.getTime() - 3_600_000, c4: NOW.getTime() - 7_200_000 }));
    const app = await renderApp('/profile');
    await flush();
    expect(app.getByLabelText(/^Your sound universe: SUBTRONICS, LEVITY/)).toBeTruthy();
    expect(app.getByText(/^Currently feeling (dubstep|riddim)$/)).toBeTruthy();
    expect(app.getByText('Your artists')).toBeTruthy();
    expect(app.getByLabelText(/^SUBTRONICS, you love them\./)).toBeTruthy();
    expect(app.getByLabelText('2 artists rated')).toBeTruthy();
    expect(app.getByLabelText('0 moments')).toBeTruthy();
  });

  it('shows milestones with the next badge on the Badges tab', async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ subtronics: 'love', levity: 'love', 'rl-grime': 'like' }));
    const app = await renderApp('/profile');
    await flush();
    await showTab(app, 'Badges');
    expect(app.getByText('Your next badge')).toBeTruthy();
    expect(app.getByText(/^Milestones · 0 of \d+$/)).toBeTruthy();
    expect(app.getByLabelText('Basshead. Love 10 dubstep or riddim artists, 2 of 10')).toBeTruthy();
    expect(app.getByText('Festival pins')).toBeTruthy();
  });

  it('opens your festival passport from the festivals count', async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
    const app = await renderApp('/profile');
    await flush();
    await fireEvent.press(app.getByLabelText('1 festival'));
    await flush();
    expect(app.getByLabelText('Planning, 1')).toBeTruthy();
    expect(app.getByLabelText(/^Cyclops Cove 4, .*Boca Raton\. In 2 months/)).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Been there, 0'));
    expect(app.getByText('Festivals you’ve been to collect here, with what you filmed.')).toBeTruthy();
  });
});
