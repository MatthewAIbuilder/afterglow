import { describe, expect, it } from '@jest/globals';
import { parseCatalogFile } from '../file';

const file = (festival: Record<string, unknown>) => ({
  version: 1,
  mode: 'add',
  artists: [{ id: 'a', name: 'A' }],
  festivals: [{ id: 'f', name: 'F', dates: 'Soon', location: 'Here', lineup: ['a'], days: [], ...festival }],
  clips: [],
});

describe('official festival links in the catalogue', () => {
  it('reads https tickets and website links', () => {
    const { snapshot, problems } = parseCatalogFile(file({ tickets: 'https://tickets.example.com/f', website: 'https://example.com' }));
    expect(snapshot!.festivals[0].links).toEqual({ tickets: 'https://tickets.example.com/f', website: 'https://example.com' });
    expect(problems).toEqual([]);
  });

  it('drops links that aren’t https, and says so', () => {
    const { snapshot, problems } = parseCatalogFile(file({ tickets: 'http://tickets.example.com', website: 'javascript:alert(1)' }));
    expect(snapshot!.festivals[0].links).toBeUndefined();
    expect(problems).toEqual([
      'Festival "f": the tickets link must start with https://, so it was ignored.',
      'Festival "f": the website link must start with https://, so it was ignored.',
    ]);
  });
});
