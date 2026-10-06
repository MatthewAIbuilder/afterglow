import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ActionSheetIOS } from 'react-native';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { builtInCatalog } from '../../state/catalog';
import { renderApp } from './appRoutes';

/** Comments on any clip in Discover (here a YouTube clip), through the real routes, with the in-memory backend. */
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
/** The first card's speech bubble, and which clip it's on (the card's own Like button sits beside it). */
const firstBubble = (app: Awaited<ReturnType<typeof renderApp>>) => app.getAllByLabelText(/^Comments(, \d+)?$/)[0];

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 11, 8, 12) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('comments on clips in Discover', () => {
  it('opens from the rail, posts, shows the count, and deletes', async () => {
    await person('sam', 'Sam');
    const app = await renderApp('/');
    await flush();
    // Every card has the bubble; none has comments yet, so it reads "Comment".
    expect(app.getAllByText('Comment').length).toBeGreaterThan(0);
    await fireEvent.press(firstBubble(app));
    await flush();
    expect(app.getByText('No comments yet. Say something nice.')).toBeTruthy();
    expect(app.getByLabelText('Close')).toBeTruthy();
    await fireEvent.changeText(app.getByLabelText('Write a comment'), '  This set was unreal  ');
    await fireEvent.press(app.getByLabelText('Post comment'));
    await flush();
    expect(app.getByText('This set was unreal')).toBeTruthy();
    expect(app.getByText('1 comment')).toBeTruthy();
    const [saved] = [...mockSocial.clipComments.values()];
    expect(saved).toMatchObject({ handle: 'sam', text: 'This set was unreal' });
    // On a YouTube clip from the catalogue, whose artist and title are at the top.
    const clip = builtInCatalog.clip(saved.clipId)!;
    expect(clip.source?.provider).toBe('youtube');
    expect(app.getByText(builtInCatalog.artist(clip.artistId)!.name, { exact: false })).toBeTruthy();

    // Back in Discover the bubble says 1.
    await act(async () => router.back());
    await flush();
    expect(firstBubble(app).props.accessibilityLabel).toBe('Comments, 1');
    expect(app.getByText('1')).toBeTruthy();

    // Hold to delete your own.
    await fireEvent.press(firstBubble(app));
    await flush();
    let offered: string[] = [];
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementationOnce((o, cb) => {
      offered = o.options;
      cb(o.options.indexOf('Delete comment'));
    });
    await fireEvent(app.getByLabelText(/^@sam: This set was unreal\./), 'accessibilityAction', { nativeEvent: { actionName: 'more' } });
    await flush();
    expect(offered).toEqual(['Delete comment', 'Cancel']);
    expect(app.queryByText('This set was unreal')).toBeNull();
    expect(mockSocial.clipComments.size).toBe(0);
    await act(async () => router.back());
    await flush();
    expect(firstBubble(app).props.accessibilityLabel).toBe('Comments');
  });

  it('someone else’s comment can be reported (and blocked people don’t show); no profile asks for one', async () => {
    const clipId = builtInCatalog.clips.find((c) => c.source?.provider === 'youtube')!.id;
    await person('maya', 'Maya');
    const mayas = await s().clipComment(clipId, 'Front row for this');
    await s().signOut();
    const sam = await person('sam', 'Sam');
    const app = await renderApp(`/comments/${clipId}?kind=clip`);
    await flush();
    expect(app.getByText('Front row for this')).toBeTruthy();
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementationOnce((o, cb) => cb(o.options.indexOf('Report comment')))
      .mockImplementationOnce((_o, cb) => cb(0));
    await fireEvent(app.getByLabelText(/^@maya: Front row for this\./), 'accessibilityAction', { nativeEvent: { actionName: 'more' } });
    await flush();
    expect(mockSocial.reports.at(-1)).toMatchObject({ by: sam, target: { kind: 'clipComment', id: mayas.id } });
    // Nobody but the writer deletes it (the support account takes reported ones down).
    await expect(s().deleteClipComment(mayas.id)).rejects.toThrow();
  });

  it('signed in without a profile: read, but create a profile to comment', async () => {
    const clipId = builtInCatalog.clips.find((c) => c.source?.provider === 'youtube')!.id;
    await s().signUp('new@example.com', 'password123');
    const app = await renderApp(`/comments/${clipId}?kind=clip`);
    await flush();
    expect(app.getByText('Create a profile to comment.')).toBeTruthy();
    expect(app.queryByLabelText('Write a comment')).toBeNull();
  });
});
