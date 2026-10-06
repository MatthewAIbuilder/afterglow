import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { router } from 'expo-router';
import { renderApp } from './appRoutes';

/** The Friends hub through the real routes, with the in-memory backend. */
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
async function person(handle: string, name: string, festivals: string[] = []) {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: name, bio: '', showFestivals: festivals.length > 0, showSound: false }, { festivals, sounds: [] });
  return u.uid;
}

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 2, 12) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetGoers();
});

describe('Friends', () => {
  it('signed out, says what friends are for and how to start', async () => {
    const app = await renderApp('/profile');
    await flush();
    // Friends is a tab of its own now.
    await fireEvent.press(app.getByRole('tab', { name: 'Friends' }));
    await flush();
    expect(app.getByText('Festivals are better together')).toBeTruthy();
    // Inviting friends to the app works before you have a profile.
    expect(app.getByLabelText('Invite friends to Afterglow')).toBeTruthy();
    await fireEvent.press(app.getByText('Create your profile'));
    await flush();
    expect(app.getAllByText(/community guidelines/i).length).toBeGreaterThan(0);
  });

  it('close friends: starred on their profile, first on Friends, only on your phone', async () => {
    await person('maya', 'Maya Lin', ['cyclops-cove-4']);
    await s().signOut();
    await person('sam', 'Sam');
    const maya = [...mockSocial.profiles.values()].find((p) => p.handle === 'maya')!.uid;
    await s().follow(maya);
    const app = await renderApp('/friends');
    await flush();
    expect(app.getByText(/^Star your closest friends to bring them into your inner ring/)).toBeTruthy();
    await act(async () => router.push('/u/maya'));
    await flush();
    const star = app.getByLabelText('Close friend: Maya Lin');
    expect(star.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(star);
    expect(app.getByLabelText('Close friend: Maya Lin').props.accessibilityState).toMatchObject({ checked: true });
    await act(async () => router.push('/friends'));
    await flush();
    // She's on the orbit's inner ring now.
    expect(app.getByText('1 close friend · 1 friend')).toBeTruthy();
    expect(app.getByLabelText('Maya Lin, close friend. Going to Cyclops Cove 4. Quick options')).toBeTruthy();
    // Kept on this phone only, for this account; nothing about it reaches the server.
    expect(JSON.parse((await AsyncStorage.getItem('closeFriends.v1')) ?? '{}')).toEqual({ [mockSocial.currentUser()!.uid]: [maya] });
  });

  it('shows who to follow back and who is going to your festivals, and starts a crew', async () => {
    const maya = await person('maya', 'Maya');
    await s().signOut();
    await person('jojo', 'Jo', ['cyclops-cove-4']);
    await s().signOut();
    await person('sam', 'Sam', ['cyclops-cove-4']);
    await s().signOut();
    await s().signIn('maya@example.com', 'password123');
    const sam = [...mockSocial.profiles.values()].find((p) => p.handle === 'sam')!.uid;
    await s().follow(sam);
    await s().signOut();
    await s().signIn('sam@example.com', 'password123');
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));

    const app = await renderApp('/friends');
    await flush();
    // One list: people who follow you first, then people going to your festivals.
    expect(app.getByText('People you may know')).toBeTruthy();
    expect(app.getByLabelText('Maya, @maya')).toBeTruthy();
    expect(app.getByText('Follows you')).toBeTruthy();
    expect(app.getByText('Going to Cyclops Cove 4')).toBeTruthy();
    // One row of quick actions instead of separate cards.
    expect(app.getByLabelText('Find people')).toBeTruthy();
    expect(app.getByLabelText('Show my friend code')).toBeTruthy();
    expect(app.getByLabelText('Invite friends to Afterglow')).toBeTruthy();
    expect(app.getByLabelText('Jo, @jojo')).toBeTruthy();
    expect(maya).toBeTruthy();

    // Following back keeps her listed for this visit, showing Following, so it can be undone.
    await fireEvent.press(app.getByLabelText('Follow @maya'));
    await flush();
    expect(app.getByLabelText('Maya, @maya')).toBeTruthy();
    expect(app.getByLabelText('Following @maya. Tap to unfollow.')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Follow @jojo'));
    await flush();
    expect(app.getByLabelText('Following @jojo. Tap to unfollow.')).toBeTruthy();

    await fireEvent.press(app.getByLabelText('Start a crew for a festival'));
    await flush();
    await fireEvent.press(app.getByLabelText('Start a crew for Cyclops Cove 4'));
    await flush();
    expect(app.getByLabelText('Crew name').props.value).toBe('Cyclops Cove 4 crew');
    expect([...mockSocial.crews.values()][0]).toMatchObject({ festivalId: 'cyclops-cove-4', members: [sam] });
  });

  it('shows your friends as faces with what they have been up to, and how alike your taste is', async () => {
    const maya = await s().signUp('maya@example.com', 'password123');
    await s().saveProfile(
      { handle: 'maya', displayName: 'Maya', bio: '', showFestivals: true, showSound: true },
      { festivals: ['cyclops-cove-4'], sounds: ['dubstep', 'riddim', 'melodic-bass'] },
    );
    await s().shareMemory({ memoryId: 'm1', videoUri: 'file:///m1.mp4', festivalId: 'cyclops-cove-4', artistId: 'subtronics', capturedAt: '2026-10-01T22:00:00Z' });
    await s().signOut();
    await person('sam', 'Sam');
    await s().follow(maya.uid);

    const app = await renderApp('/friends');
    await flush();
    expect(app.getByText('Your friends')).toBeTruthy();
    expect(app.getByLabelText('Maya. Quick options')).toBeTruthy();
    expect(app.getByText('Recent activity')).toBeTruthy();
    expect(app.getByText('Maya shared a moment of SUBTRONICS')).toBeTruthy();
    expect(app.getByText('Maya is going to Cyclops Cove 4')).toBeTruthy();

    // A tap opens her quick options; See profile says how alike your taste is.
    await fireEvent.press(app.getByLabelText('Maya. Quick options'));
    await flush();
    expect(app.getByText(/^@maya/)).toBeTruthy();
    await fireEvent.press(app.getByLabelText('See profile'));
    await flush();
    expect(app.getByText(/taste match/)).toBeTruthy();
  });

  it('a tap on a friend in the orbit opens quick options: star them as a close friend, or message them', async () => {
    await person('maya', 'Maya Lin', ['cyclops-cove-4']);
    await s().signOut();
    await person('sam', 'Sam');
    const maya = [...mockSocial.profiles.values()].find((p) => p.handle === 'maya')!.uid;
    await s().follow(maya);
    const app = await renderApp('/friends');
    await flush();
    // Following isn't enough to be a close friend: she's on the outer ring until starred.
    expect(app.getByText('1 friend')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Maya. Quick options'));
    await flush();
    const star = app.getByLabelText('Add to close friends. Only you see this');
    expect(star.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(star);
    await flush();
    expect(app.getByLabelText('Close friend. Tap to take them off').props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(app.getAllByLabelText('Close')[0]);
    await flush();
    expect(app.getByText('1 close friend · 1 friend')).toBeTruthy();
    expect(app.getByLabelText('Maya Lin, close friend. Going to Cyclops Cove 4. Quick options')).toBeTruthy();
  });

  it('the Friends tab opens with the orbit tucked away behind a button that opens it (and folds it again)', async () => {
    await person('maya', 'Maya Lin', ['cyclops-cove-4']);
    await s().signOut();
    await person('sam', 'Sam');
    const maya = [...mockSocial.profiles.values()].find((p) => p.handle === 'maya')!.uid;
    await s().follow(maya);
    const app = await renderApp('/together');
    await flush();
    expect(app.queryByLabelText(/Quick options$/)).toBeNull();
    expect(app.getByText('1 friend')).toBeTruthy();
    expect(app.getByText('Find')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Show your friend orbit. 1 friend'));
    await flush();
    expect(app.getByText('Your friends')).toBeTruthy();
    expect(app.getByLabelText(/Quick options$/)).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Hide your friend orbit'));
    await flush();
    expect(app.queryByText('Your friends')).toBeNull();
    expect(app.getByLabelText('Show your friend orbit. 1 friend')).toBeTruthy();
  });
});
