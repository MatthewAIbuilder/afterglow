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
import { doc, getDoc, getDocs, getCountFromServer, setDoc, deleteDoc, writeBatch, updateDoc, collection, query, where, orderBy, limit, serverTimestamp, deleteField } from 'firebase/firestore';
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
await t('a profile lists the one-night shows you’re going to (up to 30)', async () => {
  await assertSucceeds(setDoc(doc(A.firestore(), 'profiles', 'uidA'), profile('maya', { shows: ['edm-1', 'edm-2'] })));
  await assertFails(setDoc(doc(A.firestore(), 'profiles', 'uidA'), profile('maya', { shows: Array.from({ length: 31 }, (_, i) => `edm-${i}`) })));
  await assertFails(setDoc(doc(A.firestore(), 'profiles', 'uidA'), profile('maya', { shows: 'edm-1' })));
  await assertSucceeds(setDoc(doc(A.firestore(), 'profiles', 'uidA'), profile('maya')));
});
await t('B can’t write a profile with a handle it doesn’t own', () => assertFails(setDoc(doc(B.firestore(), 'profiles', 'uidB'), profile('bob'))));
await t('B claims @bob', () => assertSucceeds(claim(B, 'uidB', 'bob')));
await t('B can’t write A’s profile', () => assertFails(setDoc(doc(B.firestore(), 'profiles', 'uidA'), profile('maya'))));
await t('B can read A’s profile', () => assertSucceeds(getDoc(doc(B.firestore(), 'profiles', 'uidA'))));
await t('A shows favourite artists and an animated background', () =>
  assertSucceeds(setDoc(doc(A.firestore(), 'profiles', 'uidA'), profile('maya', { artists: ['subtronics', 'levity'], showArtists: true, backdrop: 'aurora' }))));
await t('at most 6 favourite artists, and a background is a style name', async () => {
  await assertFails(setDoc(doc(A.firestore(), 'profiles', 'uidA'), profile('maya', { artists: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] })));
  await assertFails(setDoc(doc(A.firestore(), 'profiles', 'uidA'), profile('maya', { backdrop: 'https://x.test/a.gif' })));
  await assertFails(setDoc(doc(A.firestore(), 'profiles', 'uidA'), profile('maya', { showArtists: 'yes' })));
});
await t('the panda garden, frog pond and toe beach are only for the profiles made for them', async () => {
  await assertFails(setDoc(doc(A.firestore(), 'profiles', 'uidA'), profile('maya', { backdrop: 'panda' })));
  await assertFails(setDoc(doc(A.firestore(), 'profiles', 'uidA'), profile('maya', { backdrop: 'frog' })));
  await assertFails(setDoc(doc(A.firestore(), 'profiles', 'uidA'), profile('maya', { backdrop: 'toes' })));
  await assertSucceeds(setDoc(doc(A.firestore(), 'profiles', 'uidA'), profile('maya', { backdrop: 'none' })));
  await assertSucceeds(setDoc(doc(A.firestore(), 'profiles', 'uidA'), profile('maya')));
});
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
await t('profiles may carry Instagram, Snapchat and TikTok usernames, in each service’s shape, never links', async () => {
  const E = env.authenticatedContext('uidE');
  await assertSucceeds(claim(E, 'uidE', 'eve', { instagram: 'eve.c', snapchat: 'evec', tiktok: 'eve.dances' }));
  await assertFails(claim(E, 'uidE', 'eve', { instagram: 'https://instagram.com/eve' }));
  await assertFails(claim(E, 'uidE', 'eve', { snapchat: '1eve' }));
  await assertFails(claim(E, 'uidE', 'eve', { tiktok: 'Eve' }));
  await assertFails(claim(E, 'uidE', 'eve', { facebook: 'eve' }));
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

// A download link the way the app's upload makes one (getDownloadURL).
const fileUrl = (path, bucket = 'afterglowmusic.firebasestorage.app') => `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=3f1c2a9e-5b7d-4e2a-9c1f-0a8b7c6d5e4f`;
const mem = (id, uid, over = {}) => ({ uid, handle: uid === 'uidA' ? 'maya2' : 'bob', memoryId: 'm1', videoPath: `memories/${uid}/${id}.mov`, videoUrl: fileUrl(`memories/${uid}/${id}.mov`), capturedAt: now, createdAt: now, ...over });
await t('A shares a memory pointing at its own files', () => assertSucceeds(setDoc(doc(A.firestore(), 'memories', 'mem1'), mem('mem1', 'uidA', { thumbPath: 'memories/uidA/mem1.jpg', thumbUrl: fileUrl('memories/uidA/mem1.jpg'), festivalId: 'acl-26', durationSec: 42 }))));
await t('a shared memory’s links must be the owner’s own uploads for that memory', async () => {
  await assertSucceeds(setDoc(doc(A.firestore(), 'memories', 'url1'), mem('url1', 'uidA', { videoPath: 'memories/uidA/url1.mp4', videoUrl: fileUrl('memories/uidA/url1.mp4', 'demo-afterglow.appspot.com') })));
  // Any other site, someone else's folder, another memory's file, or a still that isn't this memory's: refused.
  await assertFails(setDoc(doc(A.firestore(), 'memories', 'url2'), mem('url2', 'uidA', { videoUrl: 'https://x/v.mov' })));
  await assertFails(setDoc(doc(A.firestore(), 'memories', 'url3'), mem('url3', 'uidA', { videoUrl: fileUrl('memories/uidB/url3.mov') })));
  await assertFails(setDoc(doc(A.firestore(), 'memories', 'url4'), mem('url4', 'uidA', { videoUrl: fileUrl('memories/uidA/mem1.mov') })));
  await assertFails(setDoc(doc(A.firestore(), 'memories', 'url5'), mem('url5', 'uidA', { videoUrl: fileUrl('avatars/uidA.jpg') })));
  await assertFails(setDoc(doc(A.firestore(), 'memories', 'url6'), mem('url6', 'uidA', { videoUrl: fileUrl('memories/uidA/url6.mov').replace('https://firebasestorage.googleapis.com', 'https://evil.example') })));
  await assertFails(setDoc(doc(A.firestore(), 'memories', 'url7'), mem('url7', 'uidA', { videoUrl: fileUrl('memories/uidA/url7.mov') + '&x=https://evil.example' })));
  await assertFails(setDoc(doc(A.firestore(), 'memories', 'url8'), mem('url8', 'uidA', { thumbPath: 'memories/uidA/url8.jpg', thumbUrl: 'https://x/t.jpg' })));
  await assertFails(setDoc(doc(A.firestore(), 'memories', 'url9'), mem('url9', 'uidA', { thumbPath: 'memories/uidA/url9.jpg', thumbUrl: fileUrl('memories/uidB/url9.jpg') })));
  await assertFails(setDoc(doc(A.firestore(), 'memories', 'url10'), mem('url10', 'uidA', { thumbPath: 'memories/uidA/url10.jpg', thumbUrl: fileUrl('memories/uidA/url10.mov') })));
  await assertSucceeds(setDoc(doc(A.firestore(), 'memories', 'url11'), mem('url11', 'uidA', { thumbPath: 'memories/uidA/url11.jpg', thumbUrl: fileUrl('memories/uidA/url11.jpg') })));
});
// Throwbacks go with the free plan's count (usage/{uid}) in one write.
const T = env.authenticatedContext('uidT');
const memT = (id, over = {}) => ({ uid: 'uidT', handle: 'tara', memoryId: 'm1', videoPath: `memories/uidT/${id}.mov`, videoUrl: fileUrl(`memories/uidT/${id}.mov`), capturedAt: now, createdAt: now, ...over });
const shareTb = (id, n, over = {}, ctx = T) => {
  const db = ctx.firestore(); const b = writeBatch(db);
  b.set(doc(db, 'memories', id), memT(id, { pastName: 'EDC Orlando', pastYear: 2024, ...over }));
  if (n !== undefined) b.set(doc(db, 'usage', 'uidT'), { throwbacks: n, memory: id });
  return b.commit();
};
await t('throwbacks: a past festival with a name and year, never with a festival on Afterglow', async () => {
  await claim(T, 'uidT', 'tara');
  await assertSucceeds(shareTb('tb1', 1, { artistId: 'subtronics', pastCity: 'Orlando', seriesId: 'edc-orlando-26' }));
  await assertSucceeds(shareTb('tb2', 2, { pastName: 'Sunset Sessions', pastYear: 2023 }));
  await assertFails(shareTb('tb3', 3, { festivalId: 'acl-26' }));
  await assertFails(shareTb('tb4', 3, { pastYear: '2024' }));
  await assertFails(shareTb('tb7', 3, { pastName: 'x'.repeat(61) }));
  await assertFails(shareTb('tb9', 3, { pastYear: 1980 }));
  await assertFails(setDoc(doc(T.firestore(), 'memories', 'tb5'), memT('tb5', { pastYear: 2024 })));
  await assertFails(setDoc(doc(T.firestore(), 'memories', 'tb8'), memT('tb8', { seriesId: 'edc-orlando-26' })));
});
await t('one-night shows and trimmed videos: a name and a day, never with a festival or a throwback; at most a minute plays', async () => {
  const db = T.firestore();
  await assertSucceeds(setDoc(doc(db, 'memories', 'sh1'), memT('sh1', { artistId: 'slander', showName: 'Echostage', showDate: '2026-01-18', showCity: 'Washington', showId: 'edm-123', clipStart: 12.5, clipEnd: 42.5, durationSec: 30 })));
  await assertSucceeds(setDoc(doc(db, 'memories', 'sh2'), memT('sh2', { artistId: 'slander' })));
  await assertFails(setDoc(doc(db, 'memories', 'sh3'), memT('sh3', { showName: 'Echostage', showDate: '2026-01-18', festivalId: 'acl-26' })));
  await assertFails(setDoc(doc(db, 'memories', 'sh4'), memT('sh4', { showName: 'Echostage', showDate: 'Jan 18' })));
  await assertFails(setDoc(doc(db, 'memories', 'sh5'), memT('sh5', { showDate: '2026-01-18' })));
  await assertFails(setDoc(doc(db, 'memories', 'sh6'), memT('sh6', { showName: 'x'.repeat(61), showDate: '2026-01-18' })));
  await assertFails(setDoc(doc(db, 'memories', 'sh7'), memT('sh7', { clipStart: 0, clipEnd: 90 })));
  await assertFails(setDoc(doc(db, 'memories', 'sh8'), memT('sh8', { clipStart: 10 })));
  await assertFails(setDoc(doc(db, 'memories', 'sh9'), memT('sh9', { clipStart: -1, clipEnd: 20 })));
  await assertFails(setDoc(doc(db, 'memories', 'sh10'), memT('sh10', { showCity: 'Washington' })));
});
await t('your own shared video’s tags can change (where it’s from, who was playing, a b2b), nothing else about it, and never by anyone else', async () => {
  const db = T.firestore();
  await assertSucceeds(setDoc(doc(db, 'memories', 'ed1'), memT('ed1', { artistId: 'boogie-t', festivalId: 'edc-orlando-26', night: 'Friday' })));
  await assertSucceeds(updateDoc(doc(db, 'memories', 'ed1'), { festivalId: 'acl-26', night: 'Saturday', artistId: 'boogie-t', withArtistIds: ['subtronics'] }));
  await assertSucceeds(updateDoc(doc(db, 'memories', 'ed1'), { festivalId: deleteField(), night: deleteField(), showName: 'Echostage', showDate: '2026-01-18' }));
  await assertFails(updateDoc(doc(db, 'memories', 'ed1'), { withArtistIds: ['a', 'b', 'c', 'd'] }));
  // An artist not on Afterglow yet: named, only with their id, not too long.
  await assertSucceeds(updateDoc(doc(db, 'memories', 'ed1'), { artistId: 'rezz', artistName: 'REZZ' }));
  await assertFails(updateDoc(doc(db, 'memories', 'ed1'), { artistName: 'x'.repeat(61) }));
  await assertFails(updateDoc(doc(db, 'memories', 'ed1'), { artistId: deleteField(), withArtistIds: deleteField(), artistName: 'REZZ' }));
  await assertSucceeds(setDoc(doc(db, 'memories', 'ed2'), memT('ed2', { artistId: 'rezz', artistName: 'REZZ' })));
  await assertFails(updateDoc(doc(db, 'memories', 'ed1'), { videoUrl: fileUrl('memories/uidT/other.mov') }));
  await assertFails(updateDoc(doc(db, 'memories', 'ed1'), { showName: deleteField(), showDate: deleteField(), pastName: 'EDC Orlando', pastYear: 2024 }));
  await assertFails(updateDoc(doc(A.firestore(), 'memories', 'ed1'), { artistId: 'someone' }));
  // A throwback's year can be put right; it stays a throwback.
  await assertSucceeds(updateDoc(doc(db, 'memories', 'tb1'), { pastYear: 2025 }));
  await assertFails(updateDoc(doc(db, 'memories', 'tb1'), { pastName: deleteField(), pastYear: deleteField(), pastCity: deleteField(), seriesId: deleteField(), festivalId: 'acl-26' }));
});
await t('people tagged in a video: the owner asks, only that person says yes, and a waiting tag is only for those two', async () => {
  const tag = (over = {}) => ({ memoryId: 'sh2', owner: 'uidT', uid: 'uidA', status: 'pending', createdAt: now, ...over });
  await assertFails(setDoc(doc(T.firestore(), 'videoTags', 'sh2_uidA'), tag({ status: 'declined' })));
  await assertFails(setDoc(doc(T.firestore(), 'videoTags', 'sh2_uidT'), tag({ uid: 'uidT' })));
  await assertFails(setDoc(doc(T.firestore(), 'videoTags', 'sh2_uidNobody'), tag({ uid: 'uidNobody' })));
  await assertFails(setDoc(doc(B.firestore(), 'videoTags', 'sh2_uidA'), tag({ owner: 'uidB' })));
  await assertFails(setDoc(doc(T.firestore(), 'videoTags', 'other_uidA'), tag()));
  await assertSucceeds(setDoc(doc(T.firestore(), 'videoTags', 'sh2_uidA'), tag()));
  await assertSucceeds(getDoc(doc(A.firestore(), 'videoTags', 'sh2_uidA')));
  await assertFails(getDoc(doc(B.firestore(), 'videoTags', 'sh2_uidA')));
  await assertFails(updateDoc(doc(T.firestore(), 'videoTags', 'sh2_uidA'), { status: 'approved' }));
  await assertFails(updateDoc(doc(A.firestore(), 'videoTags', 'sh2_uidA'), { status: 'approved', owner: 'uidA' }));
  await assertSucceeds(updateDoc(doc(A.firestore(), 'videoTags', 'sh2_uidA'), { status: 'approved' }));
  await assertSucceeds(getDoc(doc(B.firestore(), 'videoTags', 'sh2_uidA')));
  await assertFails(deleteDoc(doc(B.firestore(), 'videoTags', 'sh2_uidA')));
  await assertSucceeds(deleteDoc(doc(A.firestore(), 'videoTags', 'sh2_uidA')));
  // Tags show on the profile straight away now; anyone can see one, and the person tagged can hide it.
  await assertSucceeds(setDoc(doc(T.firestore(), 'videoTags', 'sh2_uidA'), tag({ status: 'approved' })));
  await assertSucceeds(getDoc(doc(B.firestore(), 'videoTags', 'sh2_uidA')));
  await assertSucceeds(deleteDoc(doc(A.firestore(), 'videoTags', 'sh2_uidA')));
});
await t('throwbacks: counted, three on the free plan, more with Plus, a place back when one is removed', async () => {
  // Not counted, or counted wrongly: refused.
  await assertFails(shareTb('tb10', undefined));
  await assertFails(shareTb('tb10', 5));
  await assertSucceeds(shareTb('tb10', 3));
  await assertFails(shareTb('tb11', 4));
  // The count can't be moved by itself, read by others, or reset while the profile is there.
  await assertFails(setDoc(doc(T.firestore(), 'usage', 'uidT'), { throwbacks: 0, memory: 'tb10' }));
  await assertFails(getDoc(doc(A.firestore(), 'usage', 'uidT')));
  await assertFails(deleteDoc(doc(T.firestore(), 'usage', 'uidT')));
  // Removing one gives its place back.
  const db = T.firestore(); const b = writeBatch(db);
  b.delete(doc(db, 'memories', 'tb10')); b.set(doc(db, 'usage', 'uidT'), { throwbacks: 2, memory: 'tb10' });
  await assertSucceeds(b.commit());
  await assertSucceeds(shareTb('tb12', 3));
  // With Afterglow Plus there's no limit.
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'plus', 'uidT'), { active: true }));
  await assertSucceeds(shareTb('tb13', 4));
  // Ordinary videos aren't counted.
  await assertSucceeds(setDoc(doc(T.firestore(), 'memories', 'plain1'), memT('plain1', { festivalId: 'acl-26' })));
});
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
await t('only a memory’s tags are ever edited, and only by its owner', async () => {
  await assertSucceeds(updateDoc(doc(A.firestore(), 'memories', 'mem1'), { artistId: 'x' }));
  await assertFails(updateDoc(doc(A.firestore(), 'memories', 'mem1'), { handle: 'someone-else' }));
  await assertFails(updateDoc(doc(B.firestore(), 'memories', 'mem1'), { artistId: 'y' }));
});
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
await t('reports: filed as yourself, open, at the server time, never read back', async () => {
  const r = { by: 'uidB', kind: 'profile', targetId: 'uidA', ownerUid: 'uidA', reason: 'offensive', note: '', status: 'open', createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(B.firestore(), 'reports', 'r1'), r));
  await assertFails(setDoc(doc(B.firestore(), 'reports', 'r2'), { ...r, by: 'uidA' }));
  await assertFails(setDoc(doc(B.firestore(), 'reports', 'r3'), { ...r, reason: 'boring' }));
  await assertFails(getDoc(doc(B.firestore(), 'reports', 'r1')));
  // Dated by the phone (to sink below newer ones), born dealt with, or without a status: refused.
  await assertFails(setDoc(doc(B.firestore(), 'reports', 'r4'), { ...r, createdAt: now }));
  await assertFails(setDoc(doc(B.firestore(), 'reports', 'r5'), { ...r, status: 'resolved' }));
  const { status, ...noStatus } = r;
  void status;
  await assertFails(setDoc(doc(B.firestore(), 'reports', 'r6'), noStatus));
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
// Joining: the crew update and your join record (agreeing to the chat rules, with the link's code) in one write.
async function join(ctx, uid, crewId, members, joinData = { agreed: true, code: 'abcdefghijkl1234', at: serverTimestamp() }) {
  const db = ctx.firestore(); const b = writeBatch(db);
  if (joinData) b.set(doc(db, 'crews', crewId, 'joins', uid), joinData);
  b.update(doc(db, 'crews', crewId), { members });
  return b.commit();
}
await t('crew invite links: a member makes the link’s code; only members read it; only the owner changes it', async () => {
  const inv = (db) => doc(db, 'crews', 'c1', 'meta', 'invite');
  await assertFails(setDoc(inv(B.firestore()), { code: 'abcdefghijkl1234', by: 'uidB', at: serverTimestamp() }));
  await assertFails(setDoc(inv(A.firestore()), { code: 'short', by: 'uidA', at: serverTimestamp() }));
  await assertSucceeds(setDoc(inv(A.firestore()), { code: 'abcdefghijkl1234', by: 'uidA', at: serverTimestamp() }));
  await assertFails(getDoc(inv(B.firestore())));
  await assertSucceeds(getDoc(inv(A.firestore())));
});
await t('crews: invite only; B joins with the link’s code, agreeing to the chat rules, adding only itself', async () => {
  await assertFails(join(B, 'uidB', 'c1', ['uidA', 'uidB'], null));
  await assertFails(join(B, 'uidB', 'c1', ['uidA', 'uidB'], { agreed: true, at: serverTimestamp() }));
  await assertFails(join(B, 'uidB', 'c1', ['uidA', 'uidB'], { agreed: true, code: 'wrongwrongwrong1', at: serverTimestamp() }));
  await assertFails(join(B, 'uidB', 'c1', ['uidA', 'uidB'], { agreed: false, code: 'abcdefghijkl1234', at: serverTimestamp() }));
  await assertFails(join(B, 'uidB', 'c1', ['uidA', 'uidB', 'uidC']));
  await assertFails(updateDoc(doc(B.firestore(), 'crews', 'c1'), { members: ['uidA', 'uidB'], name: 'Mine now' }));
  await assertFails(updateDoc(doc(B.firestore(), 'crews', 'c1'), { members: ['uidB'] , owner: 'uidB' }));
  await assertSucceeds(join(B, 'uidB', 'c1', ['uidA', 'uidB']));
  await assertSucceeds(getDoc(doc(B.firestore(), 'crews', 'c1', 'joins', 'uidB')));
  await assertSucceeds(getDoc(doc(A.firestore(), 'crews', 'c1', 'joins', 'uidB')));
});
await t('crews: not without a profile, not when full, not if the owner blocked you', async () => {
  await assertFails(join(C, 'uidC', 'c1', ['uidA', 'uidB', 'uidC']));
  const full = Array.from({ length: 12 }, (_, i) => (i ? `u${i}` : 'uidA'));
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'crews', 'full'), crew({ members: full })));
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'crews', 'full', 'meta', 'invite'), { code: 'abcdefghijkl1234', by: 'uidA', at: now }));
  await assertFails(join(B, 'uidB', 'full', [...full, 'uidB']));
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'crews', 'c3'), crew()));
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'crews', 'c3', 'meta', 'invite'), { code: 'abcdefghijkl1234', by: 'uidA', at: now }));
  await assertSucceeds(setDoc(doc(A.firestore(), 'blocks', 'uidA'), { uids: ['uidB'] }));
  await assertFails(join(B, 'uidB', 'c3', ['uidA', 'uidB']));
  await assertSucceeds(setDoc(doc(A.firestore(), 'blocks', 'uidA'), { uids: [] }));
});
const chatMsg = (over = {}) => ({ uid: 'uidB', text: 'Meet at the big tree?', atMs: Date.now(), sentAt: serverTimestamp(), ...over });
await t('crew chat: members write as themselves, stamped with the server’s time; members read it; others can’t', async () => {
  const at = (db, id) => doc(db, 'crews', 'c1', 'chat', id);
  await assertSucceeds(setDoc(at(B.firestore(), 'm000001'), chatMsg()));
  await assertSucceeds(setDoc(at(A.firestore(), 'm000002'), chatMsg({ uid: 'uidA', text: 'On my way' })));
  await assertSucceeds(getDocs(query(collection(A.firestore(), 'crews', 'c1', 'chat'), orderBy('sentAt', 'desc'), limit(100))));
  await assertFails(getDocs(collection(C.firestore(), 'crews', 'c1', 'chat')));
  await assertFails(setDoc(at(C.firestore(), 'm000003'), chatMsg({ uid: 'uidC' })));
  await assertFails(setDoc(at(B.firestore(), 'm000004'), chatMsg({ uid: 'uidA' })));
  await assertFails(setDoc(at(B.firestore(), 'm000005'), chatMsg({ text: '' })));
  await assertFails(setDoc(at(B.firestore(), 'm000006'), chatMsg({ text: 'x'.repeat(501) })));
  await assertFails(setDoc(at(B.firestore(), 'm000007'), chatMsg({ sentAt: now })));
  await assertFails(setDoc(at(B.firestore(), 'm000008'), chatMsg({ atMs: Date.now() + 3600 * 1000 })));
  await assertFails(setDoc(at(B.firestore(), 'm000009'), chatMsg({ photo: 'x' })));
  await assertFails(setDoc(at(B.firestore(), 'bad id!'), chatMsg()));
});
await t('crew chat: several waiting messages go in one write, each keeping when it was written', async () => {
  const db = B.firestore(); const b = writeBatch(db);
  b.set(doc(db, 'crews', 'c1', 'chat', 'mb00001'), chatMsg({ atMs: Date.now() - 40 * 60 * 1000 }));
  b.set(doc(db, 'crews', 'c1', 'chat', 'mb00002'), chatMsg({ atMs: Date.now() - 20 * 60 * 1000, text: 'Still here' }));
  await assertSucceeds(b.commit());
  // Sending one again (an earlier try that did get through) is refused, never doubled.
  await assertFails(setDoc(doc(db, 'crews', 'c1', 'chat', 'mb00001'), chatMsg()));
});
await t('crew chat: you note when you read it, with the server’s time; members see it; nobody else', async () => {
  const r = (db, uid) => doc(db, 'crews', 'c1', 'reads', uid);
  await assertSucceeds(setDoc(r(B.firestore(), 'uidB'), { at: serverTimestamp() }));
  await assertSucceeds(setDoc(r(B.firestore(), 'uidB'), { at: serverTimestamp() }));
  await assertFails(setDoc(r(B.firestore(), 'uidA'), { at: serverTimestamp() }));
  await assertFails(setDoc(r(B.firestore(), 'uidB'), { at: now }));
  await assertFails(setDoc(r(C.firestore(), 'uidC'), { at: serverTimestamp() }));
  await assertSucceeds(getDocs(collection(A.firestore(), 'crews', 'c1', 'reads')));
  await assertFails(getDocs(collection(C.firestore(), 'crews', 'c1', 'reads')));
});
await t('crew chat: never edited; removed by the writer or the owner', async () => {
  const at = (db, id) => doc(db, 'crews', 'c1', 'chat', id);
  await assertFails(updateDoc(at(B.firestore(), 'm000001'), { text: 'changed' }));
  await assertFails(deleteDoc(at(B.firestore(), 'm000002')));
  await assertSucceeds(deleteDoc(at(A.firestore(), 'm000001')));
  await assertSucceeds(setDoc(at(B.firestore(), 'm000010'), chatMsg()));
  await assertSucceeds(deleteDoc(at(B.firestore(), 'm000010')));
  await assertSucceeds(setDoc(doc(B.firestore(), 'reports', 'rchat'), { by: 'uidB', kind: 'chat', targetId: 'c1/m000002', ownerUid: 'uidA', reason: 'harassment', note: '', status: 'open', createdAt: serverTimestamp() }));
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
await t('crew updates: a photo for the crew has its picture and no video', async () => {
  const at = (id) => doc(B.firestore(), 'crews', 'c1', 'updates', id);
  await assertSucceeds(setDoc(at('p000001'), update({ kind: 'photo', thumbUrl: 'https://x/p.jpg', thumbPath: 'crews/c1/uidB/p000001.jpg' })));
  await assertFails(setDoc(at('p000002'), update({ kind: 'photo' })));
  await assertFails(setDoc(at('p000003'), update({ kind: 'photo', thumbUrl: 'https://x/p.jpg', videoUrl: 'https://x/v.mp4' })));
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
  await assertSucceeds(join(B, 'uidB', 'c1', ['uidA', 'uidB']));
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
await t('storage: a video posted from the website (iPhone Safari gives .mov as video/quicktime, or .mp4)', async () => {
  await assertSucceeds(uploadBytes(ref(B.storage(), 'memories/uidB/web1.mov'), bytes(1000), { contentType: 'video/quicktime' }));
  await assertSucceeds(uploadBytes(ref(B.storage(), 'memories/uidB/web2.mp4'), bytes(1000), { contentType: 'video/mp4' }));
  await assertSucceeds(uploadBytes(ref(B.storage(), 'memories/uidB/web2.jpg'), bytes(1000), { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(ref(B.storage(), 'memories/uidB/web3.webm'), bytes(1000), { contentType: 'video/webm' }));
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
  // Afterglow Plus too: anyone sees it, nobody gives it to themselves.
  await assertSucceeds(getDoc(doc(anon.firestore(), 'plus', 'uidA')));
  await assertFails(setDoc(doc(A.firestore(), 'plus', 'uidA'), { active: true }));
});
await t('glow levels: your own, a whole number, server time, with a profile; anyone reads', async () => {
  const L = env.authenticatedContext('uidL');
  await claim(L, 'uidL', 'lumen');
  await assertSucceeds(setDoc(doc(L.firestore(), 'levels', 'uidL'), { level: 4, at: serverTimestamp() }));
  await assertSucceeds(getDoc(doc(anon.firestore(), 'levels', 'uidL')));
  await assertFails(setDoc(doc(B.firestore(), 'levels', 'uidL'), { level: 9, at: serverTimestamp() }));
  await assertFails(setDoc(doc(L.firestore(), 'levels', 'uidL'), { level: 2.5, at: serverTimestamp() }));
  await assertFails(setDoc(doc(L.firestore(), 'levels', 'uidL'), { level: 1000, at: serverTimestamp() }));
  await assertFails(setDoc(doc(L.firestore(), 'levels', 'uidL'), { level: 4, at: serverTimestamp(), glow: 9999 }));
  await assertFails(setDoc(doc(L.firestore(), 'levels', 'uidL'), { level: 4, at: now }));
  await assertFails(setDoc(doc(env.authenticatedContext('uidNobody').firestore(), 'levels', 'uidNobody'), { level: 4, at: serverTimestamp() }));
  await assertFails(deleteDoc(doc(B.firestore(), 'levels', 'uidL')));
  await assertSucceeds(deleteDoc(doc(L.firestore(), 'levels', 'uidL')));
});
const ADMIN = env.authenticatedContext('uidAdmin', { email: 'afterglowmusic.support@gmail.com', email_verified: true });
const NOT_VERIFIED = env.authenticatedContext('uidFake', { email: 'afterglowmusic.support@gmail.com', email_verified: false });
const msg = (uid, over = {}) => ({ uid, topic: 'help', text: 'The map won’t load', status: 'open', createdAt: serverTimestamp(), ...over });
// Someone with a profile (@sami) whose sign-in email is s@x.com.
const S = env.authenticatedContext('uidS'), SE = env.authenticatedContext('uidS', { email: 's@x.com' });
await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'profiles', 'uidS'), profile('sami')));
await t('support: you send messages as yourself, and read only yours', async () => {
  await assertSucceeds(setDoc(doc(SE.firestore(), 'support', 's1'), msg('uidS', { handle: 'sami', email: 's@x.com', platform: 'ios' })));
  // Only your own sign-in email and your own profile's handle.
  await assertFails(setDoc(doc(SE.firestore(), 'support', 's6'), msg('uidS', { email: 'someone@else.com' })));
  await assertFails(setDoc(doc(S.firestore(), 'support', 's7'), msg('uidS', { email: 's@x.com' })));
  await assertFails(setDoc(doc(SE.firestore(), 'support', 's8'), msg('uidS', { handle: 'bob' })));
  await assertFails(setDoc(doc(env.authenticatedContext('uidNoProfile').firestore(), 'support', 's9'), msg('uidNoProfile', { handle: 'sami' })));
  await assertSucceeds(setDoc(doc(env.authenticatedContext('uidNoProfile').firestore(), 'support', 's10'), msg('uidNoProfile')));
  await assertFails(setDoc(doc(S.firestore(), 'support', 's2'), msg('uidB')));
  await assertFails(setDoc(doc(S.firestore(), 'support', 's3'), msg('uidS', { topic: 'rant' })));
  await assertFails(setDoc(doc(S.firestore(), 'support', 's4'), msg('uidS', { status: 'answered' })));
  await assertFails(setDoc(doc(S.firestore(), 'support', 's5'), msg('uidS', { text: 'x'.repeat(1001) })));
  await assertSucceeds(getDoc(doc(S.firestore(), 'support', 's1')));
  await assertFails(getDoc(doc(B.firestore(), 'support', 's1')));
  await assertSucceeds(getDocs(query(collection(S.firestore(), 'support'), where('uid', '==', 'uidS'))));
  await assertFails(getDocs(collection(B.firestore(), 'support')));
  await assertFails(updateDoc(doc(S.firestore(), 'support', 's1'), { reply: 'self-answer', status: 'answered' }));
});
await t('support account: reads every message and replies, once its email is verified', async () => {
  await assertSucceeds(getDocs(collection(ADMIN.firestore(), 'support')));
  await assertFails(getDocs(collection(NOT_VERIFIED.firestore(), 'support')));
  await assertSucceeds(updateDoc(doc(ADMIN.firestore(), 'support', 's1'), { reply: 'Try again now', repliedAt: '2026-10-03T10:00:00Z', status: 'answered' }));
  await assertFails(updateDoc(doc(ADMIN.firestore(), 'support', 's1'), { text: 'changed' }));
  await assertFails(updateDoc(doc(NOT_VERIFIED.firestore(), 'support', 's1'), { status: 'closed' }));
  // Every reply kept as a list.
  const replies = [{ text: 'Try again now', at: '2026-10-03T10:00:00Z' }, { text: 'Fixed for good', at: '2026-10-04T10:00:00Z' }];
  await assertSucceeds(updateDoc(doc(ADMIN.firestore(), 'support', 's1'), { reply: 'Fixed for good', repliedAt: '2026-10-04T10:00:00Z', replies, status: 'answered' }));
  await assertFails(updateDoc(doc(ADMIN.firestore(), 'support', 's1'), { replies: 'not a list' }));
  await assertFails(updateDoc(doc(ADMIN.firestore(), 'support', 's1'), { replies: Array.from({ length: 21 }, () => replies[0]) }));
});
await t('support: your messages go with your account; nobody else deletes them', async () => {
  await assertFails(deleteDoc(doc(B.firestore(), 'support', 's1')));
  await assertSucceeds(deleteDoc(doc(S.firestore(), 'support', 's1')));
  await assertSucceeds(deleteDoc(doc(ADMIN.firestore(), 'support', 's10')));
});
await t('support account: reads and resolves reports, takes down a video, counts crews', async () => {
  await assertSucceeds(setDoc(doc(B.firestore(), 'reports', 'rep1'), { by: 'uidB', kind: 'memory', targetId: 'mem1', ownerUid: 'uidA', reason: 'spam', note: '', status: 'open', createdAt: serverTimestamp() }));
  await assertFails(getDoc(doc(B.firestore(), 'reports', 'rep1')));
  await assertSucceeds(getDocs(collection(ADMIN.firestore(), 'reports')));
  await assertSucceeds(getDocs(query(collection(ADMIN.firestore(), 'reports'), where('status', '==', 'open'), orderBy('createdAt', 'desc'), limit(300))));
  await assertFails(getDocs(query(collection(B.firestore(), 'reports'), where('status', '==', 'open'))));
  await assertSucceeds(updateDoc(doc(ADMIN.firestore(), 'reports', 'rep1'), { status: 'resolved', resolvedAt: now }));
  await assertFails(updateDoc(doc(ADMIN.firestore(), 'reports', 'rep1'), { reason: 'other' }));
  await assertFails(getDocs(collection(NOT_VERIFIED.firestore(), 'reports')));
  await assertSucceeds(getCountFromServer(collection(ADMIN.firestore(), 'crews')));
  await assertFails(getCountFromServer(collection(B.firestore(), 'crews')));
  await assertFails(deleteDoc(doc(NOT_VERIFIED.firestore(), 'memories', 'mem8')));
  await assertSucceeds(deleteDoc(doc(ADMIN.firestore(), 'memories', 'mem8')));
});
const D = env.authenticatedContext('uidD');
const invite = (over = {}) => ({ crewId: 'inv1', festivalId: 'acl-26', crewName: 'Bass crew', from: 'uidB', to: 'uidD', createdAt: serverTimestamp(), ...over });
await t('crew invites: a member invites someone with a profile; only the two of them see it', async () => {
  await assertSucceeds(setDoc(doc(B.firestore(), 'crews', 'inv1'), crew({ owner: 'uidB', members: ['uidB'], name: 'Bass crew' })));
  await assertSucceeds(setDoc(doc(B.firestore(), 'crewInvites', 'inv1_uidD'), invite()));
  await assertFails(setDoc(doc(B.firestore(), 'crewInvites', 'inv1_uidC'), invite({ to: 'uidC' })));
  await assertFails(setDoc(doc(C.firestore(), 'crewInvites', 'inv1_uidD'), invite({ from: 'uidC' })));
  await assertFails(setDoc(doc(B.firestore(), 'crewInvites', 'other_uidD'), invite()));
  await assertFails(setDoc(doc(B.firestore(), 'crewInvites', 'inv1_uidD'), invite({ festivalId: 'edc-orlando-26' })));
  await assertFails(setDoc(doc(B.firestore(), 'crewInvites', 'inv1_uidB'), invite({ to: 'uidB' })));
  await assertSucceeds(getDoc(doc(D.firestore(), 'crewInvites', 'inv1_uidD')));
  await assertFails(getDoc(doc(C.firestore(), 'crewInvites', 'inv1_uidD')));
  await assertSucceeds(getDocs(query(collection(D.firestore(), 'crewInvites'), where('to', '==', 'uidD'))));
  await assertSucceeds(getDocs(query(collection(B.firestore(), 'crewInvites'), where('crewId', '==', 'inv1'), where('from', '==', 'uidB'))));
  await assertFails(getDocs(collection(C.firestore(), 'crewInvites')));
});
await t('crew invites: invited in the app, you join agreeing to the chat rules, no code needed', async () => {
  await assertFails(join(D, 'uidD', 'inv1', ['uidB', 'uidD'], null));
  await assertSucceeds(join(D, 'uidD', 'inv1', ['uidB', 'uidD'], { agreed: true, at: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(D.firestore(), 'crews', 'inv1'), { members: ['uidB'] }));
});
await t('crew invites: not to someone who blocked you; removed by the person invited', async () => {
  await assertSucceeds(setDoc(doc(D.firestore(), 'blocks', 'uidD'), { uids: ['uidB'] }));
  await assertFails(setDoc(doc(B.firestore(), 'crewInvites', 'inv1_uidD'), invite()));
  await assertSucceeds(setDoc(doc(D.firestore(), 'blocks', 'uidD'), { uids: [] }));
  await assertFails(deleteDoc(doc(C.firestore(), 'crewInvites', 'inv1_uidD')));
  await assertSucceeds(deleteDoc(doc(D.firestore(), 'crewInvites', 'inv1_uidD')));
});
const seen = (over = {}) => ({ firstSeenAt: now, lastSeenAt: now, days: ['2026-10-03'], platform: 'ios', version: 'Afterglow 1.0.0', hasProfile: true, ...over });
await t('activity: you note when you open the app; only you and the support account read it', async () => {
  await assertSucceeds(setDoc(doc(A.firestore(), 'activity', 'uidA'), seen()));
  await assertFails(setDoc(doc(A.firestore(), 'activity', 'uidB'), seen()));
  await assertFails(setDoc(doc(A.firestore(), 'activity', 'uidA'), seen({ watched: 'everything' })));
  await assertFails(setDoc(doc(A.firestore(), 'activity', 'uidA'), seen({ days: Array.from({ length: 91 }, (_, i) => `d${i}`) })));
  await assertSucceeds(getDoc(doc(A.firestore(), 'activity', 'uidA')));
  await assertFails(getDoc(doc(B.firestore(), 'activity', 'uidA')));
  await assertFails(getDocs(collection(A.firestore(), 'activity')));
  await assertSucceeds(getDocs(query(collection(ADMIN.firestore(), 'activity'), orderBy('lastSeenAt', 'desc'))));
  await assertFails(getDocs(collection(NOT_VERIFIED.firestore(), 'activity')));
  await assertSucceeds(getCountFromServer(collection(ADMIN.firestore(), 'crewInvites')));
  await assertSucceeds(deleteDoc(doc(A.firestore(), 'activity', 'uidA')));
});
await t('HQ: only the support account uploads, publishes and gives Plus and flairs', async () => {
  const drop = { by: 'uidAdmin', note: 'EDC set times', files: [], status: 'waiting', createdAt: serverTimestamp(), festivalId: 'edc-orlando-26', text: 'Friday\n10:00 PM SUBTRONICS' };
  await assertSucceeds(setDoc(doc(ADMIN.firestore(), 'drops', 'd1'), drop));
  await assertFails(setDoc(doc(A.firestore(), 'drops', 'd2'), { ...drop, by: 'uidA' }));
  await assertFails(setDoc(doc(NOT_VERIFIED.firestore(), 'drops', 'd3'), { ...drop, by: 'uidFake' }));
  await assertFails(getDoc(doc(A.firestore(), 'drops', 'd1')));
  await assertSucceeds(updateDoc(doc(ADMIN.firestore(), 'drops', 'd1'), { status: 'sent' }));
  await assertFails(updateDoc(doc(ADMIN.firestore(), 'drops', 'd1'), { note: 'changed' }));
  const patch = { title: 'EDC set times', festivalId: 'edc-orlando-26', file: '{"version":1}', by: 'uidAdmin', publishedAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(ADMIN.firestore(), 'published', 'p1'), patch));
  await assertFails(setDoc(doc(A.firestore(), 'published', 'p2'), { ...patch, by: 'uidA' }));
  await assertSucceeds(getDoc(doc(anon.firestore(), 'published', 'p1')));
  await assertFails(updateDoc(doc(ADMIN.firestore(), 'published', 'p1'), { title: 'x' }));
  await assertSucceeds(deleteDoc(doc(ADMIN.firestore(), 'published', 'p1')));
  await assertSucceeds(setDoc(doc(ADMIN.firestore(), 'plus', 'uidB'), { active: true, until: '2027-01-01T00:00:00.000Z' }));
  await assertFails(setDoc(doc(A.firestore(), 'plus', 'uidA'), { active: true }));
  await assertSucceeds(setDoc(doc(ADMIN.firestore(), 'flairs', 'uidB'), { kind: 'artist', caption: 'Artist on Afterglow' }));
  await assertFails(setDoc(doc(ADMIN.firestore(), 'flairs', 'uidB'), { kind: 'god', caption: 'x' }));
  await assertFails(setDoc(doc(B.firestore(), 'flairs', 'uidB'), { kind: 'artist', caption: 'Me' }));
  await assertSucceeds(deleteDoc(doc(ADMIN.firestore(), 'flairs', 'uidB')));
  await assertSucceeds(uploadBytes(ref(ADMIN.storage(), 'drops/d1/1-poster.png'), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }));
  await assertFails(uploadBytes(ref(A.storage(), 'drops/d1/2-poster.png'), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }));
  await assertFails(uploadBytes(ref(ADMIN.storage(), 'drops/d1/3-app.exe'), new Uint8Array([1]), { contentType: 'application/octet-stream' }));
});
await t('sprouts: given as yourself, picked up once, by anyone else not blocked, within 30 days', async () => {
  const sprout = (over = {}) => ({ from: 'uidA', kind: 'plur', note: 'Happy you came', createdAt: serverTimestamp(), ...over });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'profiles', 'uidA'), profile('maya2'));
    await setDoc(doc(db, 'profiles', 'uidF'), profile('fern'));
    await setDoc(doc(db, 'blocks', 'uidF'), { uids: ['uidG'] });
  });
  await assertSucceeds(setDoc(doc(A.firestore(), 'sprouts', 'abcdefghijkmnpqrstuv'), sprout()));
  await assertFails(setDoc(doc(A.firestore(), 'sprouts', 'bad'), sprout()));
  await assertFails(setDoc(doc(A.firestore(), 'sprouts', 'bbbbbbbbbbbbbbbbbbbb'), sprout({ from: 'uidB' })));
  await assertFails(setDoc(doc(A.firestore(), 'sprouts', 'cccccccccccccccccccc'), sprout({ kind: 'golden' })));
  await assertFails(setDoc(doc(A.firestore(), 'sprouts', 'dddddddddddddddddddd'), sprout({ to: 'uidB' })));
  await assertFails(setDoc(doc(anon.firestore(), 'sprouts', 'eeeeeeeeeeeeeeeeeeee'), sprout()));
  // Sending again is refused (it's already there).
  await assertFails(setDoc(doc(A.firestore(), 'sprouts', 'abcdefghijkmnpqrstuv'), sprout()));
  await assertSucceeds(getDoc(doc(B.firestore(), 'sprouts', 'abcdefghijkmnpqrstuv')));
  await assertFails(updateDoc(doc(A.firestore(), 'sprouts', 'abcdefghijkmnpqrstuv'), { to: 'uidA', claimedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(B.firestore(), 'sprouts', 'abcdefghijkmnpqrstuv'), { to: 'uidC', claimedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(B.firestore(), 'sprouts', 'abcdefghijkmnpqrstuv'), { to: 'uidB', claimedAt: serverTimestamp(), kind: 'sunrise' }));
  await assertSucceeds(updateDoc(doc(B.firestore(), 'sprouts', 'abcdefghijkmnpqrstuv'), { to: 'uidB', claimedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(C.firestore(), 'sprouts', 'abcdefghijkmnpqrstuv'), { to: 'uidC', claimedAt: serverTimestamp() }));
  await assertSucceeds(getDocs(query(collection(B.firestore(), 'sprouts'), where('to', '==', 'uidB'))));
  await assertSucceeds(getDocs(query(collection(A.firestore(), 'sprouts'), where('from', '==', 'uidA'))));
  await assertFails(getDocs(collection(C.firestore(), 'sprouts')));
  // Picked up, it can't be taken back.
  await assertFails(deleteDoc(doc(A.firestore(), 'sprouts', 'abcdefghijkmnpqrstuv')));
  await assertSucceeds(setDoc(doc(A.firestore(), 'sprouts', 'ffffffffffffffffffff'), sprout()));
  await assertFails(deleteDoc(doc(B.firestore(), 'sprouts', 'ffffffffffffffffffff')));
  await assertSucceeds(deleteDoc(doc(A.firestore(), 'sprouts', 'ffffffffffffffffffff')));
  // Someone the giver blocked can't pick it up.
  await assertSucceeds(setDoc(doc(F.firestore(), 'sprouts', 'gggggggggggggggggggg'), sprout({ from: 'uidF' })));
  await assertFails(updateDoc(doc(G.firestore(), 'sprouts', 'gggggggggggggggggggg'), { to: 'uidG', claimedAt: serverTimestamp() }));
  // Too old to pick up.
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'sprouts', 'hhhhhhhhhhhhhhhhhhhh'), { from: 'uidA', kind: 'seedling', createdAt: new Date(Date.now() - 31 * 86400_000) }));
  await assertFails(updateDoc(doc(B.firestore(), 'sprouts', 'hhhhhhhhhhhhhhhhhhhh'), { to: 'uidB', claimedAt: serverTimestamp() }));
});
await t('gift themes: only @matt.raves sends one with a sprout; whoever picks it up gets the grant and its background', async () => {
  const M = env.authenticatedContext('uidM'), N = env.authenticatedContext('uidN'), O = env.authenticatedContext('uidO');
  await assertSucceeds(claim(M, 'uidM', 'matt.raves'));
  await assertSucceeds(claim(N, 'uidN', 'newbie'));
  await assertSucceeds(claim(O, 'uidO', 'other'));
  const sprout = (from, extra = {}) => ({ from, kind: 'seedling', createdAt: serverTimestamp(), ...extra });
  // Only the developer's handle, and only a gift theme.
  await assertFails(setDoc(doc(O.firestore(), 'sprouts', 'themeoooooooooooooooo'), sprout('uidO', { theme: 'daisy' })));
  await assertFails(setDoc(doc(M.firestore(), 'sprouts', 'themexxxxxxxxxxxxxxxx'), sprout('uidM', { theme: 'nebula' })));
  await assertSucceeds(setDoc(doc(M.firestore(), 'sprouts', 'themedaisyaaaaaaaaaa'), sprout('uidM', { theme: 'daisy' })));
  await assertSucceeds(setDoc(doc(M.firestore(), 'sprouts', 'plainsproutaaaaaaaaa'), sprout('uidM')));
  // The developer shows the background without a grant; nobody else does.
  await assertSucceeds(setDoc(doc(M.firestore(), 'profiles', 'uidM'), profile('matt.raves', { backdrop: 'daisy' })));
  await assertFails(setDoc(doc(N.firestore(), 'profiles', 'uidN'), profile('newbie', { backdrop: 'daisy' })));
  // No grant before picking it up, or from a sprout without the theme.
  const grant = (uid, sproutId, theme = 'daisy') => ({ uid, theme, sprout: sproutId, createdAt: serverTimestamp() });
  await assertFails(setDoc(doc(N.firestore(), 'themeGrants', 'uidN_daisy'), grant('uidN', 'themedaisyaaaaaaaaaa')));
  await assertSucceeds(updateDoc(doc(N.firestore(), 'sprouts', 'plainsproutaaaaaaaaa'), { to: 'uidN', claimedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(N.firestore(), 'themeGrants', 'uidN_daisy'), grant('uidN', 'plainsproutaaaaaaaaa')));
  // Picked up: the grant, then the background.
  await assertSucceeds(updateDoc(doc(N.firestore(), 'sprouts', 'themedaisyaaaaaaaaaa'), { to: 'uidN', claimedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(O.firestore(), 'themeGrants', 'uidO_daisy'), grant('uidO', 'themedaisyaaaaaaaaaa')));
  await assertFails(setDoc(doc(N.firestore(), 'themeGrants', 'uidO_daisy'), grant('uidN', 'themedaisyaaaaaaaaaa')));
  await assertFails(setDoc(doc(N.firestore(), 'themeGrants', 'uidN_daisy'), { ...grant('uidN', 'themedaisyaaaaaaaaaa'), extra: 1 }));
  await assertSucceeds(setDoc(doc(N.firestore(), 'themeGrants', 'uidN_daisy'), grant('uidN', 'themedaisyaaaaaaaaaa')));
  await assertSucceeds(getDoc(doc(N.firestore(), 'themeGrants', 'uidN_daisy')));
  await assertSucceeds(getDoc(doc(N.firestore(), 'themeGrants', 'uidN_nothing')));
  await assertFails(getDoc(doc(O.firestore(), 'themeGrants', 'uidN_daisy')));
  await assertSucceeds(setDoc(doc(N.firestore(), 'profiles', 'uidN'), profile('newbie', { backdrop: 'daisy' })));
  await assertFails(setDoc(doc(O.firestore(), 'profiles', 'uidO'), profile('other', { backdrop: 'daisy' })));
  // Granted once; it can't be rewritten, and only you remove it.
  await assertFails(setDoc(doc(N.firestore(), 'themeGrants', 'uidN_daisy'), grant('uidN', 'themedaisyaaaaaaaaaa')));
  await assertFails(deleteDoc(doc(O.firestore(), 'themeGrants', 'uidN_daisy')));
  await assertSucceeds(deleteDoc(doc(N.firestore(), 'themeGrants', 'uidN_daisy')));
});
await t('gardens: you show yours (a short list, server-timed), anyone signed in visits, only you change or remove it', async () => {
  const G = env.authenticatedContext('uidGa'), H = env.authenticatedContext('uidGb');
  const garden = (over = {}) => ({ residents: [{ k: 's', kind: 'plur', stage: 3 }], updatedAt: serverTimestamp(), ...over });
  await assertSucceeds(setDoc(doc(G.firestore(), 'gardens', 'uidGa'), garden()));
  await assertFails(setDoc(doc(H.firestore(), 'gardens', 'uidGa'), garden()));
  await assertFails(setDoc(doc(G.firestore(), 'gardens', 'uidGa'), garden({ note: 'secret' })));
  await assertFails(setDoc(doc(G.firestore(), 'gardens', 'uidGa'), garden({ residents: Array.from({ length: 121 }, () => ({ k: 's' })) })));
  await assertFails(setDoc(doc(G.firestore(), 'gardens', 'uidGa'), garden({ updatedAt: new Date(0) })));
  await assertSucceeds(getDoc(doc(H.firestore(), 'gardens', 'uidGa')));
  await assertFails(getDoc(doc(anon.firestore(), 'gardens', 'uidGa')));
  await assertFails(deleteDoc(doc(H.firestore(), 'gardens', 'uidGa')));
  await assertSucceeds(deleteDoc(doc(G.firestore(), 'gardens', 'uidGa')));
});
await t('kandi: made as yourself for someone else with a profile who hasn’t blocked you; only the two of you read or remove it', async () => {
  const K = env.authenticatedContext('uidKa'), L = env.authenticatedContext('uidKb'), M = env.authenticatedContext('uidKc');
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'profiles', 'uidKa'), profile('kaya'));
    await setDoc(doc(db, 'profiles', 'uidKb'), profile('kobe'));
    await setDoc(doc(db, 'profiles', 'uidKc'), profile('kim'));
    await setDoc(doc(db, 'blocks', 'uidKc'), { uids: ['uidKa'] });
  });
  const k = (over = {}) => ({ from: 'uidKa', to: 'uidKb', word: 'PLUR', beads: 'uv', note: 'See you at the rail', createdAt: now, ...over });
  await assertSucceeds(setDoc(doc(K.firestore(), 'kandi', 'k1'), k()));
  await assertSucceeds(setDoc(doc(K.firestore(), 'kandi', 'k1b'), k({ word: 'I ♥ U', note: 'x' })));
  await assertFails(setDoc(doc(K.firestore(), 'kandi', 'k2'), k({ from: 'uidKb' })));
  await assertFails(setDoc(doc(K.firestore(), 'kandi', 'k3'), k({ to: 'uidKa' })));
  await assertFails(setDoc(doc(K.firestore(), 'kandi', 'k4'), k({ to: 'uidKc' })));
  await assertFails(setDoc(doc(K.firestore(), 'kandi', 'k5'), k({ to: 'uidNobody' })));
  await assertFails(setDoc(doc(K.firestore(), 'kandi', 'k6'), k({ word: 'plur' })));
  await assertFails(setDoc(doc(K.firestore(), 'kandi', 'k7'), k({ word: 'THIRTEEN CHARS' })));
  await assertFails(setDoc(doc(K.firestore(), 'kandi', 'k8'), k({ beads: 'gold' })));
  await assertFails(setDoc(doc(K.firestore(), 'kandi', 'k9'), k({ note: 'x'.repeat(141) })));
  await assertFails(setDoc(doc(K.firestore(), 'kandi', 'k10'), k({ extra: 1 })));
  await assertSucceeds(getDoc(doc(L.firestore(), 'kandi', 'k1')));
  await assertFails(getDoc(doc(M.firestore(), 'kandi', 'k1')));
  await assertSucceeds(getDocs(query(collection(L.firestore(), 'kandi'), where('to', '==', 'uidKb'))));
  await assertFails(getDocs(collection(M.firestore(), 'kandi')));
  await assertFails(updateDoc(doc(L.firestore(), 'kandi', 'k1'), { word: 'HI' }));
  await assertFails(deleteDoc(doc(M.firestore(), 'kandi', 'k1')));
  await assertSucceeds(deleteDoc(doc(L.firestore(), 'kandi', 'k1')));
  // A garden may show its kandi (at most 40).
  await assertSucceeds(setDoc(doc(L.firestore(), 'gardens', 'uidKb'), { residents: [], kandi: [{ word: 'PLUR', beads: 'uv', from: 'kaya' }], updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(L.firestore(), 'gardens', 'uidKb'), { residents: [], kandi: Array.from({ length: 41 }, () => ({})), updatedAt: serverTimestamp() }));
});
await t('sprouts: an artist sprout names its artist, both id and name, in shape', async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'profiles', 'uidA'), { handle: 'aa', displayName: 'A' }));
  const A = env.authenticatedContext('uidA');
  const sprout = (extra = {}) => ({ from: 'uidA', kind: 'seedling', createdAt: serverTimestamp(), ...extra });
  await assertSucceeds(setDoc(doc(A.firestore(), 'sprouts', 'artistaaaaaaaaaaaaaa'), sprout({ artistId: 'subtronics', artistName: 'SUBTRONICS' })));
  await assertFails(setDoc(doc(A.firestore(), 'sprouts', 'artistbbbbbbbbbbbbbb'), sprout({ artistId: 'subtronics' })));
  await assertFails(setDoc(doc(A.firestore(), 'sprouts', 'artistcccccccccccccc'), sprout({ artistName: 'SUBTRONICS' })));
  await assertFails(setDoc(doc(A.firestore(), 'sprouts', 'artistdddddddddddddd'), sprout({ artistId: 'Bad Id!', artistName: 'X' })));
  await assertSucceeds(setDoc(doc(A.firestore(), 'sprouts', 'artistffffffffffffff'), sprout({ artistId: 'DJ_Snake.2', artistName: 'DJ Snake' })));
  await assertFails(setDoc(doc(A.firestore(), 'sprouts', 'artisteeeeeeeeeeeeee'), sprout({ artistId: 'x', artistName: 'y'.repeat(61) })));
});
await t('stickers: made in HQ, read by anyone, found once each before their end date', async () => {
  const H = env.authenticatedContext('uidHQ', { email: 'afterglowmusic.support@gmail.com', email_verified: true });
  const sticker = (over = {}) => ({ name: 'Ferris wheel', creature: 'ferris', by: 'uidHQ', createdAt: serverTimestamp(), ...over });
  await assertSucceeds(setDoc(doc(H.firestore(), 'hunts', 'nightmkt27'), { name: 'Night Market', items: [], by: 'uidHQ', createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(A.firestore(), 'hunts', 'mymktaaaa'), { name: 'Mine', items: [], by: 'uidA', createdAt: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(H.firestore(), 'stickers', 'ferris2027'), sticker({ huntId: 'nightmkt27', slot: 0 })));
  await assertSucceeds(updateDoc(doc(H.firestore(), 'hunts', 'nightmkt27'), { items: [{ creature: 'ferris', name: 'Ferris wheel' }] }));
  await assertFails(updateDoc(doc(H.firestore(), 'hunts', 'nightmkt27'), { items: [] }));
  // Taking a sticker down marks its place gone (same length).
  await assertSucceeds(updateDoc(doc(H.firestore(), 'hunts', 'nightmkt27'), { items: [{ creature: 'ferris', name: 'Ferris wheel', gone: true }] }));
  await assertSucceeds(updateDoc(doc(H.firestore(), 'hunts', 'nightmkt27'), { items: [{ creature: 'ferris', name: 'Ferris wheel' }] }));
  await assertFails(updateDoc(doc(A.firestore(), 'hunts', 'nightmkt27'), { items: [{ creature: 'ferris', name: 'Ferris wheel', gone: true }] }));
  await assertFails(setDoc(doc(A.firestore(), 'stickers', 'mysticker1'), sticker({ by: 'uidA' })));
  await assertFails(setDoc(doc(H.firestore(), 'stickers', 'BAD CODE'), sticker()));
  await assertFails(setDoc(doc(H.firestore(), 'stickers', 'nohuntslot'), sticker({ huntId: 'nightmkt27' })));
  await assertFails(setDoc(doc(H.firestore(), 'stickers', 'toolongname'), sticker({ name: 'x'.repeat(41) })));
  await assertSucceeds(getDoc(doc(anon.firestore(), 'stickers', 'ferris2027')));
  await assertSucceeds(getDoc(doc(anon.firestore(), 'hunts', 'nightmkt27')));
  await assertFails(getDocs(collection(A.firestore(), 'stickers')));
  await assertSucceeds(getDocs(collection(H.firestore(), 'stickers')));
  const find = (uid, code, over = {}) => ({ uid, code, at: new Date(), createdAt: serverTimestamp(), ...over });
  await assertSucceeds(setDoc(doc(A.firestore(), 'finds', 'uidA_ferris2027'), find('uidA', 'ferris2027')));
  await assertFails(setDoc(doc(A.firestore(), 'finds', 'uidA_ferris2027'), find('uidA', 'ferris2027')));
  await assertFails(setDoc(doc(A.firestore(), 'finds', 'uidB_ferris2027'), find('uidB', 'ferris2027')));
  await assertFails(setDoc(doc(A.firestore(), 'finds', 'uidA_nosuchcode'), find('uidA', 'nosuchcode')));
  await assertFails(setDoc(doc(anon.firestore(), 'finds', 'x_ferris2027'), find('x', 'ferris2027')));
  await assertSucceeds(getDoc(doc(A.firestore(), 'finds', 'uidA_ferris2027')));
  await assertFails(getDoc(doc(B.firestore(), 'finds', 'uidA_ferris2027')));
  await assertSucceeds(getCountFromServer(query(collection(H.firestore(), 'finds'), where('code', '==', 'ferris2027'))));
  // Ended: a scan from before the end counts for 3 days after it; nothing after.
  const ended = new Date(Date.now() - 86400_000);
  await assertSucceeds(setDoc(doc(H.firestore(), 'stickers', 'ended2026a'), sticker({ until: ended })));
  await assertSucceeds(setDoc(doc(B.firestore(), 'finds', 'uidB_ended2026a'), find('uidB', 'ended2026a', { at: new Date(ended.getTime() - 3600_000) })));
  await assertFails(setDoc(doc(A.firestore(), 'finds', 'uidA_ended2026a'), find('uidA', 'ended2026a')));
  const long = new Date(Date.now() - 5 * 86400_000);
  await assertSucceeds(setDoc(doc(H.firestore(), 'stickers', 'ended2026b'), sticker({ until: long })));
  await assertFails(setDoc(doc(A.firestore(), 'finds', 'uidA_ended2026b'), find('uidA', 'ended2026b', { at: new Date(long.getTime() - 3600_000) })));
  // Your own finds, read back on a new phone: only yours.
  await assertSucceeds(getDocs(query(collection(B.firestore(), 'finds'), where('uid', '==', 'uidB'), limit(500))));
  await assertFails(getDocs(query(collection(A.firestore(), 'finds'), where('uid', '==', 'uidB'), limit(500))));
  await assertFails(getDocs(collection(A.firestore(), 'finds')));
  await assertSucceeds(deleteDoc(doc(A.firestore(), 'finds', 'uidA_ferris2027')));
  // Taken down: marked once by HQ (not deleted); scans from before still count for 3 days, later ones never.
  const C = env.authenticatedContext('uidC');
  await assertSucceeds(setDoc(doc(H.firestore(), 'stickers', 'down2027aa'), sticker()));
  await assertFails(updateDoc(doc(A.firestore(), 'stickers', 'down2027aa'), { takenDown: true, takenDownAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(H.firestore(), 'stickers', 'down2027aa'), { takenDown: true, takenDownAt: serverTimestamp(), name: 'Renamed' }));
  await assertFails(updateDoc(doc(H.firestore(), 'stickers', 'down2027aa'), { takenDown: true, takenDownAt: new Date(Date.now() - 86400_000) }));
  await assertSucceeds(updateDoc(doc(H.firestore(), 'stickers', 'down2027aa'), { takenDown: true, takenDownAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(H.firestore(), 'stickers', 'down2027aa'), { takenDown: true, takenDownAt: serverTimestamp() }));
  await assertSucceeds(getDoc(doc(anon.firestore(), 'stickers', 'down2027aa')));
  await assertSucceeds(setDoc(doc(B.firestore(), 'finds', 'uidB_down2027aa'), find('uidB', 'down2027aa', { at: new Date(Date.now() - 60_000) })));
  await assertFails(setDoc(doc(C.firestore(), 'finds', 'uidC_down2027aa'), find('uidC', 'down2027aa', { at: new Date(Date.now() + 60_000) })));
  const longAgo = new Date(Date.now() - 5 * 86400_000);
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'stickers', 'down2027bb'), { name: 'Old', creature: 'ferris', by: 'uidHQ', createdAt: longAgo, takenDown: true, takenDownAt: longAgo }));
  await assertFails(setDoc(doc(C.firestore(), 'finds', 'uidC_down2027bb'), find('uidC', 'down2027bb', { at: new Date(longAgo.getTime() - 3600_000) })));
});
await t('1-to-1 chats: only friends both ways, only the two of them, not once blocked', async () => {
  const P = env.authenticatedContext('uidP'), Q = env.authenticatedContext('uidQ'), R = env.authenticatedContext('uidR'), H = env.authenticatedContext('uidHQ', { email: 'afterglowmusic.support@gmail.com', email_verified: true });
  const seed = (path, data) => env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), ...path), data));
  const dm = { members: ['uidP', 'uidQ'], createdAt: serverTimestamp() };
  const msg = (uid, over = {}) => ({ uid, text: 'see you at the stage', atMs: Date.now(), sentAt: serverTimestamp(), ...over });
  // P follows Q, not back yet: no chat.
  await seed(['follows', 'uidP_uidQ'], { from: 'uidP', to: 'uidQ', createdAt: now });
  await assertFails(setDoc(doc(P.firestore(), 'dms', 'uidP_uidQ'), dm));
  await seed(['follows', 'uidQ_uidP'], { from: 'uidQ', to: 'uidP', createdAt: now });
  // Members in order, matching the id, including you.
  await assertFails(setDoc(doc(P.firestore(), 'dms', 'uidQ_uidP'), { members: ['uidQ', 'uidP'], createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(R.firestore(), 'dms', 'uidP_uidQ'), dm));
  await assertSucceeds(getDoc(doc(P.firestore(), 'dms', 'uidP_uidQ')));
  await assertSucceeds(setDoc(doc(P.firestore(), 'dms', 'uidP_uidQ'), dm));
  await assertFails(setDoc(doc(P.firestore(), 'dms', 'uidP_uidQ'), dm));
  // Only the two of them.
  await assertSucceeds(getDoc(doc(Q.firestore(), 'dms', 'uidP_uidQ')));
  await assertFails(getDoc(doc(R.firestore(), 'dms', 'uidP_uidQ')));
  // Not even whether a chat between others exists.
  await assertFails(getDoc(doc(R.firestore(), 'dms', 'uidP_uidS')));
  await assertSucceeds(getDocs(query(collection(P.firestore(), 'dms'), where('members', 'array-contains', 'uidP'))));
  await assertSucceeds(setDoc(doc(P.firestore(), 'dms', 'uidP_uidQ', 'chat', 'm1abcdef'), msg('uidP')));
  await assertSucceeds(setDoc(doc(Q.firestore(), 'dms', 'uidP_uidQ', 'chat', 'm2abcdef'), msg('uidQ')));
  await assertFails(setDoc(doc(P.firestore(), 'dms', 'uidP_uidQ', 'chat', 'm3abcdef'), msg('uidQ')));
  await assertFails(setDoc(doc(R.firestore(), 'dms', 'uidP_uidQ', 'chat', 'm4abcdef'), msg('uidR')));
  await assertFails(setDoc(doc(P.firestore(), 'dms', 'uidP_uidQ', 'chat', 'm5abcdef'), msg('uidP', { text: 'x'.repeat(501) })));
  await assertSucceeds(getDocs(collection(Q.firestore(), 'dms', 'uidP_uidQ', 'chat')));
  await assertFails(getDocs(collection(R.firestore(), 'dms', 'uidP_uidQ', 'chat')));
  await assertSucceeds(getDoc(doc(H.firestore(), 'dms', 'uidP_uidQ', 'chat', 'm1abcdef')));
  await assertSucceeds(setDoc(doc(Q.firestore(), 'dms', 'uidP_uidQ', 'reads', 'uidQ'), { at: serverTimestamp() }));
  await assertFails(setDoc(doc(Q.firestore(), 'dms', 'uidP_uidQ', 'reads', 'uidP'), { at: serverTimestamp() }));
  await assertSucceeds(getDocs(collection(P.firestore(), 'dms', 'uidP_uidQ', 'reads')));
  // Never edited; your own removed.
  await assertFails(updateDoc(doc(P.firestore(), 'dms', 'uidP_uidQ', 'chat', 'm1abcdef'), { text: 'changed' }));
  await assertFails(deleteDoc(doc(P.firestore(), 'dms', 'uidP_uidQ', 'chat', 'm2abcdef')));
  await assertSucceeds(deleteDoc(doc(P.firestore(), 'dms', 'uidP_uidQ', 'chat', 'm1abcdef')));
  // Q blocks P: P can't write any more (Q still can read the chat).
  await seed(['blocks', 'uidQ'], { uids: ['uidP'] });
  await assertFails(setDoc(doc(P.firestore(), 'dms', 'uidP_uidQ', 'chat', 'm6abcdef'), msg('uidP')));
  await assertSucceeds(getDocs(collection(Q.firestore(), 'dms', 'uidP_uidQ', 'chat')));
  // Unfollowed: nobody writes.
  await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), 'blocks', 'uidQ')));
  await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), 'follows', 'uidQ_uidP')));
  await assertFails(setDoc(doc(Q.firestore(), 'dms', 'uidP_uidQ', 'chat', 'm7abcdef'), msg('uidQ')));
});

await t('set times from fans: one waiting per festival, only HQ reads them all and marks them live', async () => {
  const H = env.authenticatedContext('uidHQ', { email: 'afterglowmusic.support@gmail.com', email_verified: true });
  const tip = (uid, festivalId, over = {}) => ({ uid, festivalId, status: 'new', createdAt: serverTimestamp(), text: 'Friday\n10:00 PM SUBTRONICS', ...over });
  const photo = 'data:image/jpeg;base64,' + 'A'.repeat(2000);
  await assertSucceeds(setDoc(doc(A.firestore(), 'setTimes', 'uidA_edc-orlando-26'), tip('uidA', 'edc-orlando-26', { photo })));
  // Once each, never edited by the sender, never in someone else's name, never empty or odd.
  await assertFails(setDoc(doc(A.firestore(), 'setTimes', 'uidA_edc-orlando-26'), tip('uidA', 'edc-orlando-26')));
  await assertFails(setDoc(doc(A.firestore(), 'setTimes', 'uidB_edc-orlando-26'), tip('uidB', 'edc-orlando-26')));
  await assertFails(setDoc(doc(A.firestore(), 'setTimes', 'uidA_acl-26'), { uid: 'uidA', festivalId: 'acl-26', status: 'new', createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(A.firestore(), 'setTimes', 'uidA_acl-26'), tip('uidA', 'acl-26', { status: 'live' })));
  await assertFails(setDoc(doc(A.firestore(), 'setTimes', 'uidA_acl-26'), tip('uidA', 'acl-26', { photo: 'data:image/png;base64,AAAA' })));
  await assertFails(setDoc(doc(A.firestore(), 'setTimes', 'uidA_acl-26'), tip('uidA', 'acl-26', { text: 'x'.repeat(20001) })));
  await assertFails(setDoc(doc(anon.firestore(), 'setTimes', 'x_acl-26'), tip('x', 'acl-26')));
  // Only a festival id like the app's (letters, numbers, - _ .; at most 64).
  await assertFails(setDoc(doc(A.firestore(), 'setTimes', 'uidA_acl 26!'), tip('uidA', 'acl 26!')));
  await assertFails(setDoc(doc(A.firestore(), 'setTimes', `uidA_${'x'.repeat(65)}`), tip('uidA', 'x'.repeat(65))));
  // The sender sees their own; nobody else but HQ.
  await assertSucceeds(getDoc(doc(A.firestore(), 'setTimes', 'uidA_edc-orlando-26')));
  await assertSucceeds(getDocs(query(collection(A.firestore(), 'setTimes'), where('uid', '==', 'uidA'))));
  await assertFails(getDoc(doc(B.firestore(), 'setTimes', 'uidA_edc-orlando-26')));
  await assertFails(getDocs(collection(B.firestore(), 'setTimes')));
  await assertSucceeds(getDocs(query(collection(H.firestore(), 'setTimes'), where('status', '==', 'new'))));
  await assertSucceeds(getDocs(query(collection(H.firestore(), 'setTimes'), where('status', '==', 'new'), orderBy('createdAt', 'desc'), limit(30))));
  await assertFails(updateDoc(doc(A.firestore(), 'setTimes', 'uidA_edc-orlando-26'), { status: 'live' }));
  await assertFails(updateDoc(doc(H.firestore(), 'setTimes', 'uidA_edc-orlando-26'), { status: 'live' }));
  await assertSucceeds(updateDoc(doc(H.firestore(), 'setTimes', 'uidA_edc-orlando-26'), { status: 'live', photo: deleteField() }));
  await assertSucceeds(setDoc(doc(B.firestore(), 'setTimes', 'uidB_acl-26'), tip('uidB', 'acl-26')));
  await assertSucceeds(deleteDoc(doc(H.firestore(), 'setTimes', 'uidB_acl-26')));
});
await t('clip comments: anyone with a profile comments on a Discover clip as themselves, at the server time; anyone signed in reads them', async () => {
  // Fresh people, so earlier blocks and handle changes don't matter: @kai and @lena.
  const K = env.authenticatedContext('uidK'), Lc = env.authenticatedContext('uidLc'), N = env.authenticatedContext('uidNoProfileC');
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'profiles', 'uidK'), profile('kai'));
    await setDoc(doc(ctx.firestore(), 'profiles', 'uidLc'), profile('lena'));
  });
  const cc = (over = {}) => ({ clipId: 'yt-dQw4w9WgXcQ', uid: 'uidK', handle: 'kai', text: 'That drop!', createdAt: serverTimestamp(), ...over });
  await assertSucceeds(setDoc(doc(K.firestore(), 'clipComments', 'k1'), cc()));
  await assertSucceeds(setDoc(doc(K.firestore(), 'clipComments', 'k2'), cc({ clipId: 'soundcloud:hedex' })));
  await assertSucceeds(setDoc(doc(Lc.firestore(), 'clipComments', 'l1'), cc({ uid: 'uidLc', handle: 'lena', text: 'Agreed' })));
  await assertSucceeds(getDocs(query(collection(Lc.firestore(), 'clipComments'), where('clipId', '==', 'yt-dQw4w9WgXcQ'), orderBy('createdAt', 'asc'), limit(50))));
  await assertSucceeds(getCountFromServer(query(collection(Lc.firestore(), 'clipComments'), where('clipId', '==', 'yt-dQw4w9WgXcQ'))));
  await assertFails(getDocs(query(collection(anon.firestore(), 'clipComments'), where('clipId', '==', 'yt-dQw4w9WgXcQ'))));
  await assertFails(setDoc(doc(anon.firestore(), 'clipComments', 'x0'), cc()));
  // Not as someone else, not with another handle, not without a profile, not empty or too long, no phone clock, no extra fields, a real-looking clip id.
  const db = K.firestore();
  await assertFails(setDoc(doc(db, 'clipComments', 'x1'), cc({ uid: 'uidLc' })));
  await assertFails(setDoc(doc(db, 'clipComments', 'x2'), cc({ handle: 'lena' })));
  await assertFails(setDoc(doc(N.firestore(), 'clipComments', 'x3'), cc({ uid: 'uidNoProfileC', handle: 'kai' })));
  await assertFails(setDoc(doc(db, 'clipComments', 'x4'), cc({ text: '' })));
  await assertFails(setDoc(doc(db, 'clipComments', 'x5'), cc({ text: 'x'.repeat(301) })));
  await assertSucceeds(setDoc(doc(db, 'clipComments', 'x6'), cc({ text: 'x'.repeat(300) })));
  await assertFails(setDoc(doc(db, 'clipComments', 'x7'), cc({ createdAt: now })));
  await assertFails(setDoc(doc(db, 'clipComments', 'x8'), cc({ pinned: true })));
  await assertFails(setDoc(doc(db, 'clipComments', 'x9'), cc({ clipId: '' })));
  await assertFails(setDoc(doc(db, 'clipComments', 'x10'), cc({ clipId: 'has spaces/and slashes' })));
  await assertFails(setDoc(doc(db, 'clipComments', 'x11'), cc({ clipId: 'y'.repeat(129) })));
  await assertFails(setDoc(doc(db, 'clipComments', 'x12'), cc({ clipId: 42 })));
});
await t('clip comments: never edited; removed by the writer or the support account, not anyone else; reportable', async () => {
  const K = env.authenticatedContext('uidK'), Lc = env.authenticatedContext('uidLc');
  const H = env.authenticatedContext('uidHQ', { email: 'afterglowmusic.support@gmail.com', email_verified: true });
  const NV = env.authenticatedContext('uidFake', { email: 'afterglowmusic.support@gmail.com', email_verified: false });
  await assertFails(updateDoc(doc(K.firestore(), 'clipComments', 'k1'), { text: 'changed' }));
  await assertFails(deleteDoc(doc(Lc.firestore(), 'clipComments', 'k1')));
  await assertFails(deleteDoc(doc(NV.firestore(), 'clipComments', 'k1')));
  await assertSucceeds(deleteDoc(doc(K.firestore(), 'clipComments', 'k1')));
  await assertSucceeds(setDoc(doc(K.firestore(), 'reports', 'rclip'), { by: 'uidK', kind: 'clipComment', targetId: 'l1', ownerUid: 'uidLc', reason: 'offensive', note: '', status: 'open', createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(K.firestore(), 'reports', 'rclip2'), { by: 'uidK', kind: 'clipThing', targetId: 'l1', ownerUid: 'uidLc', reason: 'offensive', note: '', status: 'open', createdAt: serverTimestamp() }));
  await assertSucceeds(getDoc(doc(H.firestore(), 'clipComments', 'l1')));
  await assertSucceeds(deleteDoc(doc(H.firestore(), 'clipComments', 'l1')));
});
console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
