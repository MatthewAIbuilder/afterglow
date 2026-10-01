import { describe, expect, it } from '@jest/globals';
import { shareDetail, shareOffer } from '../shareChoice';

const base = { available: true, signedIn: true, hasProfile: true, tagged: true, alreadyShared: false };

describe('share to Discover on the tagging sheet', () => {
  it('needs profiles set up, an account, a profile and the tags, in that order', () => {
    expect(shareOffer({ ...base, available: false })).toBe('hidden');
    expect(shareOffer({ ...base, alreadyShared: true })).toBe('hidden');
    expect(shareOffer({ ...base, signedIn: false, hasProfile: false })).toBe('needs-account');
    expect(shareOffer({ ...base, hasProfile: false })).toBe('needs-profile');
    expect(shareOffer({ ...base, tagged: false })).toBe('needs-tags');
    expect(shareOffer(base)).toBe('ready');
  });

  it('says plainly where it goes, or what it needs', () => {
    expect(shareDetail('ready', { handle: 'maya', festival: 'Cyclops Cove 4', on: true })).toMatch(/^People discovering Cyclops Cove 4 can watch it, credited to @maya\. Afterglow doesn’t add where you filmed it/);
    expect(shareDetail('ready', { on: false })).toBe('Only in your Memories, on this phone.');
    expect(shareDetail('needs-tags', { on: false })).toBe('Pick the festival and who was playing to share it to Discover.');
  });
});
