import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { renderApp } from './appRoutes';

/** Inviting people you know on Afterglow to a crew, and answering an invite, through the real routes. */
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
const as = (handle: string) => s().signIn(`${handle}@example.com`, 'password123');

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetGoers();
});

/** Maya's crew at Cyclops Cove 4; Sam (going there) and Bo know Maya. */
async function setUp() {
  const sam = await person('sam', 'Sam', ['cyclops-cove-4']);
  const bo = await person('bojo', 'Bo');
  await person('maya', 'Maya');
  await s().follow(sam);
  const crew = await s().createCrew('cyclops-cove-4', 'Bass crew');
  await s().signOut();
  await as('bojo');
  const mayaUid = [...mockSocial.profiles.values()].find((p) => p.handle === 'maya')!.uid;
  await s().follow(mayaUid);
  await s().signOut();
  await as('maya');
  return { crew, sam, bo };
}

describe('crew invites in the app', () => {
  it('a crew member invites people they know, those going first; a link is still there for others', async () => {
    const { crew, sam } = await setUp();
    const app = await renderApp(`/crew/${crew.id}`);
    await flush();
    await fireEvent.press(app.getByLabelText('Invite friends'));
    await flush();
    expect(app.getByText('Invite to Bass crew')).toBeTruthy();
    expect(app.getByText('Going to Cyclops Cove 4')).toBeTruthy();
    expect(app.getByLabelText('Invite Bo')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Invite Sam'));
    await flush();
    expect(app.getByLabelText('Sam is invited')).toBeTruthy();
    expect(mockSocial.crewInvites.get(`${crew.id}_${sam}`)?.crewName).toBe('Bass crew');
    expect(app.getByLabelText('Share a link instead')).toBeTruthy();
    await app.unmount();
  });

  it('the person invited sees it in the bell and on Friends, and joins with one tap', async () => {
    const { crew, sam } = await setUp();
    await s().inviteToCrew(crew.id, sam);
    await s().signOut();
    await as('sam');
    const bell = await renderApp('/notifications');
    await flush();
    expect(bell.getByText('Maya invited you to Bass crew')).toBeTruthy();
    await bell.unmount();
    const app = await renderApp('/together');
    await flush();
    await fireEvent.press(app.getByLabelText('Join Bass crew'));
    await flush();
    expect(mockSocial.crews.get(crew.id)?.members).toContain(sam);
    expect(mockSocial.crewInvites.size).toBe(0);
    await app.unmount();
  });

  it('Not now takes the invite away for both of you', async () => {
    const { crew, bo } = await setUp();
    await s().inviteToCrew(crew.id, bo);
    await s().signOut();
    await as('bojo');
    const app = await renderApp('/together');
    await flush();
    expect(app.getByText('Crew invite')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Not now: Maya invited you to Bass crew'));
    await flush();
    expect(app.queryByText('Crew invite')).toBeNull();
    expect(mockSocial.crewInvites.size).toBe(0);
    await app.unmount();
  });

  it('the crew page says who invited you', async () => {
    const { crew, sam } = await setUp();
    await s().inviteToCrew(crew.id, sam);
    await s().signOut();
    await as('sam');
    const app = await renderApp(`/crew/${crew.id}`);
    await flush();
    expect(app.getByText('Maya invited you · Cyclops Cove 4')).toBeTruthy();
    expect(app.getByText('No thanks')).toBeTruthy();
    await app.unmount();
  });
});

describe('ending a crew', () => {
  it('the owner ends it for everyone; the last one out ends it too', async () => {
    const { crew, sam } = await setUp();
    await s().signOut();
    await as('sam');
    await s().joinCrew(crew.id);
    await s().setCrewPicks(crew.id, ['subtronics']);
    await s().signOut();
    await as('maya');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === 'End crew')?.onPress?.());
    const app = await renderApp(`/crew/${crew.id}`);
    await flush();
    expect(mockSocial.crews.get(crew.id)?.members).toContain(sam);
    await fireEvent.press(app.getByLabelText('End this crew for everyone'));
    await flush();
    expect(mockSocial.crews.has(crew.id)).toBe(false);
    expect([...mockSocial.picks.keys()].some((k) => k.startsWith(`${crew.id}/`))).toBe(false);
    await app.unmount();

    const solo = await s().createCrew('cyclops-cove-4', 'Just me');
    const page = await renderApp(`/crew/${solo.id}`);
    await flush();
    expect(page.queryByLabelText('End this crew for everyone')).toBeNull();
    await fireEvent.press(page.getByText('End this crew'));
    await flush();
    alert.mockRestore();
    expect(mockSocial.crews.has(solo.id)).toBe(false);
    await page.unmount();
  });
});

describe('opening a crew link as someone new', () => {
  it('shows the crew first; the welcome waits until they reach a tab', async () => {
    await AsyncStorage.removeItem('welcomed.v1');
    await person('maya', 'Maya');
    const crew = await s().createCrew('cyclops-cove-4', 'Bass crew');
    await s().signOut();
    const app = await renderApp(`/crew/${crew.id}`);
    await flush();
    expect(app.getByText('Plan a festival together')).toBeTruthy();
    expect(app.queryByText('Get started')).toBeNull();
    act(() => router.replace('/'));
    await flush();
    expect(app.getByText('Get started')).toBeTruthy();
  });
});
