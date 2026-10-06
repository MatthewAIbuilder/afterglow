import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/** What to discover's search, stations ("Sounds like …") and the Following button, through the real routes. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const flush = async () => {
  for (let i = 0; i < 8; i++)
    await act(async () => {
      await Promise.resolve();
    });
};
const settle = async () => {
  await act(async () => {
    jest.advanceTimersByTime(50);
    await Promise.resolve();
  });
  await flush();
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
});

async function openWhatToDiscover() {
  const app = await renderApp('/');
  await settle();
  await settle();
  await fireEvent.press(app.getByLabelText(/Choose what to discover\.$/));
  await settle();
  expect(app.getByText('What to discover')).toBeTruthy();
  return app;
}

describe('searching What to discover', () => {
  it('finds a sound by part of its name, and a festival by its name', async () => {
    const app = await openWhatToDiscover();
    const field = app.getByLabelText('Search sounds, festivals and artists');
    await fireEvent.changeText(field, 'dub');
    await settle();
    expect(app.getByLabelText(/^Dubstep, \d+ clips from every lineup$/)).toBeTruthy();
    expect(app.queryByLabelText(/^Riddim, /)).toBeNull();
    // The rest of the page waits while you search.
    expect(app.queryByText('Playing')).toBeNull();
    await fireEvent.changeText(field, 'solstice');
    await settle();
    expect(app.getByLabelText(/^Solstice 2026, \d+ clips?/)).toBeTruthy();
    await fireEvent.changeText(field, 'zzzzqq');
    await settle();
    expect(app.getByText('Nothing matches “zzzzqq”')).toBeTruthy();
    // Cleared: the page as it was.
    await fireEvent.press(app.getByLabelText('Clear the search'));
    await settle();
    expect(app.getByText('Playing')).toBeTruthy();
  });

  it('starts a station from an artist, remembers it, and offers it again', async () => {
    const app = await openWhatToDiscover();
    await fireEvent.changeText(app.getByLabelText('Search sounds, festivals and artists'), 'subtr');
    await settle();
    expect(app.getByText('Artists')).toBeTruthy();
    await fireEvent.press(app.getByLabelText(/^Sounds like SUBTRONICS\. Start a station/));
    await settle();
    await settle();
    expect(app.getByText('Sounds like SUBTRONICS')).toBeTruthy();
    expect(app.getByText('Similar sounds, every lineup')).toBeTruthy();
    expect(await AsyncStorage.getItem('discoverFocus.v1')).toBe('like:subtronics');
    expect(JSON.parse((await AsyncStorage.getItem('recentStations.v1'))!)).toEqual(['subtronics']);
    // Back in What to discover: a recent station.
    await fireEvent.press(app.getByLabelText(/^Sounds like SUBTRONICS, their sets and artists with a similar sound\. Choose what to discover\.$/));
    await settle();
    expect(app.getByText('Recent stations')).toBeTruthy();
    expect(app.getByLabelText('Sounds like SUBTRONICS, recent station')).toBeTruthy();
  });
});

describe('starting discovery from anything', () => {
  it('from Discover’s search: an artist starts a station, a sound and a festival their focus', async () => {
    const app = await renderApp('/');
    await settle();
    await fireEvent.press(app.getByLabelText('Search artists, festivals and people'));
    await settle();
    await fireEvent.changeText(app.getByLabelText('Search Afterglow'), 'subtronics');
    await settle();
    await fireEvent.press(app.getByLabelText('Sounds like SUBTRONICS'));
    await settle();
    await settle();
    expect(app.getByText('Sounds like SUBTRONICS')).toBeTruthy();

    await act(async () => router.push('/search'));
    await settle();
    await fireEvent.changeText(app.getByLabelText('Search Afterglow'), 'dubst');
    await settle();
    await fireEvent.press(app.getByLabelText(/^Discover Dubstep, \d+ clips/));
    await settle();
    await settle();
    expect(app.getByText('Dubstep')).toBeTruthy();

    await act(async () => router.push('/search'));
    await settle();
    await fireEvent.changeText(app.getByLabelText('Search Afterglow'), 'solstice');
    await settle();
    await fireEvent.press(app.getByLabelText('Discover Solstice 2026'));
    await settle();
    await settle();
    expect(app.getByText('Solstice 2026')).toBeTruthy();
  });

  it('from the artist page: More like this', async () => {
    const app = await renderApp('/artist/subtronics');
    await settle();
    await fireEvent.press(app.getByLabelText('Discover more like SUBTRONICS'));
    await settle();
    await settle();
    expect(app.getByText('Sounds like SUBTRONICS')).toBeTruthy();
  });
});

describe('the Following button', () => {
  it('is only there when signed in, and toggles Following and back', async () => {
    const signedOut = await renderApp('/');
    await settle();
    expect(signedOut.queryByLabelText('Following: videos from people you follow')).toBeNull();
    await signedOut.unmount();

    await mockSocial.service.signUp('me@example.com', 'password123');
    await AsyncStorage.setItem('discoverFocus.v1', 'sound:dubstep');
    const app = await renderApp('/');
    await settle();
    await settle();
    expect(app.getByText('Dubstep')).toBeTruthy();
    const button = app.getByLabelText('Following: videos from people you follow');
    expect(button.props.accessibilityState).toEqual({ selected: false });
    await fireEvent.press(button);
    await settle();
    await settle();
    expect(app.getByText('Following')).toBeTruthy();
    expect(app.getByLabelText('Following: videos from people you follow').props.accessibilityState).toEqual({ selected: true });
    expect(app.getByLabelText('Following: videos from people you follow').props.accessibilityHint).toBe('Tap to go back to Dubstep');
    await fireEvent.press(app.getByLabelText('Following: videos from people you follow'));
    await settle();
    await settle();
    expect(app.getByText('Dubstep')).toBeTruthy();
    expect(app.queryByText('People you follow')).toBeNull();
  });
});
