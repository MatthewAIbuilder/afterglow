import { describe, expect, it } from '@jest/globals';
import { listenLinks } from '../listen';

describe('where to hear an artist', () => {
  it('searches YouTube for live sets and Spotify for the name, safely encoded', () => {
    expect(listenLinks('JKYL & HYDE')).toEqual([
      { service: 'YouTube', url: 'https://www.youtube.com/results?search_query=JKYL%20%26%20HYDE%20live%20set' },
      { service: 'Spotify', url: 'https://open.spotify.com/search/JKYL%20%26%20HYDE' },
    ]);
    expect(listenLinks('KI/KI')[1].url).toBe('https://open.spotify.com/search/KI%2FKI');
  });

  it('gives nothing for a blank name', () => {
    expect(listenLinks('  ')).toEqual([]);
  });
});
