import { describe, expect, it } from '@jest/globals';
import { pictureName } from '../pictureName';

describe('picture file names', () => {
  it('turns a title into a plain file name', () => {
    expect(pictureName('My EDC Orlando 2026')).toBe('my-edc-orlando-2026');
    expect(pictureName('RÜFÜS DU SOL · Sunday!')).toBe('rufus-du-sol-sunday');
    expect(pictureName('★ ★')).toBe('afterglow');
  });
});
