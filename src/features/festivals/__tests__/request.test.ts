import { describe, expect, it } from '@jest/globals';
import { cleanRequest, cleanRequests, requestMailto, requestText } from '../request';

describe('requesting a festival', () => {
  it('needs a name, and trims what was typed', () => {
    expect(cleanRequest('  ')).toBeUndefined();
    expect(cleanRequest(' Lost Lands 2027 ', '  ')).toEqual({ name: 'Lost Lands 2027' });
    expect(cleanRequest('Ultra', ' https://ultramusicfestival.com ')).toEqual({ name: 'Ultra', link: 'https://ultramusicfestival.com' });
    expect(cleanRequest('x'.repeat(200))!.name).toHaveLength(80);
  });

  it('writes a plain request, with the link when there is one', () => {
    expect(requestText({ name: 'Ultra' }, 'Afterglow')).toEqual({
      subject: 'Festival request: Ultra',
      body: 'Please add Ultra to Afterglow.\n\nSent from Afterglow',
    });
    expect(requestText({ name: 'Ultra', link: 'https://u.com' }, 'Afterglow').body).toContain('Lineup or website: https://u.com');
  });

  it('builds a mail link with everything encoded', () => {
    const url = requestMailto('team@example.com', { name: 'Lost Lands & Friends' }, 'Afterglow');
    expect(url.startsWith('mailto:team@example.com?subject=Festival%20request%3A%20Lost%20Lands%20%26%20Friends&body=')).toBe(true);
    expect(url).not.toMatch(/ /);
  });

  it('reads back only well-formed saved requests', () => {
    expect(cleanRequests([{ name: 'A', at: 1 }, { name: 2 }, null, 'x'])).toEqual([{ name: 'A', at: 1 }]);
    expect(cleanRequests('nope')).toEqual([]);
  });
});
