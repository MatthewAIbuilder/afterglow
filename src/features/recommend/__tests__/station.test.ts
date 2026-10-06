import { describe, expect, it } from '@jest/globals';
import type { Artist, Clip } from '../../../data/types';
import type { Reaction } from '../../../state/reactions';
import { soundSimilarity } from '../../taste/similarity';
import {
  addStation,
  cleanStations,
  rankStation,
  RECENT_STATIONS,
  SEED_GAP,
  STATION_CLIPS,
  STATION_MIN,
  stationArtists,
} from '../station';

const NOW = 1_800_000_000_000;
const none: Reaction = { liked: false, saved: false, skipped: false };

const artist = (id: string, sound: Artist['sound']): Artist => ({ id, name: id.toUpperCase(), sound }) as Artist;
const SEED = artist('subtronics', { dubstep: 0.8, riddim: 0.6 });
const ARTISTS: Artist[] = [
  SEED,
  artist('svdden', { dubstep: 0.9, riddim: 0.4 }),
  artist('level-up', { dubstep: 0.7, riddim: 0.7 }),
  artist('kai-wachi', { dubstep: 1 }),
  artist('illenium', { 'melodic-bass': 1 }),
  artist('fisher', { house: 1 }),
];
const clip = (id: string, artistId: string, extra: Partial<Clip> = {}): Clip => ({ id, artistId, festivalId: 'f', title: id, durationSec: 60, ...extra }) as Clip;
const CLIPS: Clip[] = ARTISTS.flatMap((a) => [1, 2, 3, 4].map((n) => clip(`${a.id}-${n}`, a.id)));
const countOf = (clips: Clip[]) => (id: string) => clips.filter((c) => c.artistId === id).length;

function station(reactions: Record<string, Reaction> = {}, taste: Record<string, number> = {}, extra: { seen?: Record<string, number>; keep?: string[]; clips?: Clip[] } = {}) {
  const clips = extra.clips ?? CLIPS;
  const on = stationArtists(SEED, ARTISTS, countOf(clips), soundSimilarity);
  const closeness = Object.fromEntries(on.map((s) => [s.artist.id, s.closeness]));
  return rankStation({
    clips: clips.filter((c) => c.artistId in closeness),
    artists: ARTISTS,
    taste,
    reactions,
    seen: extra.seen ?? {},
    now: NOW,
    keep: extra.keep,
    seedId: SEED.id,
    closeness,
  });
}
const artistsIn = (feed: { clip: Clip }[]) => feed.map((it) => it.clip.artistId);

describe('who is on a station', () => {
  it('is the starting artist and the artists who sound most like them, closest first', () => {
    const on = stationArtists(SEED, ARTISTS, countOf(CLIPS), soundSimilarity);
    expect(on[0]).toEqual({ artist: SEED, closeness: 1 });
    const others = on.slice(1);
    expect(others.map((s) => s.artist.id)).toEqual(expect.arrayContaining(['svdden', 'level-up', 'kai-wachi']));
    expect(others.map((s) => s.artist.id)).not.toContain('fisher');
    for (const s of others) expect(s.closeness).toBeGreaterThanOrEqual(STATION_MIN);
    for (let i = 1; i < others.length; i++) expect(others[i].closeness).toBeLessThanOrEqual(others[i - 1].closeness);
  });

  it('only counts artists with clips, and works for one with none of their own', () => {
    const clips = CLIPS.filter((c) => c.artistId !== 'subtronics' && c.artistId !== 'svdden');
    const on = stationArtists(SEED, ARTISTS, countOf(clips), soundSimilarity);
    expect(on.map((s) => s.artist.id)).not.toContain('subtronics');
    expect(on.map((s) => s.artist.id)).not.toContain('svdden');
    expect(on.length).toBeGreaterThan(0);
  });

  it('widens to the starting sounds when there are too few clips', () => {
    // A seed whose closest artists are all a little too far: only shared sounds bring anyone in.
    const odd = artist('odd', { riddim: 0.3, house: 0.9 });
    const few = [clip('odd-1', 'odd')];
    const all = [...ARTISTS, odd];
    const clips = [...few, ...CLIPS];
    const on = stationArtists(odd, all, countOf(clips), () => 0);
    expect(on[0].artist.id).toBe('odd');
    expect(on.map((s) => s.artist.id)).toContain('fisher');
    expect(on.map((s) => s.artist.id)).not.toContain('svdden');
    // Without widening it would be one clip, below STATION_CLIPS.
    expect(on.reduce((n, s) => n + countOf(clips)(s.artist.id), 0)).toBeGreaterThan(1);
    expect(STATION_CLIPS).toBeGreaterThan(1);
  });
});

describe('a station running order', () => {
  it('has every clip once and opens with the starting artist', () => {
    const feed = station();
    expect(new Set(feed.map((it) => it.clip.id)).size).toBe(feed.length);
    expect(feed[0].clip.artistId).toBe('subtronics');
    expect(feed[0].reason).toEqual({ kind: 'match' });
    expect(feed[1].reason).toEqual({ kind: 'near', artistId: 'subtronics' });
  });

  it('brings the starting artist back early, but never all at once', () => {
    const a = artistsIn(station());
    const seedAt = a.map((id, i) => (id === 'subtronics' ? i : -1)).filter((i) => i >= 0);
    expect(seedAt.length).toBe(4);
    for (let i = 1; i < seedAt.length; i++) expect(seedAt[i] - seedAt[i - 1]).toBeGreaterThanOrEqual(SEED_GAP);
    expect(seedAt[1]).toBeLessThan(a.length / 2);
    for (let i = 1; i < a.length; i++) if (a[i] !== 'subtronics') expect(a[i]).not.toBe(a[i - 1]);
  });

  it('follows your taste: a strong match rises, an artist you skip waits, skipped clips go last', () => {
    const base = artistsIn(station());
    const liked = artistsIn(station({}, { 'kai-wachi': 1, svdden: 0.1, 'level-up': 0.1 }));
    expect(liked.indexOf('kai-wachi')).toBeLessThanOrEqual(base.indexOf('kai-wachi'));
    expect(liked.indexOf('kai-wachi')).toBe(1);

    const skips = { 'svdden-1': { ...none, skipped: true }, 'svdden-2': { ...none, skipped: true } };
    const feed = station(skips);
    const firstSvdden = feed.findIndex((it) => it.clip.artistId === 'svdden');
    const fresh = feed.filter((it) => !it.cooled && !it.skipped).length;
    expect(firstSvdden).toBeGreaterThanOrEqual(fresh);
    expect(feed.slice(-2).map((it) => it.clip.id).sort()).toEqual(['svdden-1', 'svdden-2']);
  });

  it('holds back clips seen lately and keeps what is on screen', () => {
    const seen = { 'subtronics-1': NOW - 1000 };
    expect(station({}, {}, { seen })[0].clip.id).not.toBe('subtronics-1');
    const kept = station({}, {}, { keep: ['level-up-3', 'svdden-2'] });
    expect(kept.slice(0, 2).map((it) => it.clip.id)).toEqual(['level-up-3', 'svdden-2']);
  });

  it('sets SoundCloud cards in for close artists, never side by side', () => {
    const pages = [clip('sc-subtronics', 'subtronics', { source: { provider: 'soundcloud', url: 'https://soundcloud.com/subtronics' } as Clip['source'] })];
    const feed = station({}, {}, { clips: [...CLIPS, ...pages] });
    const at = feed.findIndex((it) => it.clip.id === 'sc-subtronics');
    expect(at).toBeGreaterThan(0);
    expect(feed[at - 1].clip.artistId).not.toBe('subtronics');
  });

  it('is deterministic', () => {
    const r = { 'svdden-1': { ...none, liked: true } };
    expect(station(r).map((it) => it.clip.id)).toEqual(station(r).map((it) => it.clip.id));
  });
});

describe('recent stations', () => {
  it('keeps the last few, newest first, without repeats', () => {
    let list: string[] = [];
    for (const id of ['a', 'b', 'c', 'a', 'd']) list = addStation(list, id);
    expect(list).toEqual(['d', 'a', 'c']);
    expect(list.length).toBe(RECENT_STATIONS);
  });

  it('reads saved lists safely', () => {
    expect(cleanStations(null)).toEqual([]);
    expect(cleanStations(['a', 3, '', 'a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c']);
  });
});
