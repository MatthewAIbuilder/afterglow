import { profileFields, profileFromDoc, profileToDoc } from '../firebase/mapping';
import { describe, expect, it } from '@jest/globals';
import { cleanSocials, readSocial, socialA11y, socialProblem, socialUrl } from '../socials';
import { cleanProfileInput, profileProblems } from '../validate';

describe('socials on profiles', () => {
  it('reads a username however it’s typed or pasted', () => {
    expect(readSocial('instagram', '@Maya.Chen')).toBe('maya.chen');
    expect(readSocial('instagram', 'https://www.instagram.com/maya.chen/?hl=en')).toBe('maya.chen');
    expect(readSocial('instagram', 'instagram.com/maya_c')).toBe('maya_c');
    expect(readSocial('tiktok', 'https://www.tiktok.com/@maya.dances?lang=en')).toBe('maya.dances');
    expect(readSocial('snapchat', 'https://www.snapchat.com/add/mayac')).toBe('mayac');
    expect(readSocial('snapchat', '  ')).toBe('');
    // A link to somewhere else is just text, and won't pass.
    expect(socialProblem('instagram', readSocial('instagram', 'https://evil.example/maya'))).toMatch(/^That doesn’t look like an? Instagram username/);
  });

  it('checks each service’s own shape', () => {
    expect(socialProblem('instagram', 'maya.chen')).toBeUndefined();
    expect(socialProblem('instagram', 'maya..chen')).toBeDefined();
    expect(socialProblem('snapchat', '1maya')).toBeDefined();
    expect(socialProblem('snapchat', 'ma')).toBeDefined();
    expect(socialProblem('tiktok', 'm')).toBeDefined();
    expect(socialProblem('tiktok', '')).toBeUndefined();
  });

  it('makes the links itself, so a profile can only point at the account', () => {
    expect(socialUrl('instagram', 'maya')).toBe('https://instagram.com/maya');
    expect(socialUrl('snapchat', 'maya')).toBe('https://www.snapchat.com/add/maya');
    expect(socialUrl('tiktok', 'maya')).toBe('https://www.tiktok.com/@maya');
    expect(socialA11y('tiktok', 'maya', 'Maya')).toBe('Maya on TikTok, @maya. Opens TikTok.');
  });

  it('keeps only good usernames', () => {
    expect(cleanSocials({ instagram: '@Maya', snapchat: '1bad', tiktok: 'https://tiktok.com/@maya.d', other: 'x' })).toEqual({ instagram: 'maya', tiktok: 'maya.d' });
    expect(cleanSocials(null)).toEqual({});
  });

  it('a bad username is a problem when saving; empty ones are left off', () => {
    const base = { handle: 'maya', displayName: 'Maya', bio: '', showFestivals: false, showSound: false };
    expect(profileProblems({ ...base, socials: { instagram: 'maya..x', snapchat: '', tiktok: '' } }).instagram).toBeDefined();
    expect(profileProblems({ ...base, socials: { instagram: '@maya', snapchat: '', tiktok: '' } })).toEqual({});
    expect(cleanProfileInput({ ...base, socials: { instagram: '@Maya', snapchat: '', tiktok: '' } }).socials).toEqual({ instagram: 'maya' });
  });
});

describe('pasted links that aren’t profiles', () => {
  it('a link to an Instagram post or reel gives no username', () => {
    expect(readSocial('instagram', 'https://www.instagram.com/p/C1x2y3/')).toBe('');
    expect(readSocial('instagram', 'instagram.com/reel/abc')).toBe('');
    expect(readSocial('instagram', 'instagram.com/maya.chen/')).toBe('maya.chen');
  });
});

describe('profile fields', () => {
  it('stores usernames as their own fields (never a socials object), so the rules accept every profile write', () => {
    const f = profileFields({
      uid: 'u1',
      handle: 'maya',
      displayName: 'Maya Chen',
      bio: '',
      festivals: [],
      sounds: [],
      showFestivals: false,
      showSound: false,
      artists: [],
      showArtists: true,
      socials: { instagram: 'maya.chen', tiktok: 'maya' },
      avatarUrl: 'https://x/a.jpg',
      createdAt: 'a',
      updatedAt: 'b',
    });
    expect(f).not.toHaveProperty('socials');
    expect(f).not.toHaveProperty('uid');
    expect(f).not.toHaveProperty('coverUrl');
    expect(f).toMatchObject({ instagram: 'maya.chen', tiktok: 'maya', nameLower: 'maya chen', avatarUrl: 'https://x/a.jpg' });
    // Read back, it's the same profile.
    expect(profileFromDoc('u1', f)?.socials).toEqual({ instagram: 'maya.chen', tiktok: 'maya' });
    // For a database still on the older rules, the newer fields (socials among them) are left out, so the rest still saves.
    const older = profileToDoc(profileFromDoc('u1', f)!, true);
    for (const k of ['instagram', 'snapchat', 'tiktok', 'artists', 'showArtists', 'backdrop']) expect(older).not.toHaveProperty(k);
    expect(older).toMatchObject({ handle: 'maya', nameLower: 'maya chen' });
  });
});
