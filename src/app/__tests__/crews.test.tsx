import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import { router } from 'expo-router';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { renderApp } from './appRoutes';

/** Festival crews through the real routes, with the in-memory backend. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 8) => {
  for (let i = 0; i < rounds; i++) await settle();
};
const s = () => mockSocial.service;
async function person(handle: string, name: string) {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: name, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
}
const as = (handle: string) => s().signIn(`${handle}@example.com`, 'password123');

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetGoers();
});

describe('festival crews', () => {
  it('start a crew from a festival page, name it, and your stars reach it', async () => {
    await AsyncStorage.setItem('mustSees.v2', JSON.stringify({ 'edc-orlando-26': ['steve-aoki', 'a-little-sound'] }));
    const me = await person('maya', 'Maya Chen');
    const app = await renderApp('/festival/edc-orlando-26');
    await flush();
    await fireEvent.press(app.getByLabelText('Plan with friends. Start a crew and see which sets you all want.'));
    await flush();
    // A fresh crew opens with its name ready to change.
    const field = app.getByLabelText('Crew name');
    expect(field.props.value).toBe('EDC Orlando 2026 crew');
    await fireEvent.changeText(field, 'Sunrise gang');
    await fireEvent.press(app.getByLabelText('Save name'));
    await flush();
    expect(app.getByText('Sunrise gang')).toBeTruthy();
    const crew = [...mockSocial.crews.values()][0];
    expect(crew).toMatchObject({ name: 'Sunrise gang', owner: me, members: [me] });
    expect(app.getByText('Send the invite to your friends. Anyone with the link can join, up to 12 people.')).toBeTruthy();
    expect(app.getByText('A LITTLE SOUND · STEVE AOKI')).toBeTruthy();
    // Your stars are shared a moment later.
    await settle(2500);
    await flush();
    expect(mockSocial.picks.get(`${crew.id}/${me}`)?.artists.sort()).toEqual(['a-little-sound', 'steve-aoki']);
    // Back on the festival page, the crew is there.
    await act(async () => router.back());
    await flush();
    expect(app.getByLabelText('Your crew, Sunrise gang, 1 person. Open it.')).toBeTruthy();
  });

  it('a friend opens the invite, joins, and sees the sets you share', async () => {
    const maya = await person('maya', 'Maya');
    const crew = await s().createCrew('edc-orlando-26', 'Sunrise gang');
    await s().setCrewPicks(crew.id, ['steve-aoki', 'aaron-hibell']);
    await AsyncStorage.setItem('mustSees.v2', JSON.stringify({ 'edc-orlando-26': ['steve-aoki'] }));
    const sam = await person('sam', 'Sam');
    const app = await renderApp(`/crew/${crew.id}`);
    await flush();
    expect(app.getByText('Sunrise gang')).toBeTruthy();
    expect(app.getByLabelText('In this crew: Maya')).toBeTruthy();
    expect(app.getByText('When you join, the sets you star at EDC Orlando 2026 are shared with this crew. You can leave any time.')).toBeTruthy();
    // Picks stay private until you join.
    expect(app.queryByText('Sets you share')).toBeNull();
    await fireEvent.press(app.getByLabelText('Join the crew'));
    await flush();
    expect(mockSocial.crews.get(crew.id)?.members).toEqual([maya, sam]);
    expect(app.getByText('Sets you share')).toBeTruthy();
    expect(app.getByLabelText(/^STEVE AOKI, \d+ percent match, Both of you$/)).toBeTruthy();
    expect(app.getByText('AARON HIBELL · STEVE AOKI')).toBeTruthy();
    // Not the owner: no rename, no remove.
    expect(app.queryByText('Rename')).toBeNull();
    expect(app.queryByText('Remove')).toBeNull();
  });

  it('the owner removes someone; leaving asks first and hands the crew on', async () => {
    await person('maya', 'Maya');
    const crew = await s().createCrew('edc-orlando-26', 'Crew');
    const sam = await person('sam', 'Sam');
    await s().joinCrew(crew.id);
    const jo = await person('jojo', 'Jo');
    await s().joinCrew(crew.id);
    await as('maya');
    const app = await renderApp(`/crew/${crew.id}`);
    await flush();
    const answer = (text: string) => jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons?: AlertButton[]) => buttons?.find((b) => b.text === text)?.onPress?.());
    const remove = answer('Remove');
    await fireEvent.press(app.getByLabelText('Remove Sam from the crew'));
    await flush();
    expect(remove.mock.calls[0][0]).toBe('Remove Sam?');
    expect(mockSocial.crews.get(crew.id)?.members).not.toContain(sam);
    expect(app.queryByLabelText('Remove Sam from the crew')).toBeNull();
    remove.mockRestore();
    const leave = answer('Leave');
    await fireEvent.press(app.getByText('Leave this crew'));
    await flush();
    expect(leave.mock.calls[0][0]).toBe('Leave this crew?');
    expect(mockSocial.crews.get(crew.id)).toMatchObject({ owner: jo, members: [jo] });
    leave.mockRestore();
  });

  it('signed out, an invite asks you to sign in', async () => {
    await person('maya', 'Maya');
    const crew = await s().createCrew('edc-orlando-26', 'Crew');
    await s().signOut();
    const app = await renderApp(`/crew/${crew.id}`);
    await flush();
    expect(app.getByText('Plan a festival together')).toBeTruthy();
    expect(app.getByLabelText('Sign in')).toBeTruthy();
  });

  it('an ended crew says so', async () => {
    await person('maya', 'Maya');
    const app = await renderApp('/crew/nope');
    await flush();
    expect(app.getByText('This crew has ended')).toBeTruthy();
  });

  it('your crewmates’ stars show on the lineup and the artist page', async () => {
    await person('maya', 'Maya Chen');
    const crew = await s().createCrew('edc-orlando-26', 'Crew');
    await s().setCrewPicks(crew.id, ['steve-aoki']);
    await person('sam', 'Sam');
    await s().joinCrew(crew.id);
    const app = await renderApp('/festival/edc-orlando-26');
    await flush();
    expect(app.getAllByLabelText(/^STEVE AOKI, \d+ percent match, ★ Maya/).length).toBeGreaterThan(0);
    await act(async () => router.push({ pathname: '/artist/[id]', params: { id: 'steve-aoki', festival: 'edc-orlando-26' } }));
    await flush();
    expect(app.getByText(/Maya starred this in your crew/)).toBeTruthy();
  });
});
