import { beforeEach, describe, expect, it } from '@jest/globals';
import { bumpCommentCount, forgetCommentCounts, knownCommentCount, rememberCommentCount, shouldAsk } from '../commentCounts';
import { commentCaption } from '../copy';
import { clipCommentFromDoc, reportFromDoc } from '../firebase/mapping';
import { validClipId } from '../models';
import { fakeSocial } from './fakeSocial';

/** Comments on clips in Discover: ids, words, documents, the count store and the service (in memory). */
describe('clip ids a comment can be on', () => {
  it('takes YouTube, SoundCloud and catalogue ids, nothing odd', () => {
    for (const id of ['yt-dQw4w9WgXcQ', 'yt-a_b-c', 'soundcloud:hedex', 'illenium-lost-lands-1', 'c.1']) expect(validClipId(id)).toBe(true);
    for (const id of ['', '-starts-with-dash', 'has space', 'a/b', 'x'.repeat(129), 'emoji🎶']) expect(validClipId(id)).toBe(false);
    expect(validClipId('x'.repeat(128))).toBe(true);
  });
});

describe('the number under the bubble', () => {
  it('is the word with none, then the count, kept short', () => {
    expect(commentCaption(undefined)).toBe('Comment');
    expect(commentCaption(0)).toBe('Comment');
    expect(commentCaption(1)).toBe('1');
    expect(commentCaption(999)).toBe('999');
    expect(commentCaption(1234)).toBe('1.2K');
  });

  it('is changed straight away when you post or delete, never below zero', () => {
    forgetCommentCounts();
    const t = { kind: 'clip' as const, id: 'yt-x' };
    bumpCommentCount(t, 1);
    expect(knownCommentCount(t)).toBeUndefined();
    rememberCommentCount(t, 2);
    bumpCommentCount(t, 1);
    expect(knownCommentCount(t)).toBe(3);
    bumpCommentCount(t, -5);
    expect(knownCommentCount(t)).toBe(0);
    expect(knownCommentCount({ kind: 'video', id: 'yt-x' })).toBeUndefined();
    // Just read: not asked again; one never read is asked once at a time.
    expect(shouldAsk(t)).toBe(false);
    expect(shouldAsk({ kind: 'clip', id: 'yt-y' })).toBe(true);
    expect(shouldAsk({ kind: 'clip', id: 'yt-y' })).toBe(false);
  });
});

describe('clip comment documents', () => {
  it('reads the server time, and drops anything malformed', () => {
    const at = Date.UTC(2026, 9, 6, 20, 0);
    expect(clipCommentFromDoc('c1', { clipId: 'yt-x', uid: 'u1', handle: 'sam', text: 'Unreal', createdAt: { toMillis: () => at } })).toEqual({
      id: 'c1',
      clipId: 'yt-x',
      uid: 'u1',
      handle: 'sam',
      text: 'Unreal',
      createdAt: new Date(at).toISOString(),
    });
    expect(clipCommentFromDoc('c2', { clipId: 'yt-x', uid: 'u1', handle: 'sam', text: '' , createdAt: { toMillis: () => at } })).toBeNull();
    expect(clipCommentFromDoc('c3', { uid: 'u1', handle: 'sam', text: 'hi', createdAt: { toMillis: () => at } })).toBeNull();
    expect(clipCommentFromDoc('c4', null)).toBeNull();
  });

  it('reports on them are read back as clip comments', () => {
    const r = reportFromDoc('r1', { by: 'u2', kind: 'clipComment', targetId: 'c1', ownerUid: 'u1', reason: 'spam', note: '', status: 'open', createdAt: { toMillis: () => 0 } });
    expect(r?.kind).toBe('clipComment');
  });
});

describe('the service (in memory)', () => {
  let social = fakeSocial();
  const s = () => social.service;
  async function person(handle: string) {
    const u = await s().signUp(`${handle}@example.com`, 'password123');
    await s().saveProfile({ handle, displayName: handle, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
    return u.uid;
  }
  beforeEach(() => {
    social = fakeSocial();
  });

  it('posts tidied words as you, oldest first, counted per clip', async () => {
    await person('sam');
    const a = await s().clipComment('yt-a', '  First!  ');
    await s().clipComment('yt-a', 'Second');
    await s().clipComment('yt-b', 'Elsewhere');
    expect(a).toMatchObject({ clipId: 'yt-a', handle: 'sam', text: 'First!' });
    expect((await s().clipComments('yt-a', 50)).map((c) => c.text)).toEqual(['First!', 'Second']);
    expect(await s().clipCommentCount('yt-a')).toBe(2);
    expect(await s().clipCommentCount('yt-c')).toBe(0);
  });

  it('reads a page at a time', async () => {
    await person('sam');
    for (let i = 0; i < 5; i++) await s().clipComment('yt-a', `n${i}`);
    const first = await s().clipComments('yt-a', 2);
    const second = await s().clipComments('yt-a', 2, first[1]);
    const third = await s().clipComments('yt-a', 2, second[1]);
    expect([...first, ...second, ...third].map((c) => c.text)).toEqual(['n0', 'n1', 'n2', 'n3', 'n4']);
  });

  it('refuses empty, unkind or too-long words, odd clip ids, and no profile', async () => {
    await person('sam');
    await expect(s().clipComment('yt-a', '   ')).rejects.toThrow();
    await expect(s().clipComment('yt-a', 'x'.repeat(301))).rejects.toThrow();
    await expect(s().clipComment('bad id', 'hi')).rejects.toThrow();
    await s().signOut();
    await s().signUp('new@example.com', 'password123');
    await expect(s().clipComment('yt-a', 'hi')).rejects.toMatchObject({ kind: 'no-profile' });
  });

  it('no signal: nothing is kept, and it says so', async () => {
    await person('sam');
    social.network.down = true;
    await expect(s().clipComment('yt-a', 'hi')).rejects.toMatchObject({ kind: 'network' });
    expect(social.clipComments.size).toBe(0);
  });

  it('only the writer deletes; the support account takes reported ones down; they go with the account', async () => {
    await person('maya');
    const mayas = await s().clipComment('yt-a', 'Mine');
    await s().signOut();
    await person('sam');
    await expect(s().deleteClipComment(mayas.id)).rejects.toThrow();
    await s().report({ kind: 'clipComment', id: mayas.id, ownerUid: mayas.uid }, 'spam');
    const sams = await s().clipComment('yt-a', 'Also mine');
    await s().deleteClipComment(sams.id);
    expect(await s().clipCommentCount('yt-a')).toBe(1);
    await s().signOut();
    await s().signIn('maya@example.com', 'password123');
    await s().deleteAccount('password123');
    expect(social.clipComments.size).toBe(0);
  });
});
