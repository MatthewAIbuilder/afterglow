import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { ActionSheetIOS } from 'react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { renderApp } from './appRoutes';

/** Comments on shared videos through the real routes, with the in-memory backend. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 10; i++) await settle();
};
const s = () => mockSocial.service;
async function person(handle: string, name: string) {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: name, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
}
async function mayaShares() {
  await person('maya', 'Maya');
  const shared = await s().shareMemory({ memoryId: 'm1', videoUri: 'file:///m1.mov', festivalId: 'cyclops-cove-4', artistId: 'hedex', capturedAt: '2026-12-04T22:30:00.000Z', width: 1080, height: 1920 });
  await s().signOut();
  await person('sam', 'Sam');
  return shared.id;
}

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 11, 8, 12) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('comments on shared videos', () => {
  it('write one from the video, see it listed, and the person who filmed it hears about it', async () => {
    const id = await mayaShares();
    const app = await renderApp(`/shared/${id}`);
    await flush();
    await fireEvent.press(app.getByLabelText('0 comments. Read and write comments.'));
    await flush();
    expect(app.getByText('No comments yet. Say something nice.')).toBeTruthy();
    await fireEvent.changeText(app.getByLabelText('Write a comment'), '  That drop at 0:20!  ');
    await fireEvent.press(app.getByLabelText('Post comment'));
    await flush();
    expect(app.getByText('That drop at 0:20!')).toBeTruthy();
    expect(app.getByText('1 comment')).toBeTruthy();
    expect([...mockSocial.comments.values()][0]).toMatchObject({ handle: 'sam', text: 'That drop at 0:20!', memoryId: id });

    // Maya's bell.
    await s().signOut();
    await s().signIn('maya@example.com', 'password123');
    const activity = await s().activity(10);
    expect(activity[0]).toMatchObject({ kind: 'comment', text: 'That drop at 0:20!' });
  });

  it('keeps comments kind, and lets the person who filmed it remove any', async () => {
    const id = await mayaShares();
    const sams = await s().comment(id, [...mockSocial.memories.values()][0].uid, 'Wish I was there');
    await expect(s().comment(id, [...mockSocial.memories.values()][0].uid, '')).rejects.toThrow();
    await s().signOut();
    await s().signIn('maya@example.com', 'password123');
    const app = await renderApp(`/comments/${id}`);
    await flush();
    expect(app.getByText('Wish I was there')).toBeTruthy();
    let offered: string[] = [];
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementationOnce((o, cb) => {
      offered = o.options;
      cb(o.options.indexOf('Delete comment'));
    });
    await fireEvent(app.getByLabelText(/^@sam: Wish I was there\./), 'accessibilityAction', { nativeEvent: { actionName: 'more' } });
    await flush();
    expect(app.queryByText('Wish I was there')).toBeNull();
    expect(mockSocial.comments.has(sams.id)).toBe(false);
    // On her own video she can also report or block the person who wrote it.
    expect(offered).toEqual(['Delete comment', 'Report comment', 'Block @sam', 'Cancel']);
  });
});
