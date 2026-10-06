import { describe, expect, it } from '@jest/globals';
import { pagerIds } from '../VerticalPager';

describe('swiping through a profile’s videos', () => {
  it('uses the list when it holds the video opened, once each; otherwise just that video', () => {
    expect(pagerIds('a,b,c', 'b')).toEqual(['a', 'b', 'c']);
    expect(pagerIds('a,b,a', 'a')).toEqual(['a', 'b']);
    expect(pagerIds('a,b', 'z')).toEqual(['z']);
    expect(pagerIds(undefined, 'z')).toEqual(['z']);
    expect(pagerIds(' a , ,b', 'b')).toEqual(['a', 'b']);
  });
});
