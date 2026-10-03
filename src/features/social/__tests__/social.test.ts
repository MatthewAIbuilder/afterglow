import { describe, expect, it } from '@jest/globals';
import { goingLine } from '../copy';
import { firebaseErrorKind, memoryFromDoc, prefixEnd, profileFromDoc, videoType } from '../firebase/mapping';
import type { Profile } from '../models';
import { publishedChanged } from '../publish';
import { cleanProfileInput, handleProblem, isOffensive, normalizeHandle, profileProblems, suggestHandle } from '../validate';

/** What people publish is checked, and what comes back from the database is never trusted. */
describe('handles, names and bios', () => {
  it('accepts tidy handles and says plainly what’s wrong with the rest', () => {
    expect(handleProblem('bass_head.23')).toBeUndefined();
    expect(handleProblem('@MayaChen')).toBeUndefined();
    expect(normalizeHandle('  @MayaChen ')).toBe('mayachen');
    expect(handleProblem('ab')).toBe('At least 3 characters.');
    expect(handleProblem('a'.repeat(21))).toBe('At most 20 characters.');
    expect(handleProblem('bass head')).toBe('Letters, numbers, dots and underscores only.');
    expect(handleProblem('_bass')).toBe('Start and end with a letter or number.');
    expect(handleProblem('bass..head')).toBe('No two dots or underscores in a row.');
  });

  it('keeps handles that look official, and offensive ones, off Afterglow', () => {
    expect(handleProblem('admin')).toBe('That handle isn’t available.');
    expect(handleProblem('afterglow_team')).toBe('That handle isn’t available.');
    expect(handleProblem('sh1t_head')).toBe('That handle isn’t allowed.');
    // Innocent words that contain rude ones are fine.
    expect(handleProblem('scunthorpe')).toBeUndefined();
    expect(isOffensive('Sunrise sets in Scunthorpe')).toBe(false);
  });

  it('checks the whole profile', () => {
    const ok = { handle: 'maya', displayName: 'Maya', bio: 'Rail rider.', showFestivals: true, showSound: false };
    expect(profileProblems(ok)).toEqual({});
    expect(profileProblems({ ...ok, displayName: '  ' }).displayName).toBe('Add a name.');
    expect(profileProblems({ ...ok, displayName: 'x'.repeat(41) }).displayName).toBe('At most 40 characters.');
    expect(profileProblems({ ...ok, bio: 'x'.repeat(161) }).bio).toBe('At most 160 characters.');
    expect(profileProblems({ ...ok, bio: 'what the fuck' }).bio).toBe('Please keep your bio friendly.');
    expect(cleanProfileInput({ ...ok, handle: '@Maya', displayName: '  Maya   Chen ', bio: 'a\n\n\n\nb' })).toMatchObject({ handle: 'maya', displayName: 'Maya Chen', bio: 'a\n\nb' });
  });

  it('suggests a handle from an email', () => {
    expect(suggestHandle('maya.chen@example.com')).toBe('mayachen');
    expect(suggestHandle('Zoë@example.com')).toBe('zoe');
    expect(suggestHandle('a@b.co')).toBe('');
  });
});

describe('reading the database defensively', () => {
  it('a profile: wrong types dropped, unknown sounds dropped, photos only over https', () => {
    const p = profileFromDoc('u1', {
      handle: 'maya',
      displayName: 42,
      bio: 'hi',
      avatarUrl: 'http://insecure.example/a.jpg',
      festivals: ['acl-26', 7, 'edc-orlando-26'],
      sounds: ['dubstep', 'polka', 'house', 'techno', 'pop'],
      showFestivals: 'yes',
      showSound: true,
    });
    expect(p).toMatchObject({ uid: 'u1', handle: 'maya', displayName: 'maya', bio: 'hi', festivals: ['acl-26', 'edc-orlando-26'], showFestivals: false, showSound: true });
    expect(p!.avatarUrl).toBeUndefined();
    expect(p!.sounds).toEqual(['dubstep', 'house']);
    expect(profileFromDoc('u1', { displayName: 'No handle' })).toBeNull();
    expect(profileFromDoc('u1', undefined)).toBeNull();
  });

  it('a shared memory: needs its owner, an https video and a date; never carries a place', () => {
    const m = memoryFromDoc('s1', { uid: 'u1', handle: 'maya', videoUrl: 'https://x.test/v.mp4', capturedAt: '2026-10-03T03:00:00Z', place: { city: 'Austin' }, durationSec: -3 });
    expect(m).toMatchObject({ id: 's1', uid: 'u1', videoUrl: 'https://x.test/v.mp4' });
    expect(m!.durationSec).toBeUndefined();
    expect(JSON.stringify(m)).not.toContain('Austin');
    expect(memoryFromDoc('s1', { uid: 'u1', videoUrl: 'file:///x.mp4', capturedAt: 'x' })).toBeNull();
  });

  it('Firebase errors become plain kinds', () => {
    expect(firebaseErrorKind({ code: 'auth/email-already-in-use' })).toBe('email-in-use');
    expect(firebaseErrorKind({ code: 'auth/invalid-credential' })).toBe('wrong-password');
    expect(firebaseErrorKind({ code: 'auth/network-request-failed' })).toBe('network');
    expect(firebaseErrorKind({ code: 'auth/too-many-requests' })).toBe('too-many-attempts');
    expect(firebaseErrorKind(new Error('?'))).toBe('unknown');
  });

  it('video types and name searches', () => {
    expect(videoType('file:///a/IMG_1.MOV')).toBe('video/quicktime');
    expect(videoType('file:///a/clip.mp4?x=1')).toBe('video/mp4');
    expect(videoType('file:///a/clip.m4v')).toBe('video/x-m4v');
    expect(prefixEnd('may')).toBe('may');
  });
});

describe('what a profile publishes', () => {
  const p: Profile = {
    uid: 'u1',
    handle: 'maya',
    displayName: 'Maya',
    bio: '',
    festivals: ['acl-26'],
    sounds: ['house'],
    artists: ['subtronics'],
    showFestivals: true,
    showSound: false,
    showArtists: true,
    createdAt: '',
    updatedAt: '',
  };

  it('follows your plans only for what you switched on, ignoring order', () => {
    expect(publishedChanged(p, ['acl-26'], ['dubstep'])).toBe(false); // sound is off
    expect(publishedChanged(p, ['acl-26', 'edc-orlando-26'], ['house'])).toBe(true);
    expect(publishedChanged({ ...p, festivals: ['a', 'b'] }, ['b', 'a'], [])).toBe(false);
    expect(publishedChanged({ ...p, showFestivals: false }, ['anything'], [])).toBe(false);
  });

  it('keeps your favourite artists current unless you switch them off', () => {
    expect(publishedChanged(p, ['acl-26'], [], ['subtronics'])).toBe(false);
    expect(publishedChanged(p, ['acl-26'], [], ['subtronics', 'levity'])).toBe(true);
    expect(publishedChanged({ ...p, showArtists: false }, ['acl-26'], [], ['levity'])).toBe(false);
    expect(publishedChanged(p, ['acl-26'], [])).toBe(false); // not given: left alone
  });

  it('says where someone is going', () => {
    expect(goingLine([])).toBeUndefined();
    expect(goingLine(['ACL 2026'])).toBe('Going to ACL 2026');
    expect(goingLine(['ACL 2026', 'EDC Orlando 2026'])).toBe('Going to ACL 2026 and EDC Orlando 2026');
    expect(goingLine(['a', 'b', 'c', 'd'])).toBe('Going to 4 festivals');
  });
});
