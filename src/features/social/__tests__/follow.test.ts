import { beforeEach, describe, expect, it } from '@jest/globals';
import { fakeSocial } from './fakeSocial';

/**
 * Following, against the in-memory backend (which follows the same rules as
 * firestore.rules, checked separately on the emulator).
 */
let social = fakeSocial();
const s = () => social.service;

async function person(handle: string) {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: handle, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
}
const as = (handle: string) => s().signIn(`${handle}@example.com`, 'password123');

let maya = '';
let sam = '';
beforeEach(async () => {
  social = fakeSocial();
  maya = await person('maya');
  sam = await person('sam');
});

describe('following', () => {
  it('follow, count, list and unfollow', async () => {
    await s().follow(maya);
    await s().follow(maya);
    expect(await s().followCounts(maya)).toEqual({ followers: 1, following: 0 });
    expect(await s().followCounts(sam)).toEqual({ followers: 0, following: 1 });
    expect(await s().followers(maya, 10)).toEqual([sam]);
    expect(await s().following(sam, 10)).toEqual([maya]);
    await s().unfollow(maya);
    expect(await s().followCounts(maya)).toEqual({ followers: 0, following: 0 });
  });

  it('lists newest first, at most max', async () => {
    const cara = await person('cara');
    await s().follow(maya);
    await s().follow(sam);
    expect(await s().following(cara, 10)).toEqual([sam, maya]);
    expect(await s().following(cara, 1)).toEqual([sam]);
  });

  it('not yourself, not someone without a profile, not someone who blocked you', async () => {
    await expect(s().follow(sam)).rejects.toThrow();
    await expect(s().follow('nobody')).rejects.toThrow();
    await as('maya');
    await s().setBlocked(sam, true);
    await as('sam');
    await expect(s().follow(maya)).rejects.toThrow();
  });

  it('you can remove a follower', async () => {
    await s().follow(maya);
    await as('maya');
    await s().removeFollower(sam);
    expect(await s().followers(maya, 10)).toEqual([]);
  });

  it('videos from the people you follow, and only theirs', async () => {
    await as('maya');
    await s().shareMemory({ memoryId: 'm1', videoUri: 'file:///1.mov', capturedAt: '2026-12-04T22:00:00.000Z', artistId: 'hedex', festivalId: 'cyclops-cove-4' });
    await s().shareMemory({ memoryId: 'm2', videoUri: 'file:///2.mov', capturedAt: '2026-12-05T22:00:00.000Z', artistId: 'hedex', festivalId: 'cyclops-cove-4' });
    await as('sam');
    await s().shareMemory({ memoryId: 'm3', videoUri: 'file:///3.mov', capturedAt: '2026-12-05T22:00:00.000Z' });
    const got = await s().memoriesBy([maya], 10);
    expect(got).toHaveLength(2);
    expect(got.every((m) => m.uid === maya)).toBe(true);
    expect(await s().memoriesBy([maya], 1)).toHaveLength(1);
    expect(await s().memoriesBy([], 10)).toEqual([]);
  });

  it('deleting an account removes its follows both ways', async () => {
    await s().follow(maya);
    await as('maya');
    await s().follow(sam);
    await s().deleteAccount('password123');
    await as('sam');
    expect(await s().followCounts(sam)).toEqual({ followers: 0, following: 0 });
  });
});
