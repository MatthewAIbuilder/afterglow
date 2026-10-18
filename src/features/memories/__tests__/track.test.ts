import { describe, expect, it } from '@jest/globals';
import { normalize } from '../../festivals/search';
import { cleanMemories, tagMemory } from '../store';
import { cleanTrack, readTrackSearch, sameTrack, trackArtistOn, trackFields, trackFromFields, TRACK_TEXT_MAX } from '../track';
import { communityClip } from '../../community/clips';

const RUMBLE = { title: 'Rumble', artist: 'Skrillex, Fred again.. & Flowdan', appleMusicUrl: 'https://music.apple.com/us/album/rumble/1?i=2' };

describe('a track', () => {
  it('needs a title and an artist; a link only to Apple Music', () => {
    expect(cleanTrack(RUMBLE)).toEqual(RUMBLE);
    expect(cleanTrack({ title: '  Rumble ', artist: 'Skrillex\\n' })).toEqual({ title: 'Rumble', artist: 'Skrillex\\n' });
    expect(cleanTrack({ title: 'Rumble', artist: 'Skrillex', appleMusicUrl: 'https://evil.example/x' })).toEqual({ title: 'Rumble', artist: 'Skrillex' });
    expect(cleanTrack({ title: '', artist: 'Skrillex' })).toBeUndefined();
    expect(cleanTrack(null)).toBeUndefined();
    expect(cleanTrack({ title: 'x'.repeat(500), artist: 'a' })?.title).toHaveLength(TRACK_TEXT_MAX);
  });

  it('what Shazam answered', () => {
    expect(readTrackSearch({ status: 'match', ...RUMBLE })).toEqual({ found: RUMBLE });
    expect(readTrackSearch({ status: 'match', title: 'Rumble' })).toEqual({ reason: 'none' });
    expect(readTrackSearch({ status: 'none' })).toEqual({ reason: 'none' });
    expect(readTrackSearch({ status: 'unsupported' })).toEqual({ reason: 'unsupported' });
    expect(readTrackSearch({ status: 'failed', reason: 'x' })).toEqual({ reason: 'failed' });
    expect(readTrackSearch(undefined)).toEqual({ reason: 'failed' });
  });

  it('kept in the database as three fields, and read back', () => {
    expect(trackFields(RUMBLE)).toEqual({ trackTitle: 'Rumble', trackArtist: RUMBLE.artist, trackUrl: RUMBLE.appleMusicUrl });
    expect(trackFields(undefined)).toEqual({});
    expect(trackFromFields(trackFields(RUMBLE))).toEqual(RUMBLE);
    expect(sameTrack(RUMBLE, { title: 'rumble', artist: RUMBLE.artist.toUpperCase() })).toBe(true);
  });

  it('the song’s artist on Afterglow, from a collaboration', () => {
    const artists = [
      { id: 'fred', name: 'Fred again..' },
      { id: 'skrillex', name: 'SKRILLEX' },
    ];
    expect(trackArtistOn(RUMBLE, artists, normalize)?.id).toBe('skrillex');
    expect(trackArtistOn({ title: 'x', artist: 'Fred again.. feat. Someone' }, artists, normalize)?.id).toBe('fred');
    expect(trackArtistOn({ title: 'x', artist: 'Nobody' }, artists, normalize)).toBeUndefined();
  });

  it('stays with the memory on the phone, and changes only when the tags say', () => {
    const [m] = cleanMemories([{ id: 'm1', file: 'm1.mov', capturedAt: '2026-11-07T22:00:00.000Z', track: RUMBLE }]);
    expect(m.track).toEqual(RUMBLE);
    expect(tagMemory([m], 'm1', { artistId: 'subtronics' })[0].track).toEqual(RUMBLE);
    expect(tagMemory([m], 'm1', { artistId: 'subtronics', track: undefined })[0].track).toBeUndefined();
    expect(cleanMemories([{ id: 'm2', file: 'm2.mov', capturedAt: '2026-11-07T22:00:00.000Z', track: { title: '' } }])[0].track).toBeUndefined();
  });

  it('goes with a shared video into Discover', () => {
    const clip = communityClip(
      { id: 's1', uid: 'u1', handle: 'sam', videoUrl: 'https://x/v.mp4', artistId: 'subtronics', festivalId: 'edc-orlando-26', capturedAt: '2026-11-07T22:00:00.000Z', createdAt: '2026-11-07T23:00:00.000Z', track: RUMBLE },
      new Set(['subtronics']),
    );
    expect(clip?.source).toMatchObject({ provider: 'community', track: RUMBLE });
  });
});
