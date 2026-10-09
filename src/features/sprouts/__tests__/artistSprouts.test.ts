import { describe, expect, it } from '@jest/globals';
import { ALL_LOOKS, artistLook, foldName, mix } from '../artistLook';
import { DRAW } from '../creatures';
import { artistGardenLine, artistSprouts, cleanShown, newArtistSprouts, shownMark, sinceGiven, tierFor, tierLabel, tierLine, toNextTier, withPosted } from '../artistSprouts';
import { artistsGivenAt } from '../outbox';
import { aSprout, cleanSproutArtist, giftTitle, readSproutLink, sproutLink, sproutName } from '../sprouts';

const at = (d: number) => new Date(2026, 9, d).toISOString();

describe('artist collectible looks', () => {
  it('gives the big names their hand-made creature, by name', () => {
    expect(artistLook({ id: 'subtronics', name: 'SUBTRONICS' })).toMatchObject({ signature: true, creature: 'eye', name: 'The Watcher', theme: 'A big eye with wriggling tentacles' });
    expect(artistLook({ id: 'x', name: 'Illenium' })).toMatchObject({ signature: true, creature: 'phoenix' });
    expect(artistLook({ id: 'x', name: 'Seven Lions' }).creature).toBe('lion');
    expect(foldName('RÜFÜS DU SOL')).toBe('rufusdusol');
  });

  it('gives everyone else their sound’s creature in their colour, the same every time', () => {
    const a = { id: 'wooli-x', name: 'Someone New', sound: { riddim: 1 }, color: '#FF0000' };
    const look = artistLook(a);
    expect(look.signature).toBe(false);
    expect(look.creature).toBe('bot');
    expect(look.name).toBe('The Riddim bot');
    // Their colour, lifted a little so it glows on the night tile.
    expect(look.accent).not.toBe(artistLook({ ...a, color: '#0000FF' }).accent);
    expect(look.palette.glow).toBe(look.accent);
    expect(artistLook(a)).toEqual(look);
    expect(artistLook({ id: 'n', name: 'No Tags' }).creature).toBe('wisp');
    expect(artistLook({ id: 'h', name: 'Housey', sound: { house: 0.8, techno: 0.3 } }).creature).toBe('cat');
  });

  it('every creature has a drawing', () => {
    for (const l of ALL_LOOKS) expect(typeof DRAW[l.creature]).toBe('function');
  });

  it('mixes colours', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
});

describe('earning artist sprouts', () => {
  const memories = [
    { artistId: 'subtronics', capturedAt: at(1) },
    { artistId: 'subtronics', capturedAt: at(2) },
    { artistId: 'subtronics', capturedAt: at(3) },
    { artistId: 'illenium', capturedAt: at(4) },
    { capturedAt: at(5) },
    { artistId: 'gone', capturedAt: at(6) },
  ];

  it('gives one per artist filmed, most filmed first, levelled by videos', () => {
    const list = artistSprouts(memories, (id) => id !== 'gone');
    expect(list.map((s) => [s.artistId, s.videos, s.tier])).toEqual([
      ['subtronics', 3, 1],
      ['illenium', 1, 0],
    ]);
    expect(list[0].firstAt).toBe(Date.parse(at(1)));
  });

  it('names the levels and what comes next', () => {
    expect([1, 2, 3, 5, 6, 9, 10, 40].map(tierFor)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(toNextTier(4)).toEqual({ more: 2, tier: 2 });
    expect(toNextTier(12)).toBeUndefined();
    expect(tierLine(1)).toBe('2 more videos of them for bronze');
    expect(tierLine(5)).toBe('1 more video of them for silver');
    expect(tierLine(12)).toBe('Gold: you’ve filmed them 12 times');
    expect(tierLabel({ tier: 1, videos: 4 })).toBe('Bronze · 4 videos');
    expect(tierLabel({ tier: 0, videos: 1 })).toBe('1 video');
    expect(artistGardenLine([])).toMatch(/^Film a set/);
  });

  it('celebrates new sprouts and new levels once', () => {
    const list = artistSprouts(memories);
    expect(newArtistSprouts(list, {}).map((s) => s.artistId)).toEqual(['subtronics', 'gone', 'illenium']);
    const seen = Object.fromEntries(list.map((s) => [s.artistId, shownMark(s)]));
    expect(newArtistSprouts(list, seen)).toEqual([]);
    // Bronze was celebrated; silver is new.
    const more = artistSprouts([...memories, ...[7, 8, 9].map((d) => ({ artistId: 'subtronics', capturedAt: at(d) }))]);
    expect(newArtistSprouts(more, seen).map((s) => [s.artistId, s.tier])).toEqual([['subtronics', 2]]);
    expect(cleanShown({ a: 2, b: 9, c: 'x' })).toEqual({ a: 2 });
  });
});

describe('artist sprout codes', () => {
  it('carry the artist through the link', () => {
    const card = { id: 'abcdefghijkmnpqrstuv', kind: 'seedling' as const, from: 'uid1', handle: 'maya', name: 'Maya', artist: { id: 'subtronics', name: 'SUBTRONICS' } };
    const link = sproutLink(card);
    expect(link).toContain('&a=subtronics&an=SUBTRONICS');
    expect(readSproutLink(link)).toEqual(card);
    expect(sproutName(card)).toBe('SUBTRONICS collectible');
    expect(giftTitle(card)).toBe('Maya gave you a SUBTRONICS collectible');
    expect(aSprout({ kind: 'seedling', artist: { id: 'illenium', name: 'ILLENIUM' } })).toBe('an ILLENIUM collectible');
  });

  it('drop a broken artist', () => {
    expect(cleanSproutArtist({ id: 'Bad Id', name: 'x' })).toBeUndefined();
    // Ids a catalogue file may use.
    expect(cleanSproutArtist({ id: 'DJ_Snake.2', name: 'DJ Snake' })).toEqual({ id: 'DJ_Snake.2', name: 'DJ Snake' });
    expect(cleanSproutArtist({ id: 'ok', name: '  ' })).toBeUndefined();
    expect(readSproutLink('https://afterglowmusic.app/sprout/abcdefghijkmnpqrstuv?u=uid1&h=maya&k=plur&a=Bad%20Id&an=X')?.artist).toBeUndefined();
  });
});

describe('collectibles from videos you posted', () => {
  it('gives each posted artist (and b2b partners) one collectible, without changing ones you filmed', () => {
    const mine = artistSprouts([
      { artistId: 'subtronics', capturedAt: '2026-01-01T00:00:00Z' },
      { artistId: 'subtronics', capturedAt: '2026-01-02T00:00:00Z' },
      { artistId: 'subtronics', capturedAt: '2026-01-03T00:00:00Z' },
    ]);
    const posted = [
      { artistId: 'subtronics', capturedAt: '2025-06-01T00:00:00Z' },
      { artistId: 'rezz', capturedAt: '2025-06-02T00:00:00Z' },
      { artistId: 'rezz', capturedAt: '2025-06-03T00:00:00Z' },
      { artistId: 'layz', withArtistIds: ['kompany'], capturedAt: '2025-06-04T00:00:00Z' },
      { artistId: 'nobody', capturedAt: '2025-06-05T00:00:00Z' },
    ];
    const all = withPosted(mine, posted, (id) => id !== 'nobody');
    expect(all.map((a) => [a.artistId, a.videos, a.tier])).toEqual([
      ['subtronics', 3, 1],
      ['layz', 1, 0],
      ['kompany', 1, 0],
      ['rezz', 1, 0],
    ]);
  });
});

describe('giving your own collectible away', () => {
  it('counts only videos filmed after you last gave it, so filming them again earns it back', () => {
    const memories = [
      { artistId: 'a', capturedAt: at(1) },
      { artistId: 'a', capturedAt: at(2) },
      { artistId: 'b', capturedAt: at(2) },
    ];
    const given = artistsGivenAt([
      { id: 'g1aaaaaaaaaaaaaaaaaa', kind: 'seedling', artist: { id: 'a', name: 'A' }, at: Date.parse(at(3)), sent: true, tries: 0 },
      // Taken back, or one you were given passed on (`via`): neither counts.
      { id: 'g2aaaaaaaaaaaaaaaaaa', kind: 'seedling', artist: { id: 'b', name: 'B' }, at: Date.parse(at(3)), sent: true, tries: 0, takenBack: true },
      { id: 'g3aaaaaaaaaaaaaaaaaa', kind: 'seedling', artist: { id: 'b', name: 'B' }, via: 'x', at: Date.parse(at(3)), sent: true, tries: 0 },
    ]);
    expect(given).toEqual({ a: Date.parse(at(3)) });
    expect(artistSprouts(sinceGiven(memories, given)).map((s) => s.artistId)).toEqual(['b']);
    const again = sinceGiven([...memories, { artistId: 'a', capturedAt: at(4) }], given);
    expect(artistSprouts(again).find((s) => s.artistId === 'a')?.videos).toBe(1);
  });
});
