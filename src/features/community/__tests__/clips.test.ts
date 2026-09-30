import { describe, expect, it } from '@jest/globals';
import { computeTaste } from '../../taste/engine';
import { CLIPS } from '../../../data/mock/clips';
import { MOCK_CATALOG, MOCK_TASTE } from '../../../data/mock';
import type { SharedMemory } from '../../social/models';
import { ARTIST_MEMORY_MAX, cleanKept, COMMUNITY_MAX, keepClip, KEPT_MAX, keptClips, communityClip, communityClipId, communityClips, isCommunityClip, rememberArtist, rememberedClips } from '../clips';

const ARTISTS = new Set(['illenium', 'subtronics', 'seven-lions']);
const NONE = new Set<string>();

const memory = (over: Partial<SharedMemory> = {}): SharedMemory => ({
  id: 's1',
  uid: 'u1',
  handle: 'maya',
  videoUrl: 'https://example.test/v.mp4',
  thumbUrl: 'https://example.test/v.jpg',
  festivalId: 'solstice-26',
  artistId: 'illenium',
  capturedAt: '2026-06-20T23:00:00.000Z',
  durationSec: 42.4,
  createdAt: '2026-06-21T10:00:00.000Z',
  ...over,
});

describe('communityClip', () => {
  it('turns a shared memory into a feed clip credited to who filmed it', () => {
    const c = communityClip(memory({ width: 1080, height: 1920 }), ARTISTS)!;
    expect(c).toMatchObject({ id: 'community:s1', artistId: 'illenium', festivalId: 'solstice-26', durationSec: 42, title: 'From the crowd' });
    expect(c.source).toMatchObject({ provider: 'community', handle: 'maya', uid: 'u1', sharedId: 's1', vertical: true });
    expect(isCommunityClip(c)).toBe(true);
    expect(communityClipId('s1')).toBe(c.id);
  });

  it('knows landscape footage by its size, and assumes upright without one', () => {
    expect(communityClip(memory({ width: 1920, height: 1080 }), ARTISTS)!.source).toMatchObject({ vertical: false });
    expect(communityClip(memory(), ARTISTS)!.source).toMatchObject({ vertical: true });
  });

  it('keeps lengths sensible and drops a still that isn’t https', () => {
    expect(communityClip(memory({ durationSec: undefined }), ARTISTS)!.durationSec).toBe(30);
    expect(communityClip(memory({ durationSec: 900 }), ARTISTS)!.durationSec).toBe(180);
    expect(communityClip(memory({ thumbUrl: 'http://x/y.jpg' }), ARTISTS)!.source).toMatchObject({ thumbUrl: undefined });
  });

  it('needs an artist Afterglow knows, a festival, an https video and a handle', () => {
    expect(communityClip(memory({ artistId: undefined }), ARTISTS)).toBeUndefined();
    expect(communityClip(memory({ artistId: 'someone-new' }), ARTISTS)).toBeUndefined();
    expect(communityClip(memory({ festivalId: undefined }), ARTISTS)).toBeUndefined();
    expect(communityClip(memory({ videoUrl: 'http://example.test/v.mp4' }), ARTISTS)).toBeUndefined();
    expect(communityClip(memory({ handle: '' }), ARTISTS)).toBeUndefined();
  });
});

describe('communityClips', () => {
  const solstice = MOCK_CATALOG.festival('solstice-26')!;

  it('newest first, one each, never from someone blocked or a video hidden', () => {
    const list = [
      memory({ id: 'old', createdAt: '2026-06-20T00:00:00.000Z' }),
      memory({ id: 'new', createdAt: '2026-06-22T00:00:00.000Z' }),
      memory({ id: 'new', createdAt: '2026-06-22T00:00:00.000Z' }),
      memory({ id: 'blocked', uid: 'u2', createdAt: '2026-06-23T00:00:00.000Z' }),
      memory({ id: 'hidden', createdAt: '2026-06-24T00:00:00.000Z' }),
    ];
    const ids = communityClips(list, { artists: ARTISTS, blocked: new Set(['u2']), hidden: new Set(['hidden']) }).map((c) => c.id);
    expect(ids).toEqual(['community:new', 'community:old']);
  });

  it('for a festival: only its own videos, of artists on its lineup', () => {
    const onLineup = solstice.lineup[0];
    const list = [
      memory({ id: 'here', artistId: onLineup }),
      memory({ id: 'elsewhere', festivalId: 'horizon-27', artistId: onLineup }),
      memory({ id: 'not-on-lineup', artistId: 'nobody-here' }),
    ];
    const ids = communityClips(list, { artists: new Set([onLineup, 'nobody-here']), blocked: NONE, hidden: NONE, festival: solstice }).map((c) => c.id);
    expect(ids).toEqual(['community:here']);
  });

  it('never your own', () => {
    expect(communityClips([memory({ uid: 'me' })], { artists: ARTISTS, blocked: NONE, hidden: NONE, me: 'me' })).toEqual([]);
  });

  it('at most COMMUNITY_MAX', () => {
    const many = Array.from({ length: COMMUNITY_MAX + 10 }, (_, i) => memory({ id: `m${i}` }));
    expect(communityClips(many, { artists: ARTISTS, blocked: NONE, hidden: NONE })).toHaveLength(COMMUNITY_MAX);
  });
});

describe('remembering who a community clip was of', () => {
  it('stand-ins only for community clips you reacted to that aren’t loaded', () => {
    const artistOf = { 'community:a': 'illenium', 'community:b': 'subtronics' };
    const out = rememberedClips(['community:a', 'community:b', 'community:c', 'c1'], artistOf, new Set(['community:b']));
    expect(out.map((c) => [c.id, c.artistId])).toEqual([['community:a', 'illenium']]);
  });

  it('bounded, keeping the newest', () => {
    let m: Record<string, string> = {};
    for (let i = 0; i < ARTIST_MEMORY_MAX + 5; i++) m = rememberArtist(m, `community:${i}`, 'illenium');
    expect(Object.keys(m)).toHaveLength(ARTIST_MEMORY_MAX);
    expect(m['community:0']).toBeUndefined();
    expect(m[`community:${ARTIST_MEMORY_MAX + 4}`]).toBe('illenium');
    expect(rememberArtist(m, `community:${ARTIST_MEMORY_MAX + 4}`, 'illenium')).toBe(m);
  });

  it('a like on a community clip keeps counting for the artist after the clip has gone', () => {
    const clip = communityClip(memory({ artistId: 'subtronics' }), ARTISTS)!;
    const reactions = { [clip.id]: { liked: true, saved: false, skipped: false } };
    const base = computeTaste(MOCK_TASTE, MOCK_CATALOG.artists, CLIPS, {});
    const withClip = computeTaste(MOCK_TASTE, MOCK_CATALOG.artists, [...CLIPS, clip], reactions);
    const gone = computeTaste(MOCK_TASTE, MOCK_CATALOG.artists, [...CLIPS, ...rememberedClips(Object.keys(reactions), { [clip.id]: 'subtronics' }, new Set(CLIPS.map((c) => c.id)))], reactions);
    expect(withClip.taste.subtronics).toBeGreaterThan(base.taste.subtronics);
    expect(gone.taste.subtronics).toBeCloseTo(withClip.taste.subtronics);
  });
});

describe('keeping liked community clips for Your clips', () => {
  const clip = (id: string, over: Partial<SharedMemory> = {}) => communityClip(memory({ id, ...over }), ARTISTS)!;

  it('keeps community clips only, newest last, bounded', () => {
    let kept = {};
    for (let i = 0; i < KEPT_MAX + 3; i++) kept = keepClip(kept, clip(`k${i}`));
    expect(Object.keys(kept)).toHaveLength(KEPT_MAX);
    expect(Object.keys(kept).at(-1)).toBe(`community:k${KEPT_MAX + 2}`);
    expect(keepClip(kept, CLIPS[0])).toBe(kept);
  });

  it('reads back only well-formed clips from storage', () => {
    const good = clip('a');
    const stored = JSON.parse(JSON.stringify({ [good.id]: good, 'community:b': { ...good, id: 'community:b', source: { ...good.source, videoUrl: 'http://x' } }, c1: CLIPS[0], 'community:c': 'nonsense' }));
    expect(Object.keys(cleanKept(stored))).toEqual([good.id]);
    expect(cleanKept(stored)[good.id]).toEqual(good);
    expect(cleanKept(null)).toEqual({});
  });

  it('leaves out anyone you blocked, anything you hid, and artists Afterglow no longer has', () => {
    const kept = { ...keepClip({}, clip('a')), ...keepClip({}, clip('b', { uid: 'u2' })), ...keepClip({}, clip('c')) };
    const shown = keptClips(kept, { artists: ARTISTS, blocked: new Set(['u2']), hidden: new Set(['c']) }).map((c) => c.id);
    expect(shown).toEqual(['community:a']);
    expect(keptClips(kept, { artists: new Set(), blocked: NONE, hidden: NONE })).toEqual([]);
  });
});
