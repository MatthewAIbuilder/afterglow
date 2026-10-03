import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { toShares } from '../../taste/lean';
import { activityText, friendActivity, shortAgo } from '../friendActivity';
import { matchLine, tasteMatch } from '../match';
import type { Profile, SharedMemory } from '../models';

const person = (uid: string, name: string, extra: Partial<Profile> = {}): Profile =>
  ({ uid, handle: uid, displayName: name, bio: '', festivals: [], sounds: [], showFestivals: true, showSound: true, createdAt: '', updatedAt: '', ...extra }) as Profile;

describe('taste match', () => {
  const mine = toShares({ dubstep: 0.5, riddim: 0.3, 'melodic-bass': 0.2 });
  it('is high for the same sounds, low for different ones, and nothing without sounds', () => {
    const same = tasteMatch(mine, ['dubstep', 'riddim', 'melodic-bass'])!;
    const other = tasteMatch(mine, ['house', 'techno'])!;
    expect(same).toBeGreaterThanOrEqual(75);
    expect(other).toBe(0);
    expect(tasteMatch(mine, ['dubstep', 'riddim', 'melodic-bass'], 1)).toBe(Math.min(100, same + 20));
    expect(tasteMatch([], ['dubstep'])).toBeUndefined();
    expect(tasteMatch(mine, [])).toBeUndefined();
    expect(matchLine(92)).toBe('92% taste match');
  });
});

describe('friends activity', () => {
  const now = Date.UTC(2026, 9, 10, 12);
  const cc = { id: 'cc', name: 'Cyclops Cove 4', startDate: '2026-12-04' } as Festival;
  const maya = person('maya', 'Maya', { festivals: ['cc'], sounds: ['dubstep', 'riddim', 'melodic-bass'] });
  const sam = person('sam', 'Sam', { sounds: ['house'] });
  const memory = (id: string, uid: string, createdAt: string): SharedMemory => ({ id, uid, handle: uid, videoUrl: 'https://v', capturedAt: createdAt, createdAt, artistId: 'subtronics' });

  it('lists recent moments, who is going where, and strong taste matches', () => {
    const items = friendActivity({
      profiles: [maya, sam],
      memories: [memory('old', 'sam', '2026-08-01T00:00:00Z'), memory('new', 'sam', '2026-10-10T10:00:00Z'), memory('blk', 'zed', '2026-10-10T10:00:00Z')],
      upcoming: (id) => (id === 'cc' ? cc : undefined),
      mine: { sounds: toShares({ dubstep: 0.5, riddim: 0.3, 'melodic-bass': 0.2 }), going: ['cc'] },
      blocked: new Set(),
      now,
    });
    expect(items.map((i) => i.id)).toEqual(['moment:new', 'going:maya:cc', 'match:maya']);
    expect(items.map((i) => activityText(i, (id) => (id === 'subtronics' ? 'SUBTRONICS' : undefined)))).toEqual([
      'Sam shared a moment of SUBTRONICS',
      'Maya is going to Cyclops Cove 4',
      'You and Maya have a 100% taste match',
    ]);
  });

  it('leaves out people you blocked', () => {
    const items = friendActivity({ profiles: [maya], memories: [], upcoming: () => cc, mine: { sounds: [], going: [] }, blocked: new Set(['maya']), now });
    expect(items).toEqual([]);
  });

  it('says how long ago', () => {
    expect(shortAgo(now - 30_000, now)).toBe('Just now');
    expect(shortAgo(now - 12 * 60_000, now)).toBe('12 min ago');
    expect(shortAgo(now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(shortAgo(now - 30 * 3_600_000, now)).toBe('Yesterday');
    expect(shortAgo(now - 4 * 86_400_000, now)).toBe('4 days ago');
  });
});
