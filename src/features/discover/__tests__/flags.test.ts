import { describe, expect, it } from '@jest/globals';
import { cleanFlags, FLAGS_MAX, flagMailto, flagReport, withFlag } from '../flags';

describe('flagging a wrong clip', () => {
  it('keeps one flag per clip, newest reason winning, and stays bounded', () => {
    let f = withFlag({}, 'c1', 'wrong-artist', 1);
    f = withFlag(f, 'c1', 'not-a-set', 2);
    expect(f).toEqual({ c1: { reason: 'not-a-set', at: 2 } });
    let many = {};
    for (let i = 0; i < FLAGS_MAX + 5; i++) many = withFlag(many, `x${i}`, 'other', i);
    expect(Object.keys(many)).toHaveLength(FLAGS_MAX);
    expect(many).not.toHaveProperty('x0');
    expect(many).toHaveProperty(`x${FLAGS_MAX + 4}`);
  });

  it('reads back saved flags safely', () => {
    expect(cleanFlags(null)).toEqual({});
    expect(cleanFlags([1])).toEqual({});
    expect(cleanFlags({ a: { reason: 'wont-play', at: 3 }, b: { reason: 'nope', at: 1 }, c: { reason: 'other' }, d: null })).toEqual({ a: { reason: 'wont-play', at: 3 } });
  });

  it('writes a report with enough to find the video', () => {
    const r = flagReport(
      { id: 'yt-abc', title: 'Live at Lost Lands', videoId: 'abcdefghijk', link: 'https://www.youtube.com/watch?v=abcdefghijk&t=600s', channel: 'Fan uploads' },
      'SUBTRONICS',
      'wrong-artist',
      'Afterglow',
    );
    expect(r.subject).toBe('Wrong clip: SUBTRONICS (wrong artist)');
    expect(r.body).toBe(
      [
        'Wrong artist: the clip shown for SUBTRONICS in Discover.',
        'Clip: Live at Lost Lands (from Fan uploads)',
        'Video: https://www.youtube.com/watch?v=abcdefghijk&t=600s',
        'Video id: abcdefghijk',
        'Sent from Afterglow',
      ].join('\n'),
    );
    expect(flagMailto('help@example.com', r)).toBe(`mailto:help@example.com?subject=${encodeURIComponent(r.subject)}&body=${encodeURIComponent(r.body)}`);
  });
});
