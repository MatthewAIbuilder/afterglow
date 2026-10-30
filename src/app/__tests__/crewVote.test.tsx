import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { renderApp } from './appRoutes';

/** Voting on the lineup with your crew, through the real routes. */
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
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetGoers();
});

describe('crew voting', () => {
  it('votes one act at a time, sends them to the crew, and ranks the lineup', async () => {
    await person('maya', 'Maya');
    const crew = await s().createCrew('solstice-26', 'Bass crew');
    await s().setCrewVotes(crew.id, { lineup: { subtronics: 2 }, clashes: {} });
    await s().signOut();
    const sam = await person('sam', 'Sam');
    await s().joinCrew(crew.id, mockSocial.codeOf(crew.id));
    const app = await renderApp(`/crew/${crew.id}`);
    await flush();
    await fireEvent.press(app.getByLabelText(/^Vote on the lineup together\. 1 of 2 have voted/));
    await flush();
    expect(app.getByText('Vote on the lineup')).toBeTruthy();
    // The first act on the bill, then the next.
    const first = app.getByLabelText(/^Must see: /).props.accessibilityLabel.replace('Must see: ', '');
    await fireEvent.press(app.getByLabelText(`Must see: ${first}`));
    await flush(2);
    expect(app.queryByLabelText(`Must see: ${first}`)).toBeNull();
    // A moment after the last tap, the crew has them.
    await settle(1500);
    await flush();
    expect(Object.values(mockSocial.votes.get(crew.id)?.get(sam)?.lineup ?? {})).toEqual([2]);
    await fireEvent.press(app.getByText('Results'));
    await flush(2);
    expect(app.getAllByLabelText(/^Number 1, /).length).toBe(1);
    await app.unmount();
  });
});
