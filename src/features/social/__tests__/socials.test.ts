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
