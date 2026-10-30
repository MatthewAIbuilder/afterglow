import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { milestones } from '../../features/profile/milestones';
import { renderApp } from './appRoutes';

/** The crew page's extras: who's bringing what, through the real routes. */
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

describe('crew extras', () => {
  it('a shared list of who’s bringing what, ticked off by whoever has it', async () => {
    await person('maya', 'Maya');
    const crew = await s().createCrew('solstice-26', 'Bass crew');
    await s().addCrewItem(crew.id, 'Sunscreen');
    await s().signOut();
    const sam = await person('sam', 'Sam');
    await s().joinCrew(crew.id, mockSocial.codeOf(crew.id));
    const app = await renderApp(`/crew/${crew.id}`);
    await flush();
    expect(app.getByText('Who’s bringing what')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Sunscreen. Nobody has it yet. Added by Maya'));
    await flush(3);
    expect(mockSocial.crewLists.get(crew.id)?.[0]).toEqual(expect.objectContaining({ done: true, doneBy: sam }));
    await fireEvent.press(app.getByLabelText('Add Portable charger'));
    await flush(3);
    expect(mockSocial.crewLists.get(crew.id)?.map((i) => i.text)).toEqual(['Sunscreen', 'Portable charger']);
    await app.unmount();
  });

  it('crew badges: a crew of five, and voting on 20 acts with one', () => {
    const base = { festivals: 0, moments: 0, artists: 0 } as unknown as Parameters<typeof milestones>[0];
    const list = milestones({ ...base, crewSize: 5, crewVotes: 12 });
    expect(list.find((m) => m.id === 'full-crew')?.earned).toBe(true);
    expect(list.find((m) => m.id === 'crew-vote')).toEqual(expect.objectContaining({ earned: false, current: 12, target: 20 }));
  });
});
