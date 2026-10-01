import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';
import type { Artist, Festival } from '../../../data/models';
import { COVER_MAX, coverPhotos } from '../cover';
import { FestivalCover } from '../FestivalCover';

const artists: Record<string, Artist> = {
  a: { id: 'a', name: 'A', sound: {}, imageUrl: 'https://cdn.example/a.jpg' },
  b: { id: 'b', name: 'B', sound: {} },
  c: { id: 'c', name: 'C', sound: {}, imageUrl: 'https://cdn.example/c.jpg' },
  ab: { id: 'ab', name: 'A B2B B', sound: {}, members: [{ name: 'A', imageUrl: 'https://cdn.example/a.jpg' }, { name: 'B' }] },
  d: { id: 'd', name: 'D B2B E', sound: {}, members: [{ name: 'D' }, { name: 'E', imageUrl: 'https://cdn.example/e.jpg' }] },
};
const fest = (lineup: string[]): Festival => ({ id: 'f', name: 'F', dates: '', location: '', days: [], stages: [], lineup });
const artist = (id: string) => artists[id];

describe('festival covers', () => {
  it("takes the headliners' photos in billing order, each once, b2b members included", () => {
    expect(coverPhotos(fest(['a', 'b', 'ab', 'c', 'd', 'nobody']), artist)).toEqual([
      'https://cdn.example/a.jpg',
      'https://cdn.example/c.jpg',
      'https://cdn.example/e.jpg',
    ]);
  });

  it('stops at the most a cover shows, and gives none with fewer than two photos', () => {
    const many = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`x${i}`, { id: `x${i}`, name: `X${i}`, sound: {}, imageUrl: `https://cdn.example/${i}.jpg` }]));
    expect(coverPhotos(fest(Object.keys(many)), (id) => many[id])).toHaveLength(COVER_MAX);
    expect(coverPhotos(fest(['a', 'b']), artist)).toEqual([]);
  });

  it('draws a slice per photo, and nothing without photos', async () => {
    const view = await render(<FestivalCover photos={['https://cdn.example/a.jpg', 'https://cdn.example/c.jpg']} fade="page" />);
    expect(view.getAllByTestId('cover-photo', { includeHiddenElements: true })).toHaveLength(2);
    const empty = await render(<FestivalCover photos={[]} />);
    expect(empty.queryByTestId('cover-photo')).toBeNull();
  });
});
