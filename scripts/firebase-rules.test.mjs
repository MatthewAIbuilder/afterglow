/**
 * Checks firestore.rules and storage.rules against the Firebase emulator:
 * handle ownership, profile limits, who may share, read and delete memories,
 * private blocks, write-only reports, crews and their updates (server-stamped
 * arrival times), and storage paths, types and sizes.
 * Not part of `npm test` (it needs Java and the emulator). To run it:
 *
 *   mkdir -p /tmp/rules && cp firestore.rules storage.rules scripts/firebase-rules.test.mjs scripts/firebase-rules.json /tmp/rules/
 *   cd /tmp/rules && mv firebase-rules.json firebase.json && npm init -y && npm i firebase-tools @firebase/rules-unit-testing firebase
 *   npx firebase emulators:exec --only firestore,storage --project demo-afterglow "node firebase-rules.test.mjs"
 */
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, getDoc, getDocs, getCountFromServer, setDoc, deleteDoc, writeBatch, updateDoc, collection, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

const env = await initializeTestEnvironment({
  projectId: 'demo-afterglow',
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8181 },
  storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
});
let pass = 0, fail = 0;
async function t(name, run) {
  try { await run(); pass++; console.log('ok  ', name); } catch (e) { fail++; console.log('FAIL', name, '-', e.message.split('\n')[0]); }
}
const A = env.authenticatedContext('uidA'), B = env.authenticatedContext('uidB'), anon = env.unauthenticatedContext();
const now = '2026-09-30T10:00:00.000Z';
const profile = (handle, over = {}) => ({ handle, displayName: 'Maya', nameLower: 'maya', bio: 'hi', festivals: [], sounds: [], showFestivals: false, showSound: false, createdAt: now, updatedAt: now, ...over });
async function claim(ctx, uid, handle, over) {
  const db = ctx.firestore(); const b = writeBatch(db);
  b.set(doc(db, 'handles', handle), { uid }); b.set(doc(db, 'profiles', uid), profile(handle, over)); return b.commit();
}

await t('signed out: can’t read profiles', () => assertFails(getDoc(doc(anon.firestore(), 'profiles', 'uidA'))));
await t('A claims @maya with a profile', () => assertSucceeds(claim(A, 'uidA', 'maya')));
await t('B can’t take @maya', () => assertFails(claim(B, 'uidB', 'maya')));
await t('B can’t write a profile with a handle it doesn’t own', () => assertFails(setDoc(doc(B.firestore(), 'profiles', 'uidB'), profile('bob'))));
await t('B claims @bob', () => assertSucceeds(claim(B, 'uidB', 'bob')));
await t('B can’t write A’s profile', () => assertFails(setDoc(doc(B.firestore(), 'profiles', 'uidA'), profile('maya'))));
await t('B can read A’s profile', () => assertSucceeds(getDoc(doc(B.firestore(), 'profiles', 'uidA'))));
await t('reserved and malformed handles refused', async () => {
  await assertFails(claim(env.authenticatedContext('uidC'), 'uidC', 'admin'));
  await assertFails(claim(env.authenticatedContext('uidC'), 'uidC', 'a..b'));
  await assertFails(claim(env.authenticatedContext('uidC'), 'uidC', 'afterglowteam'));
  await assertFails(claim(env.authenticatedContext('uidC'), 'uidC', 'ab'));
});
await t('field limits: long name, long bio, extra field, bad avatar', async () => {
  const C = env.authenticatedContext('uidC');
  await assertFails(claim(C, 'uidC', 'cara', { displayName: 'x'.repeat(41), nameLower: 'x'.repeat(41) }));
  await assertFails(claim(C, 'uidC', 'cara', { bio: 'x'.repeat(161) }));
  await assertFails(claim(C, 'uidC', 'cara', { isAdmin: true }));
  await assertFails(claim(C, 'uidC', 'cara', { avatarUrl: 'http://x/a.jpg' }));
  await assertFails(claim(C, 'uidC', 'cara', { coverUrl: 'http://x/c.jpg' }));
  await assertFails(claim(C, 'uidC', 'cara', { nameLower: 'someone else' }));
});
await t('a cover photo link must be https', () => assertSucceeds(claim(env.authenticatedContext('uidD'), 'uidD', 'dana', { coverUrl: 'https://x/c.jpg' })));
await t('A moves to @maya2 (old handle released in the same write)', async () => {
  const db = A.firestore(); const b = writeBatch(db);
  b.delete(doc(db, 'handles', 'maya')); b.set(doc(db, 'handles', 'maya2'), { uid: 'uidA' }); b.set(doc(db, 'profiles', 'uidA'), profile('maya2'));
  await assertSucceeds(b.commit());
});
await t('A can’t release the handle its profile still uses', () => assertFails(deleteDoc(doc(A.firestore(), 'handles', 'maya2'))));
await t('B can’t delete A’s handle', () => assertFails(deleteDoc(doc(B.firestore(), 'handles', 'maya2'))));
await t('a handle is never reassigned by update', () => assertFails(setDoc(doc(B.firestore(), 'handles', 'maya2'), { uid: 'uidB' })));

const mem = (id, uid, over = {}) => ({ uid, handle: uid === 'uidA' ? 'maya2' : 'bob', memoryId: 'm1', videoPath: `memories/${uid}/${id}.mov`, videoUrl: 'https://x/v.mov', capturedAt: now, createdAt: now, ...over });
await t('A shares a memory pointing at its own files', () => assertSucceeds(setDoc(doc(A.firestore(), 'memories', 'mem1'), mem('mem1', 'uidA', { thumbPath: 'memories/uidA/mem1.jpg', thumbUrl: 'https://x/t.jpg', festivalId: 'acl-26', durationSec: 42 }))));
await t('A can’t point a memory at someone else’s files', () => assertFails(setDoc(doc(A.firestore(), 'memories', 'mem2'), mem('mem2', 'uidA', { videoPath: 'memories/uidB/mem2.mov' }))));
await t('B can’t share as A', () => assertFails(setDoc(doc(B.firestore(), 'memories', 'mem3'), mem('mem3', 'uidA'))));
await t('the handle on a memory must be the owner’s', () => assertFails(setDoc(doc(A.firestore(), 'memories', 'mem4'), mem('mem4', 'uidA', { handle: 'bob' }))));
await t('over-long fields and unknown fields refused', async () => {
  await assertFails(setDoc(doc(A.firestore(), 'memories', 'mem5'), mem('mem5', 'uidA', { festivalId: 'x'.repeat(101) })));
  await assertFails(setDoc(doc(A.firestore(), 'memories', 'mem6'), mem('mem6', 'uidA', { place: 'Austin' })));
  await assertFails(setDoc(doc(A.firestore(), 'memories', 'mem7'), mem('mem7', 'uidA', { thumbUrl: 'http://x' })));
});
await t('a memory may record the video’s size, as numbers', async () => {
  await assertSucceeds(setDoc(doc(A.firestore(), 'memories', 'mem8'), mem('mem8', 'uidA', { festivalId: 'acl-26', width: 1080, height: 1920 })));
  await assertFails(setDoc(doc(A.firestore(), 'memories', 'mem9'), mem('mem9', 'uidA', { width: '1080' })));
  await assertFails(setDoc(doc(A.firestore(), 'memories', 'mem10'), mem('mem10', 'uidA', { height: 50000 })));
});
await t('Discover can list a festival’s shared memories, newest first, when signed in', async () => {
  const q = (fs) => query(collection(fs, 'memories'), where('festivalId', '==', 'acl-26'), orderBy('createdAt', 'desc'), limit(80));
  await assertSucceeds(getDocs(q(B.firestore())));
  await assertSucceeds(getDocs(query(collection(B.firestore(), 'memories'), orderBy('createdAt', 'desc'), limit(80))));
  await assertFails(getDocs(q(anon.firestore())));
});
await t('memories are never edited', () => assertFails(updateDoc(doc(A.firestore(), 'memories', 'mem1'), { artistId: 'x' })));
await t('B can read but not delete A’s memory', async () => {
  await assertSucceeds(getDoc(doc(B.firestore(), 'memories', 'mem1')));
  await assertFails(deleteDoc(doc(B.firestore(), 'memories', 'mem1')));
});
await t('A removes its memory', () => assertSucceeds(deleteDoc(doc(A.firestore(), 'memories', 'mem1'))));
await t('blocks are private', async () => {
  await assertSucceeds(setDoc(doc(A.firestore(), 'blocks', 'uidA'), { uids: ['uidB'] }));
  await assertFails(getDoc(doc(B.firestore(), 'blocks', 'uidA')));
  await assertFails(setDoc(doc(B.firestore(), 'blocks', 'uidA'), { uids: [] }));
});
await t('reports: filed as yourself, never read back', async () => {
  const r = { by: 'uidB', kind: 'profile', targetId: 'uidA', ownerUid: 'uidA', reason: 'offensive', note: '', createdAt: now };
  await assertSucceeds(setDoc(doc(B.firestore(), 'reports', 'r1'), r));
  await assertFails(setDoc(doc(B.firestore(), 'reports', 'r2'), { ...r, by: 'uidA' }));
  await assertFails(setDoc(doc(B.firestore(), 'reports', 'r3'), { ...r, reason: 'boring' }));
  await assertFails(getDoc(doc(B.firestore(), 'reports', 'r1')));
});
const follow = (from, to, over = {}) => ({ from, to, createdAt: now, ...over });
await t('follows: someone you blocked can’t follow you', () => assertFails(setDoc(doc(B.firestore(), 'follows', 'uidB_uidA'), follow('uidB', 'uidA'))));
await t('follows: A follows B', () => assertSucceeds(setDoc(doc(A.firestore(), 'follows', 'uidA_uidB'), follow('uidA', 'uidB'))));
await t('follows: only as yourself, with the right id, not yourself, only people with a profile, no extra fields', async () => {
  await assertFails(setDoc(doc(A.firestore(), 'follows', 'uidB_uidA'), follow('uidB', 'uidA')));
  await assertFails(setDoc(doc(A.firestore(), 'follows', 'x_uidB'), follow('uidA', 'uidB')));
  await assertFails(setDoc(doc(A.firestore(), 'follows', 'uidA_uidA'), follow('uidA', 'uidA')));
  await assertFails(setDoc(doc(A.firestore(), 'follows', 'uidA_uidZ'), follow('uidA', 'uidZ')));
  await assertFails(setDoc(doc(env.authenticatedContext('uidZ').firestore(), 'follows', 'uidZ_uidB'), follow('uidZ', 'uidB')));
  await assertFails(setDoc(doc(A.firestore(), 'follows', 'uidA_uidB'), follow('uidA', 'uidB', { note: 'hi' })));
});
await t('follows: lists and counts for anyone signed in, not signed out', async () => {
  const q = (fs) => query(collection(fs, 'follows'), where('to', '==', 'uidB'), orderBy('createdAt', 'desc'), limit(50));
  await assertSucceeds(getDocs(q(B.firestore())));
  await assertSucceeds(getCountFromServer(query(collection(B.firestore(), 'follows'), where('from', '==', 'uidA'))));
  await assertFails(getDocs(q(anon.firestore())));
});
await t('follows: never edited; a stranger can’t remove one', async () => {
  await assertFails(updateDoc(doc(A.firestore(), 'follows', 'uidA_uidB'), { createdAt: 'x' }));
  await assertFails(deleteDoc(doc(env.authenticatedContext('uidC').firestore(), 'follows', 'uidA_uidB')));
});
await t('follows: the person followed can remove a follower; you can unfollow', async () => {
  await assertSucceeds(deleteDoc(doc(B.firestore(), 'follows', 'uidA_uidB')));
  await assertSucceeds(setDoc(doc(A.firestore(), 'follows', 'uidA_uidB'), follow('uidA', 'uidB')));
  await assertSucceeds(deleteDoc(doc(A.firestore(), 'follows', 'uidA_uidB')));
});
await t('follows: once unblocked, B can follow A', async () => {
  await assertSucceeds(setDoc(doc(A.firestore(), 'blocks', 'uidA'), { uids: [] }));
  await assertSucceeds(setDoc(doc(B.firestore(), 'follows', 'uidB_uidA'), follow('uidB', 'uidA')));
  // Account deletion removes follows either way: A removes B's follow of A.
  await assertSucceeds(deleteDoc(doc(A.firestore(), 'follows', 'uidB_uidA')));
});
const F = env.authenticatedContext('uidF'), G = env.authenticatedContext('uidG');
const scan = (ctx, me, them, code, extra = true) => {
  const db = ctx.firestore(); const b = writeBatch(db);
  b.set(doc(db, 'friendLinks', `${me}_${them}`), { from: me, to: them, code, createdAt: now });
  b.set(doc(db, 'follows', `${me}_${them}`), follow(me, them));
  if (extra) b.set(doc(db, 'follows', `${them}_${me}`), follow(them, me, { via: 'code' }));
  return b.commit();
};
await t('friend codes: set your own (server time), never read back, not someone else’s', async () => {
  await assertSucceeds(claim(F, 'uidF', 'fran'));
  await assertSucceeds(claim(G, 'uidG', 'gus'));
  await assertSucceeds(setDoc(doc(F.firestore(), 'friendCodes', 'uidF'), { code: 'abcd2345wxyz', updatedAt: serverTimestamp() }));
  await assertFails(getDoc(doc(F.firestore(), 'friendCodes', 'uidF')));
  await assertFails(setDoc(doc(G.firestore(), 'friendCodes', 'uidF'), { code: 'gggg2345wxyz', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(F.firestore(), 'friendCodes', 'uidF'), { code: 'abcd2345wxyz', updatedAt: now }));
  await assertFails(setDoc(doc(F.firestore(), 'friendCodes', 'uidF'), { code: 'BAD CODE!', updatedAt: serverTimestamp() }));
});
await t('friend codes: the wrong code, or no proof, can’t make someone follow you', async () => {
  await assertFails(scan(G, 'uidG', 'uidF', 'wrongcode2345'));
  await assertFails(setDoc(doc(G.firestore(), 'follows', 'uidF_uidG'), follow('uidF', 'uidG', { via: 'code' })));
});
await t('friend codes: scanning the right code makes it both ways, and again is fine', async () => {
  await assertSucceeds(scan(G, 'uidG', 'uidF', 'abcd2345wxyz'));
  await assertSucceeds(getDoc(doc(G.firestore(), 'follows', 'uidF_uidG')));
  // A second scan only renews the proof (the follows already exist and are never rewritten).
  await assertSucceeds(setDoc(doc(G.firestore(), 'friendLinks', 'uidG_uidF'), { from: 'uidG', to: 'uidF', code: 'abcd2345wxyz', createdAt: now }));
  await assertSucceeds(getDoc(doc(G.firestore(), 'friendLinks', 'uidG_uidF')));
  await assertFails(getDoc(doc(F.firestore(), 'friendLinks', 'uidG_uidF')));
  // F can still end either side.
  await assertSucceeds(deleteDoc(doc(F.firestore(), 'follows', 'uidF_uidG')));
});
await t('friend codes: a new code stops old ones; someone blocked can’t use one', async () => {
  await assertSucceeds(setDoc(doc(F.firestore(), 'friendCodes', 'uidF'), { code: 'newcode23456', updatedAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(doc(G.firestore(), 'follows', 'uidG_uidF')));
  await assertFails(scan(G, 'uidG', 'uidF', 'abcd2345wxyz'));
  await assertSucceeds(setDoc(doc(F.firestore(), 'blocks', 'uidF'), { uids: ['uidG'] }));
  await assertFails(scan(G, 'uidG', 'uidF', 'newcode23456'));
  await assertSucceeds(setDoc(doc(F.firestore(), 'blocks', 'uidF'), { uids: [] }));
  await assertSucceeds(scan(G, 'uidG', 'uidF', 'newcode23456'));
});
await t('likes: set up a video of B’s to like', () => assertSucceeds(setDoc(doc(B.firestore(), 'memories', 'memB'), mem('memB', 'uidB'))));
const like = (memoryId, owner, uid, over = {}) => ({ memoryId, owner, uid, createdAt: now, ...over });
await t('likes: A likes B’s video', () => assertSucceeds(setDoc(doc(A.firestore(), 'likes', 'memB_uidA'), like('memB', 'uidB', 'uidA'))));
await t('likes: only as yourself, the right id and owner, not your own video, not a missing one, no extra fields', async () => {
  await assertFails(setDoc(doc(A.firestore(), 'likes', 'memB_uidC'), like('memB', 'uidB', 'uidC')));
  await assertFails(setDoc(doc(A.firestore(), 'likes', 'x_uidA'), like('memB', 'uidB', 'uidA')));
  await assertFails(setDoc(doc(A.firestore(), 'likes', 'memB_uidA'), like('memB', 'uidA', 'uidA')));
  await assertFails(setDoc(doc(B.firestore(), 'likes', 'memB_uidB'), like('memB', 'uidB', 'uidB')));
  await assertFails(setDoc(doc(A.firestore(), 'likes', 'nope_uidA'), like('nope', 'uidB', 'uidA')));
  await assertFails(setDoc(doc(A.firestore(), 'likes', 'memB_uidA'), like('memB', 'uidB', 'uidA', { note: 'x' })));
});
await t('likes: counted and listed for anyone signed in, not signed out', async () => {
  await assertSucceeds(getCountFromServer(query(collection(B.firestore(), 'likes'), where('memoryId', '==', 'memB'))));
  await assertSucceeds(getDocs(query(collection(B.firestore(), 'likes'), where('owner', '==', 'uidB'), orderBy('createdAt', 'desc'), limit(30))));
  await assertFails(getDocs(query(collection(anon.firestore(), 'likes'), where('memoryId', '==', 'memB'))));
});
await t('likes: never edited; a stranger can’t remove one; the owner and the liker can', async () => {
  await assertFails(updateDoc(doc(A.firestore(), 'likes', 'memB_uidA'), { createdAt: 'x' }));
  await assertFails(deleteDoc(doc(env.authenticatedContext('uidC').firestore(), 'likes', 'memB_uidA')));
  await assertSucceeds(deleteDoc(doc(B.firestore(), 'likes', 'memB_uidA')));
  await assertSucceeds(setDoc(doc(A.firestore(), 'likes', 'memB_uidA'), like('memB', 'uidB', 'uidA')));
  await assertSucceeds(deleteDoc(doc(A.firestore(), 'likes', 'memB_uidA')));
});
await t('likes: not on the video of someone who blocked you', async () => {
  await assertSucceeds(setDoc(doc(B.firestore(), 'blocks', 'uidB'), { uids: ['uidA'] }));
  await assertFails(setDoc(doc(A.firestore(), 'likes', 'memB_uidA'), like('memB', 'uidB', 'uidA')));
  await assertSucceeds(setDoc(doc(B.firestore(), 'blocks', 'uidB'), { uids: [] }));
});
const C = env.authenticatedContext('uidC');
const comment = (over = {}) => ({ memoryId: 'memB', owner: 'uidB', uid: 'uidA', handle: 'maya2', text: 'What a drop', createdAt: now, ...over });
await t('comments: A comments on B’s video as itself, with its own handle; anyone signed in reads them', async () => {
  await assertSucceeds(setDoc(doc(A.firestore(), 'comments', 'c1'), comment()));
  await assertSucceeds(setDoc(doc(B.firestore(), 'comments', 'c2'), comment({ uid: 'uidB', handle: 'bob', text: 'Thanks!' })));
  await assertSucceeds(getDocs(query(collection(A.firestore(), 'comments'), where('memoryId', '==', 'memB'), orderBy('createdAt', 'asc'))));
  await assertFails(getDocs(query(collection(anon.firestore(), 'comments'), where('memoryId', '==', 'memB'))));
});
await t('comments: not as someone else, not with another handle, not empty or too long, not on a missing video or the wrong owner, no extra fields', async () => {
  const db = A.firestore();
  await assertFails(setDoc(doc(db, 'comments', 'c3'), comment({ uid: 'uidB' })));
  await assertFails(setDoc(doc(db, 'comments', 'c3'), comment({ handle: 'bob' })));
  await assertFails(setDoc(doc(db, 'comments', 'c3'), comment({ text: '' })));
  await assertFails(setDoc(doc(db, 'comments', 'c3'), comment({ text: 'x'.repeat(301) })));
  await assertFails(setDoc(doc(db, 'comments', 'c3'), comment({ memoryId: 'nope' })));
  await assertFails(setDoc(doc(db, 'comments', 'c3'), comment({ owner: 'uidA' })));
  await assertFails(setDoc(doc(db, 'comments', 'c3'), comment({ pinned: true })));
  await assertFails(setDoc(doc(C.firestore(), 'comments', 'c3'), comment({ uid: 'uidC', handle: 'cara' })));
});
await t('comments: never edited; removed by the writer or the video’s owner, not a stranger', async () => {
  await assertFails(updateDoc(doc(A.firestore(), 'comments', 'c1'), { text: 'changed' }));
  await assertFails(deleteDoc(doc(C.firestore(), 'comments', 'c1')));
  await assertSucceeds(deleteDoc(doc(B.firestore(), 'comments', 'c1')));
  await assertSucceeds(deleteDoc(doc(B.firestore(), 'comments', 'c2')));
});
await t('comments: not on the video of someone who blocked you', async () => {
  await assertSucceeds(setDoc(doc(B.firestore(), 'blocks', 'uidB'), { uids: ['uidA'] }));
  await assertFails(setDoc(doc(A.firestore(), 'comments', 'c4'), comment()));
  await assertSucceeds(setDoc(doc(B.firestore(), 'blocks', 'uidB'), { uids: [] }));
});
const crew = (over = {}) => ({ festivalId: 'acl-26', name: 'The crew', owner: 'uidA', members: ['uidA'], createdAt: now, ...over });
await t('crews: A starts a crew as its only member', () => assertSucceeds(setDoc(doc(A.firestore(), 'crews', 'c1'), crew())));
await t('crews: not for someone else, not with others in it, not without a profile, no extra fields, name limits', async () => {
  await assertFails(setDoc(doc(B.firestore(), 'crews', 'c2'), crew()));
  await assertFails(setDoc(doc(A.firestore(), 'crews', 'c2'), crew({ members: ['uidA', 'uidB'] })));
  await assertFails(setDoc(doc(C.firestore(), 'crews', 'c2'), crew({ owner: 'uidC', members: ['uidC'] })));
  await assertFails(setDoc(doc(A.firestore(), 'crews', 'c2'), crew({ secret: 1 })));
  await assertFails(setDoc(doc(A.firestore(), 'crews', 'c2'), crew({ name: '' })));
  await assertFails(setDoc(doc(A.firestore(), 'crews', 'c2'), crew({ name: 'x'.repeat(41) })));
});
await t('crews: anyone signed in with the link can see it; signed out can’t', async () => {
  await assertSucceeds(getDoc(doc(B.firestore(), 'crews', 'c1')));
  await assertFails(getDoc(doc(anon.firestore(), 'crews', 'c1')));
});
await t('crews: you list only crews you’re in', async () => {
  await assertSucceeds(getDocs(query(collection(A.firestore(), 'crews'), where('members', 'array-contains', 'uidA'))));
  await assertFails(getDocs(query(collection(B.firestore(), 'crews'), where('members', 'array-contains', 'uidA'))));
  await assertFails(getDocs(collection(B.firestore(), 'crews')));
});
await t('crews: B joins, adding only itself', async () => {
  await assertFails(updateDoc(doc(B.firestore(), 'crews', 'c1'), { members: ['uidA', 'uidB', 'uidC'] }));
  await assertFails(updateDoc(doc(B.firestore(), 'crews', 'c1'), { members: ['uidA', 'uidB'], name: 'Mine now' }));
  await assertFails(updateDoc(doc(B.firestore(), 'crews', 'c1'), { members: ['uidB'] , owner: 'uidB' }));
  await assertSucceeds(updateDoc(doc(B.firestore(), 'crews', 'c1'), { members: ['uidA', 'uidB'] }));
});
await t('crews: not without a profile, not when full, not if the owner blocked you', async () => {
  await assertFails(updateDoc(doc(C.firestore(), 'crews', 'c1'), { members: ['uidA', 'uidB', 'uidC'] }));
  const full = Array.from({ length: 12 }, (_, i) => (i ? `u${i}` : 'uidA'));
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'crews', 'full'), crew({ members: full })));
  await assertFails(updateDoc(doc(B.firestore(), 'crews', 'full'), { members: [...full, 'uidB'] }));
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'crews', 'c3'), crew()));
  await assertSucceeds(setDoc(doc(A.firestore(), 'blocks', 'uidA'), { uids: ['uidB'] }));
  await assertFails(updateDoc(doc(B.firestore(), 'crews', 'c3'), { members: ['uidA', 'uidB'] }));
  await assertSucceeds(setDoc(doc(A.firestore(), 'blocks', 'uidA'), { uids: [] }));
});
await t('crews: members share picks; others can’t read or write them', async () => {
  await assertSucceeds(setDoc(doc(B.firestore(), 'crews', 'c1', 'picks', 'uidB'), { artists: ['skrillex'], updatedAt: now }));
  await assertSucceeds(setDoc(doc(A.firestore(), 'crews', 'c1', 'picks', 'uidA'), { artists: ['skrillex', 'levity'], updatedAt: now }));
  await assertSucceeds(getDocs(collection(A.firestore(), 'crews', 'c1', 'picks')));
  await assertFails(setDoc(doc(A.firestore(), 'crews', 'c1', 'picks', 'uidB'), { artists: [], updatedAt: now }));
  await assertFails(getDocs(collection(C.firestore(), 'crews', 'c1', 'picks')));
  await assertFails(setDoc(doc(C.firestore(), 'crews', 'c1', 'picks', 'uidC'), { artists: [], updatedAt: now }));
  await assertFails(setDoc(doc(B.firestore(), 'crews', 'c1', 'picks', 'uidB'), { artists: [], updatedAt: now, note: 'x' }));
  await assertFails(setDoc(doc(B.firestore(), 'crews', 'c1', 'picks', 'uidB'), { artists: Array(101).fill('x'), updatedAt: now }));
});
const update = (over = {}) => ({ uid: 'uidB', kind: 'checkin', atMs: Date.now() - 3600_000, sentAt: serverTimestamp(), festivalId: 'acl-26', stage: 'Main Stage', note: 'Meet at our spot', ...over });
await t('crew updates: a member posts as themselves, stamped with the server’s time; members read them', async () => {
  await assertSucceeds(setDoc(doc(B.firestore(), 'crews', 'c1', 'updates', 'u000001'), update()));
  await assertSucceeds(setDoc(doc(B.firestore(), 'crews', 'c1', 'updates', 'u000002'), update({ kind: 'video', videoUrl: 'https://x/v.mp4', durationSec: 30 })));
  await assertSucceeds(getDocs(query(collection(A.firestore(), 'crews', 'c1', 'updates'), where('atMs', '>=', 0), orderBy('atMs', 'desc'), limit(50))));
  await assertFails(getDocs(collection(C.firestore(), 'crews', 'c1', 'updates')));
});
await t('crew updates: not as someone else, not from the future or long ago, not a faked arrival time, not off-festival', async () => {
  const db = B.firestore(); const at = (id) => doc(db, 'crews', 'c1', 'updates', id);
  await assertFails(setDoc(at('u000003'), update({ uid: 'uidA' })));
  await assertFails(setDoc(at('u000004'), update({ atMs: Date.now() + 3600_000 })));
  await assertFails(setDoc(at('u000005'), update({ atMs: Date.now() - 8 * 24 * 3600_000 })));
  await assertFails(setDoc(at('u000006'), update({ sentAt: Date.now() - 3600_000 })));
  await assertFails(setDoc(at('u000007'), update({ festivalId: 'edc-orlando-26' })));
  await assertFails(setDoc(at('u000008'), update({ kind: 'video' })));
  await assertFails(setDoc(at('u000009'), update({ note: 'x'.repeat(81) })));
  await assertFails(setDoc(at('u000010'), update({ secret: 1 })));
  await assertFails(setDoc(at('u000011'), update({ kind: 'video', videoUrl: 'http://x/v.mp4' })));
  await assertFails(setDoc(doc(C.firestore(), 'crews', 'c1', 'updates', 'u000012'), update({ uid: 'uidC' })));
});
await t('crew updates: replies answer an update in the same crew, with words, never a video', async () => {
  const at = (db, id) => doc(db, 'crews', 'c1', 'updates', id);
  const reply = (over = {}) => update({ uid: 'uidA', kind: 'reply', replyTo: 'u000001', note: 'On my way', stage: undefined, ...over });
  const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  await assertSucceeds(setDoc(at(A.firestore(), 'r000001'), clean(reply())));
  await assertFails(setDoc(at(A.firestore(), 'r000002'), clean(reply({ replyTo: 'u999999' }))));
  await assertFails(setDoc(at(A.firestore(), 'r000003'), clean(reply({ note: '' }))));
  await assertFails(setDoc(at(A.firestore(), 'r000004'), clean(reply({ replyTo: undefined }))));
  await assertFails(setDoc(at(A.firestore(), 'r000005'), clean(reply({ videoUrl: 'https://x/v.mp4' }))));
  await assertFails(setDoc(at(A.firestore(), 'r000006'), clean(update({ uid: 'uidA', replyTo: 'u000001' }))));
  await assertFails(setDoc(at(C.firestore(), 'r000007'), clean(reply({ uid: 'uidC' }))));
});
await t('crew meeting spot: members set it as themselves with the server time; others can’t read or write it', async () => {
  const meet = (db) => doc(db, 'crews', 'c1', 'meta', 'meet');
  await assertSucceeds(setDoc(meet(B.firestore()), { text: 'By the big tree', by: 'uidB', at: serverTimestamp() }));
  await assertSucceeds(getDoc(meet(A.firestore())));
  await assertSucceeds(setDoc(meet(A.firestore()), { text: 'Main Stage left', by: 'uidA', at: serverTimestamp() }));
  await assertFails(setDoc(meet(A.firestore()), { text: 'x', by: 'uidB', at: serverTimestamp() }));
  await assertFails(setDoc(meet(A.firestore()), { text: 'x'.repeat(81), by: 'uidA', at: serverTimestamp() }));
  await assertFails(setDoc(meet(A.firestore()), { text: '', by: 'uidA', at: serverTimestamp() }));
  await assertFails(setDoc(meet(A.firestore()), { text: 'x', by: 'uidA', at: Date.now() }));
  await assertFails(setDoc(doc(A.firestore(), 'crews', 'c1', 'meta', 'other'), { text: 'x', by: 'uidA', at: serverTimestamp() }));
  await assertFails(getDoc(meet(C.firestore())));
  await assertFails(setDoc(meet(C.firestore()), { text: 'x', by: 'uidC', at: serverTimestamp() }));
});
await t('crew updates: “can’t find you” only on a check-in', async () => {
  const at = (id) => doc(B.firestore(), 'crews', 'c1', 'updates', id);
  await assertSucceeds(setDoc(at('l000001'), update({ lost: true, note: 'Can’t find you' })));
  await assertFails(setDoc(at('l000002'), update({ lost: false })));
  await assertFails(setDoc(at('l000003'), update({ lost: true, kind: 'video', videoUrl: 'https://x/v.mp4' })));
});
await t('crew updates: “I’m OK” and “come find me” only on a check-in', async () => {
  const at = (id) => doc(B.firestore(), 'crews', 'c1', 'updates', id);
  await assertSucceeds(setDoc(at('k000001'), update({ care: 'ok', note: 'I’m OK' })));
  await assertSucceeds(setDoc(at('k000002'), update({ care: 'help', note: 'Not feeling great' })));
  await assertFails(setDoc(at('k000003'), update({ care: 'fine' })));
  await assertFails(setDoc(at('k000004'), update({ care: 'ok', kind: 'video', videoUrl: 'https://x/v.mp4' })));
});
await t('crew updates: never edited; removed by the author or the owner', async () => {
  await assertFails(updateDoc(doc(B.firestore(), 'crews', 'c1', 'updates', 'u000001'), { note: 'changed' }));
  await assertFails(deleteDoc(doc(C.firestore(), 'crews', 'c1', 'updates', 'u000001')));
  await assertSucceeds(deleteDoc(doc(B.firestore(), 'crews', 'c1', 'updates', 'u000001')));
  await assertSucceeds(deleteDoc(doc(A.firestore(), 'crews', 'c1', 'updates', 'u000002')));
});
await t('storage: crew videos go only in your own folder; signed out can’t watch; only you remove them', async () => {
  await assertSucceeds(uploadBytes(ref(B.storage(), 'crews/c1/uidB/u000002.mp4'), new Uint8Array(1000), { contentType: 'video/mp4' }));
  await assertFails(uploadBytes(ref(B.storage(), 'crews/c1/uidA/u000002.mp4'), new Uint8Array(10), { contentType: 'video/mp4' }));
  // A retry after a send stopped part way writes over your own file; never someone else's.
  await assertSucceeds(uploadBytes(ref(B.storage(), 'crews/c1/uidB/u000002.mp4'), new Uint8Array(1200), { contentType: 'video/mp4' }));
  await assertFails(uploadBytes(ref(A.storage(), 'crews/c1/uidB/u000002.mp4'), new Uint8Array(10), { contentType: 'video/mp4' }));
  await assertFails(uploadBytes(ref(B.storage(), 'crews/c1/uidB/x.exe'), new Uint8Array(10), { contentType: 'application/octet-stream' }));
  await assertSucceeds(getBytes(ref(A.storage(), 'crews/c1/uidB/u000002.mp4')));
  await assertFails(getBytes(ref(anon.storage(), 'crews/c1/uidB/u000002.mp4')));
  await assertFails(deleteObject(ref(A.storage(), 'crews/c1/uidB/u000002.mp4')));
  await assertSucceeds(deleteObject(ref(B.storage(), 'crews/c1/uidB/u000002.mp4')));
});
await t('crews: only the owner renames, removes people or deletes', async () => {
  await assertFails(updateDoc(doc(B.firestore(), 'crews', 'c1'), { name: 'B’s crew' }));
  await assertFails(deleteDoc(doc(B.firestore(), 'crews', 'c1')));
  await assertSucceeds(updateDoc(doc(A.firestore(), 'crews', 'c1'), { name: 'Weekend 1' }));
  await assertFails(updateDoc(doc(A.firestore(), 'crews', 'c1'), { members: ['uidA', 'uidB', 'uidC'] }));
  await assertSucceeds(deleteDoc(doc(A.firestore(), 'crews', 'c1', 'picks', 'uidB')));
  await assertSucceeds(updateDoc(doc(A.firestore(), 'crews', 'c1'), { members: ['uidA'] }));
  await assertFails(getDocs(collection(B.firestore(), 'crews', 'c1', 'picks')));
});
await t('crews: leaving removes only yourself; an owner hands it on; the last one out deletes it', async () => {
  await assertSucceeds(updateDoc(doc(B.firestore(), 'crews', 'c1'), { members: ['uidA', 'uidB'] }));
  await assertFails(updateDoc(doc(B.firestore(), 'crews', 'c1'), { members: ['uidB'] }));
  await assertFails(updateDoc(doc(B.firestore(), 'crews', 'c1'), { members: ['uidA'], owner: 'uidA', name: 'x' }));
  await assertFails(updateDoc(doc(A.firestore(), 'crews', 'c1'), { members: ['uidB'], owner: 'uidC' }));
  await assertSucceeds(deleteDoc(doc(A.firestore(), 'crews', 'c1', 'picks', 'uidA')));
  await assertSucceeds(updateDoc(doc(A.firestore(), 'crews', 'c1'), { members: ['uidB'], owner: 'uidB' }));
  await assertSucceeds(deleteDoc(doc(B.firestore(), 'crews', 'c1')));
});
await t('account deletion: profile, handle and blocks go in one write', async () => {
  const db = A.firestore(); const b = writeBatch(db);
  b.delete(doc(db, 'handles', 'maya2')); b.delete(doc(db, 'profiles', 'uidA')); b.delete(doc(db, 'blocks', 'uidA'));
  await assertSucceeds(b.commit());
});

const bytes = (n) => new Uint8Array(n);
await t('storage: upload your own video and still', async () => {
  await assertSucceeds(uploadBytes(ref(B.storage(), 'memories/uidB/abc.mp4'), bytes(1000), { contentType: 'video/mp4' }));
  await assertSucceeds(uploadBytes(ref(B.storage(), 'memories/uidB/abc.jpg'), bytes(1000), { contentType: 'image/jpeg' }));
});
await t('storage: not into someone else’s folder, not odd files', async () => {
  await assertFails(uploadBytes(ref(A.storage(), 'memories/uidB/x.mp4'), bytes(10), { contentType: 'video/mp4' }));
  await assertFails(uploadBytes(ref(B.storage(), 'memories/uidB/x.exe'), bytes(10), { contentType: 'application/octet-stream' }));
  await assertFails(uploadBytes(ref(B.storage(), 'memories/uidB/x.jpg'), bytes(10), { contentType: 'text/html' }));
  await assertFails(uploadBytes(ref(B.storage(), 'memories/uidB/x.mp4'), bytes(10), { contentType: 'image/jpeg' }));
});
await t('storage: signed-in people can watch; signed-out can’t', async () => {
  await assertSucceeds(getBytes(ref(A.storage(), 'memories/uidB/abc.mp4')));
  await assertFails(getBytes(ref(anon.storage(), 'memories/uidB/abc.mp4')));
});
await t('storage: only you delete your files', async () => {
  await assertFails(deleteObject(ref(A.storage(), 'memories/uidB/abc.mp4')));
  await assertSucceeds(deleteObject(ref(B.storage(), 'memories/uidB/abc.mp4')));
});
await t('storage: your own profile photo only', async () => {
  await assertSucceeds(uploadBytes(ref(A.storage(), 'avatars/uidA.jpg'), bytes(100), { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(ref(A.storage(), 'avatars/uidB.jpg'), bytes(100), { contentType: 'image/jpeg' }));
  await assertSucceeds(deleteObject(ref(A.storage(), 'avatars/uidA.jpg')));
  // Cover photos: your own, JPEG only.
  await assertSucceeds(uploadBytes(ref(A.storage(), 'covers/uidA.jpg'), bytes(100), { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(ref(A.storage(), 'covers/uidB.jpg'), bytes(100), { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(ref(A.storage(), 'covers/uidA.jpg'), bytes(100), { contentType: 'video/mp4' }));
});

await t('founders: numbered in order by the shared counter, never chosen, never changed', async () => {
  const claimAs = async (ctx, uid, n, countAfter = n) => {
    const db = ctx.firestore(); const b = writeBatch(db);
    b.set(doc(db, 'counters', 'founders'), { count: countAfter });
    b.set(doc(db, 'founders', uid), { number: n, at: serverTimestamp() });
    return b.commit();
  };
  const F1 = env.authenticatedContext('uidF1'), F2 = env.authenticatedContext('uidF2'), F3 = env.authenticatedContext('uidF3');
  // Needs a profile.
  await assertFails(claimAs(F1, 'uidF1', 1));
  await claim(F1, 'uidF1', 'fone'); await claim(F2, 'uidF2', 'ftwo'); await claim(F3, 'uidF3', 'fthree');
  // Can't skip ahead or claim without the counter moving with it.
  await assertFails(claimAs(F1, 'uidF1', 5));
  await assertFails(setDoc(doc(F1.firestore(), 'founders', 'uidF1'), { number: 1, at: serverTimestamp() }));
  await assertSucceeds(claimAs(F1, 'uidF1', 1));
  // Not twice, and not for someone else.
  await assertFails(claimAs(F1, 'uidF1', 2));
  await assertFails(claimAs(F2, 'uidF3', 2));
  await assertSucceeds(claimAs(F2, 'uidF2', 2));
  // The counter can't be moved on its own, or backwards.
  await assertFails(setDoc(doc(F3.firestore(), 'counters', 'founders'), { count: 3 }));
  await assertFails(claimAs(F3, 'uidF3', 1, 1));
  // Anyone can see a founder number; nobody changes it.
  await assertSucceeds(getDoc(doc(anon.firestore(), 'founders', 'uidF1')));
  await assertFails(updateDoc(doc(F1.firestore(), 'founders', 'uidF1'), { number: 99 }));
  await assertFails(deleteDoc(doc(F2.firestore(), 'founders', 'uidF1')));
  await assertSucceeds(deleteDoc(doc(F1.firestore(), 'founders', 'uidF1')));
});
await t('founders: no more than 100', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'counters', 'founders'), { count: 100 }));
  const F4 = env.authenticatedContext('uidF4');
  await claim(F4, 'uidF4', 'ffour');
  const db = F4.firestore(); const b = writeBatch(db);
  b.set(doc(db, 'counters', 'founders'), { count: 101 });
  b.set(doc(db, 'founders', 'uidF4'), { number: 101, at: serverTimestamp() });
  await assertFails(b.commit());
});
await t('flairs: anyone can see them, nobody writes one from the app', async () => {
  await assertSucceeds(getDoc(doc(anon.firestore(), 'flairs', 'uidA')));
  await assertFails(setDoc(doc(A.firestore(), 'flairs', 'uidA'), { kind: 'artist', caption: 'Artist' }));
});
const ADMIN = env.authenticatedContext('uidAdmin', { email: 'afterglowmusic.support@gmail.com', email_verified: true });
const NOT_VERIFIED = env.authenticatedContext('uidFake', { email: 'afterglowmusic.support@gmail.com', email_verified: false });
const msg = (uid, over = {}) => ({ uid, topic: 'help', text: 'The map won’t load', status: 'open', createdAt: serverTimestamp(), ...over });
await t('support: you send messages as yourself, and read only yours', async () => {
  await assertSucceeds(setDoc(doc(A.firestore(), 'support', 's1'), msg('uidA', { handle: 'maya2', email: 'a@x.com', platform: 'ios' })));
  await assertFails(setDoc(doc(A.firestore(), 'support', 's2'), msg('uidB')));
  await assertFails(setDoc(doc(A.firestore(), 'support', 's3'), msg('uidA', { topic: 'rant' })));
  await assertFails(setDoc(doc(A.firestore(), 'support', 's4'), msg('uidA', { status: 'answered' })));
  await assertFails(setDoc(doc(A.firestore(), 'support', 's5'), msg('uidA', { text: 'x'.repeat(1001) })));
  await assertSucceeds(getDoc(doc(A.firestore(), 'support', 's1')));
  await assertFails(getDoc(doc(B.firestore(), 'support', 's1')));
  await assertSucceeds(getDocs(query(collection(A.firestore(), 'support'), where('uid', '==', 'uidA'))));
  await assertFails(getDocs(collection(B.firestore(), 'support')));
  await assertFails(updateDoc(doc(A.firestore(), 'support', 's1'), { reply: 'self-answer', status: 'answered' }));
});
await t('support account: reads every message and replies, once its email is verified', async () => {
  await assertSucceeds(getDocs(collection(ADMIN.firestore(), 'support')));
  await assertFails(getDocs(collection(NOT_VERIFIED.firestore(), 'support')));
  await assertSucceeds(updateDoc(doc(ADMIN.firestore(), 'support', 's1'), { reply: 'Try again now', repliedAt: '2026-10-03T10:00:00Z', status: 'answered' }));
  await assertFails(updateDoc(doc(ADMIN.firestore(), 'support', 's1'), { text: 'changed' }));
  await assertFails(updateDoc(doc(NOT_VERIFIED.firestore(), 'support', 's1'), { status: 'closed' }));
});
await t('support account: reads and resolves reports, takes down a video, counts crews', async () => {
  await assertSucceeds(setDoc(doc(B.firestore(), 'reports', 'rep1'), { by: 'uidB', kind: 'memory', targetId: 'mem1', ownerUid: 'uidA', reason: 'spam', note: '', createdAt: now }));
  await assertFails(getDoc(doc(B.firestore(), 'reports', 'rep1')));
  await assertSucceeds(getDocs(collection(ADMIN.firestore(), 'reports')));
  await assertSucceeds(updateDoc(doc(ADMIN.firestore(), 'reports', 'rep1'), { status: 'resolved', resolvedAt: now }));
  await assertFails(updateDoc(doc(ADMIN.firestore(), 'reports', 'rep1'), { reason: 'other' }));
  await assertFails(getDocs(collection(NOT_VERIFIED.firestore(), 'reports')));
  await assertSucceeds(getCountFromServer(collection(ADMIN.firestore(), 'crews')));
  await assertFails(getCountFromServer(collection(B.firestore(), 'crews')));
  await assertFails(deleteDoc(doc(NOT_VERIFIED.firestore(), 'memories', 'mem8')));
  await assertSucceeds(deleteDoc(doc(ADMIN.firestore(), 'memories', 'mem8')));
});
console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
