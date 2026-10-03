import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { renderApp } from './appRoutes';

/** Where's the crew on Tonight, Saturday night of Cyclops Cove 4 (Dec 4 to 6 2026). */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 12) => {
  for (let i = 0; i < rounds; i++) await settle();
};
const s = () => mockSocial.service;
async function person(handle: string, name: string) {
  await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: name, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
}
const at = (h: number, m = 0) => new Date(2026, 11, 5, h, m);

beforeEach(async () => {
  jest.useFakeTimers({ now: at(20) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
  await AsyncStorage.setItem('tonightShown.v1', 'cyclops-cove-4:2026-12-05');
  mockSocial = fakeSocial();
  forgetGoers();
});

describe('where is the crew', () => {
  it('Tonight groups your crew by the stage of their latest check-in, with the time', async () => {
    await person('maya', 'Maya');
    const crew = await s().createCrew('cyclops-cove-4', 'Cove crew');
    jest.setSystemTime(at(21, 40));
    await s().postCrewUpdate(crew.id, { id: 'u-maya001', kind: 'checkin', at: at(21, 40).toISOString(), festivalId: 'cyclops-cove-4', stage: 'Main Stage', note: 'I’m here' });
    await s().signOut();
    await person('sam', 'Sam');
    await s().joinCrew(crew.id, mockSocial.codeOf(crew.id));
    jest.setSystemTime(at(22));
    const app = await renderApp('/tonight');
    await flush();
    expect(app.getByText('Where’s the crew')).toBeTruthy();
    expect(app.getByText('Main Stage')).toBeTruthy();
    expect(app.getByLabelText('Maya, 9:40 PM, 20 min ago')).toBeTruthy();
    expect(app.getByText('From their latest videos and check-ins, not live location.')).toBeTruthy();
  });
});
