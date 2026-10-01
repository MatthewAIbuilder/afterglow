import { describe, expect, it } from '@jest/globals';
import { createCatalog, withoutClips } from '../catalog';
import { parseCatalogFile } from '../file';
import { buildCatalog } from '../merge';
import { MOCK_SNAPSHOT } from '../mock';

const withVideo = MOCK_SNAPSHOT.clips.find((c) => c.source?.provider === 'youtube')!;
const videoId = withVideo.source!.provider === 'youtube' ? withVideo.source!.videoId : '';

describe('videos reported as wrong', () => {
  it('reads blockedVideos as ids or YouTube links, quietly leaving out the rest', () => {
    const parsed = parseCatalogFile({
      version: 1,
      artists: [],
      festivals: [],
      clips: [],
      blockedVideos: ['abcdefghijk', 'https://youtu.be/zyxwvutsrqp', 'https://www.youtube.com/watch?v=abcdefghijk', 'not a video', 7],
    });
    expect(parsed.blockedVideos).toEqual(['abcdefghijk', 'zyxwvutsrqp']);
    expect(parsed.problems).toEqual([]);
  });

  it('leaves their clips out of the catalogue, wherever the clip came from', () => {
    const file = parseCatalogFile({ version: 1, mode: 'add', artists: [], festivals: [], clips: [], blockedVideos: [videoId] });
    const built = buildCatalog(MOCK_SNAPSHOT, file);
    expect(built.catalog.clip(withVideo.id)).toBeUndefined();
    expect(built.catalog.clips).toHaveLength(MOCK_SNAPSHOT.clips.filter((c) => c.source?.provider === 'youtube' ? c.source.videoId !== videoId : true).length);
  });

  it('a flagged clip can be left out of a catalogue, which is otherwise unchanged', () => {
    const catalog = createCatalog(MOCK_SNAPSHOT);
    expect(withoutClips(catalog, new Set())).toBe(catalog);
    expect(withoutClips(catalog, new Set(['not-a-clip']))).toBe(catalog);
    const shown = withoutClips(catalog, new Set([withVideo.id]));
    expect(shown.clip(withVideo.id)).toBeUndefined();
    expect(shown.clipsOf(withVideo.artistId).map((c) => c.id)).not.toContain(withVideo.id);
    expect(shown.festivals).toEqual(catalog.festivals);
  });
});
