import { describe, expect, it } from '@jest/globals';
import type { Artist } from '../../../data/models';
import { lineupPoster, lineupPosterText, POSTER_MID, POSTER_REST, POSTER_TOP } from '../lineupPoster';
import type { Pick } from '../plan';

const pick = (id: string, tier: Pick['tier'], opts: Partial<Pick> = {}): Pick => ({
  artist: { id, name: id.toUpperCase(), sound: {} } as Artist,
  match: 0.8,
  tier,
  pinned: false,
  known: true,
  ...opts,
});
const fest = { name: 'Solstice 2026', dates: 'Jun 19 to 21', location: 'Lakeside Grounds' };

describe('your lineup poster', () => {
  it('puts your stars up top, then your best matches, leaving out guesses', () => {
    const picks = [pick('a', 'must-see'), pick('b', 'strong'), pick('c', 'strong', { pinned: true }), pick('d', 'explore'), pick('e', 'explore', { known: false })];
    const p = lineupPoster(fest, picks)!;
    expect(p.rows[0]).toEqual({ size: 'top', names: [{ name: 'C', star: true }, { name: 'A', star: false }] });
    expect(p.rows[1].names.map((n) => n.name)).toEqual(['B', 'D']);
    expect(p.count).toBe(4);
    expect(p.subtitle).toBe('Jun 19 to 21 · Lakeside Grounds');
    expect(lineupPosterText(p)).toBe('My Solstice 2026 lineup\nJun 19 to 21 · Lakeside Grounds\n\nC · A\nB · D\n\nMade with Afterglow');
  });

  it('fills three rows and counts the rest', () => {
    const many = Array.from({ length: POSTER_TOP + POSTER_MID + POSTER_REST + 3 }, (_, i) => pick(`x${i}`, 'strong'));
    const p = lineupPoster(fest, many)!;
    expect(p.rows.map((r) => r.names.length)).toEqual([POSTER_TOP, POSTER_MID, POSTER_REST]);
    expect(p.more).toBe(3);
    expect(lineupPosterText(p)).toContain('and 3 more');
  });

  it('has nothing to show without anyone you know', () => {
    expect(lineupPoster(fest, [pick('e', 'explore', { known: false })])).toBeUndefined();
  });
});
