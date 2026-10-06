import { describe, expect, it } from '@jest/globals';
import {
  type Asked,
  candidateUrls,
  lookUpProfiles,
  MAX_CANDIDATES,
  oembedUrl,
  pickProfile,
  readAnswer,
  RETRY_MISSES_DAYS,
  soundcloudImage,
  soundcloudPlan,
  soundcloudProfile,
  soundcloudUrl,
} from '../soundcloud';

const IMG = 'https://i1.sndcdn.com/avatars-000123-abcdef-t500x500.jpg';

/** An oEmbed answer, as SoundCloud gives one for a page. */
const answer = (name: string, url: string) => ({
  version: 1,
  type: 'rich',
  provider_name: 'SoundCloud',
  title: `Latest tracks by ${name}`,
  author_name: name,
  author_url: url,
  thumbnail_url: IMG,
  html: '<iframe></iframe>',
});

describe('SoundCloud page links', () => {
  it('accepts soundcloud.com pages only, tidied', () => {
    expect(soundcloudUrl('https://soundcloud.com/subtronics')).toBe('https://soundcloud.com/subtronics');
    expect(soundcloudUrl(' https://www.soundcloud.com/john-summit/ ')).toBe('https://soundcloud.com/john-summit');
    expect(soundcloudUrl('https://m.soundcloud.com/a_b/sets/live')).toBe('https://soundcloud.com/a_b/sets/live');
    for (const bad of [
      'http://soundcloud.com/subtronics',
      'https://soundcloud.com/',
      'https://evil.com/soundcloud.com/x',
      'https://soundcloud.com.evil.com/x',
      'https://soundcloud.com/a/b/c/d',
      'https://soundcloud.com/x?y=1',
      'javascript:alert(1)',
      `https://soundcloud.com/${'a'.repeat(201)}`,
      42,
      undefined,
    ])
      expect(soundcloudUrl(bad)).toBeUndefined();
  });

  it('accepts pictures from SoundCloud’s image servers only', () => {
    expect(soundcloudImage(IMG)).toBe(IMG);
    expect(soundcloudImage('https://example.com/a.jpg')).toBeUndefined();
    expect(soundcloudImage('http://i1.sndcdn.com/a.jpg')).toBeUndefined();
  });

  it('reads a saved profile, dropping what looks wrong', () => {
    expect(soundcloudProfile({ url: 'https://soundcloud.com/x', name: 'X', image: IMG })).toEqual({ url: 'https://soundcloud.com/x', name: 'X', image: IMG });
    expect(soundcloudProfile({ url: 'https://soundcloud.com/x', name: 'n'.repeat(200), image: 'https://bad.com/a.jpg' })).toEqual({ url: 'https://soundcloud.com/x' });
    expect(soundcloudProfile({ url: 'https://youtube.com/x' })).toBeUndefined();
    expect(soundcloudProfile('https://soundcloud.com/x')).toBeUndefined();
  });
});

describe('candidate pages', () => {
  it('tries the hyphenated name, the joined name, then with "music"', () => {
    expect(candidateUrls('John Summit')).toEqual([
      'https://soundcloud.com/john-summit',
      'https://soundcloud.com/johnsummit',
      'https://soundcloud.com/johnsummitmusic',
    ]);
    expect(candidateUrls('SUBTRONICS')).toEqual(['https://soundcloud.com/subtronics', 'https://soundcloud.com/subtronicsmusic']);
    expect(candidateUrls('RÜFÜS DU SOL')[0]).toBe('https://soundcloud.com/rufus-du-sol');
    expect(candidateUrls('Above & Beyond')[0]).toBe('https://soundcloud.com/above-and-beyond');
  });

  it('never more than three, and none for b2b acts or names too short', () => {
    expect(candidateUrls('A B C D').length).toBeLessThanOrEqual(MAX_CANDIDATES);
    expect(candidateUrls('SUBTRONICS B2B CRANKDAT')).toEqual([]);
    expect(candidateUrls('?')).toEqual([]);
    expect(candidateUrls('X')).toEqual([]);
  });

  it('asks the public oEmbed endpoint', () => {
    expect(oembedUrl('https://soundcloud.com/john-summit')).toBe('https://soundcloud.com/oembed?format=json&url=https%3A%2F%2Fsoundcloud.com%2Fjohn-summit');
  });
});

describe('matching an answer', () => {
  it('takes a page whose name is the artist’s exactly (case, accents, punctuation aside)', () => {
    expect(pickProfile('Subtronics', 'https://soundcloud.com/subtronics', answer('SUBTRONICS', 'https://soundcloud.com/subtronics'))).toEqual({
      url: 'https://soundcloud.com/subtronics',
      name: 'SUBTRONICS',
      image: IMG,
    });
    expect(pickProfile('RÜFÜS DU SOL', 'https://soundcloud.com/rufusdusol', answer('Rufus Du Sol', 'https://soundcloud.com/rufusdusol'))?.url).toBe(
      'https://soundcloud.com/rufusdusol',
    );
  });

  it('refuses someone else’s page', () => {
    expect(pickProfile('Levity', 'https://soundcloud.com/levity', answer('Levity Beats', 'https://soundcloud.com/levity'))).toBeUndefined();
    expect(pickProfile('Levity', 'https://soundcloud.com/levity', { author_name: 42 })).toBeUndefined();
    expect(pickProfile('Levity', 'https://soundcloud.com/levity', null)).toBeUndefined();
  });

  it('keeps the page SoundCloud points to, or the one asked about', () => {
    expect(pickProfile('A B', 'https://soundcloud.com/a-b', answer('A B', 'https://soundcloud.com/abofficial'))?.url).toBe('https://soundcloud.com/abofficial');
    expect(pickProfile('A B', 'https://soundcloud.com/a-b', answer('A B', 'https://evil.com/x'))?.url).toBe('https://soundcloud.com/a-b');
  });

  it('reads the answer’s status: found, not found, or failed', () => {
    const url = 'https://soundcloud.com/levity';
    expect(readAnswer('Levity', url, 200, answer('Levity', url)).status).toBe('found');
    expect(readAnswer('Levity', url, 200, answer('Other', url)).status).toBe('not-found');
    expect(readAnswer('Levity', url, 404, undefined).status).toBe('not-found');
    expect(readAnswer('Levity', url, 403, undefined).status).toBe('failed');
    expect(readAnswer('Levity', url, 429, undefined).status).toBe('failed');
    expect(readAnswer('Levity', url, 500, undefined).status).toBe('failed');
  });
});

describe('tonight’s plan', () => {
  const artists = [
    { id: 'own', name: 'Own Link', soundcloud: 'https://soundcloud.com/own' },
    { id: 'found', name: 'Found Before' },
    { id: 'missed', name: 'Missed Lately' },
    { id: 'old-miss', name: 'Missed Long Ago' },
    { id: 'new', name: 'Brand New' },
    { id: 'b2b', name: 'A B2B B' },
    { id: 'new', name: 'Brand New' },
  ];
  const plan = soundcloudPlan(
    artists,
    { found: { url: 'https://soundcloud.com/found' }, own: { url: 'https://soundcloud.com/wrong' }, gone: { url: 'https://soundcloud.com/gone' } },
    { missed: '2026-10-01', 'old-miss': '2026-08-01' },
    '2026-10-06',
  );

  it('never looks up an artist with their own link, and drops any match for them', () => {
    expect(plan.keep.own).toBeUndefined();
    expect(plan.lookUp.map((a) => a.id)).not.toContain('own');
  });

  it('keeps earlier finds without asking again, and drops artists no longer on Afterglow', () => {
    expect(plan.keep).toEqual({ found: { url: 'https://soundcloud.com/found' } });
  });

  it(`asks again about misses after ${RETRY_MISSES_DAYS} days, once per artist, never b2bs`, () => {
    expect(plan.lookUp.map((a) => a.id)).toEqual(['old-miss', 'new']);
    expect(plan.misses).toEqual({ missed: '2026-10-01' });
  });
});

describe('looking pages up', () => {
  const pages: Record<string, string> = { 'https://soundcloud.com/johnsummit': 'John Summit' };
  const fake =
    (fail: ReadonlySet<string> = new Set()) =>
    async (url: string): Promise<Asked> => {
      if (fail.has(url)) return { status: 'failed' };
      return pages[url] ? { status: 'found', profile: { url, name: pages[url] } } : { status: 'not-found' };
    };

  it('tries each link in turn until one is theirs; all not found is a miss', async () => {
    const asked: string[] = [];
    const r = await lookUpProfiles(
      [
        { id: 'john-summit', name: 'John Summit' },
        { id: 'nobody', name: 'Nobody Here' },
      ],
      async (url, name) => {
        asked.push(url);
        return fake()(url);
      },
      '2026-10-06',
    );
    expect(r.found).toEqual({ 'john-summit': { url: 'https://soundcloud.com/johnsummit', name: 'John Summit' } });
    expect(r.missed).toEqual({ nobody: '2026-10-06' });
    expect(asked).toEqual([
      'https://soundcloud.com/john-summit',
      'https://soundcloud.com/johnsummit',
      'https://soundcloud.com/nobody-here',
      'https://soundcloud.com/nobodyhere',
      'https://soundcloud.com/nobodyheremusic',
    ]);
    expect(r.asked).toBe(5);
  });

  it('a failed request is never a miss: that artist is asked again tomorrow', async () => {
    const r = await lookUpProfiles([{ id: 'x', name: 'Some One' }], fake(new Set(['https://soundcloud.com/someone'])), '2026-10-06');
    expect(r.missed).toEqual({});
    expect(r.failures).toBe(1);
  });

  it('stops at the night’s limit without counting the cut-off artist as a miss', async () => {
    const r = await lookUpProfiles(
      [
        { id: 'a', name: 'Alpha One' },
        { id: 'b', name: 'Beta Two' },
      ],
      fake(),
      '2026-10-06',
      { maxRequests: 4 },
    );
    expect(r.asked).toBe(4);
    expect(r.missed).toEqual({ a: '2026-10-06' });
  });

  it('gives up after too many failures (SoundCloud blocking)', async () => {
    const r = await lookUpProfiles(
      Array.from({ length: 20 }, (_, i) => ({ id: `a${i}`, name: `Artist Number ${i}` })),
      async () => ({ status: 'failed' }),
      '2026-10-06',
      { maxFailures: 3 },
    );
    expect(r.asked).toBe(3);
    expect(r.stopped).toBe(true);
    expect(r.found).toEqual({});
    expect(r.missed).toEqual({});
  });
});
