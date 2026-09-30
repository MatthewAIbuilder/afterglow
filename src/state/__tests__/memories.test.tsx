import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { useEffect } from 'react';
import type { MemoryFiles, PickedVideo } from '../../features/memories/device';
import { MEMORIES_STORAGE_KEY, MemoriesProvider, useMemories } from '../memories';

/** Keeping, tagging and deleting memories, with an in-memory folder standing in for the phone's. */
function fakeFiles(start: string[] = []) {
  const names = new Set(start);
  const files: MemoryFiles & { names: Set<string> } = {
    names,
    keep: jest.fn(async (_src: string, name: string) => {
      names.add(name);
      names.add(name.replace(/\.[^.]+$/, '.jpg'));
      return { thumb: name.replace(/\.[^.]+$/, '.jpg') };
    }),
    remove: jest.fn(async (ns: (string | undefined)[]) => ns.forEach((n) => n && names.delete(n))),
    uriOf: (n) => `file:///docs/memories/${n}`,
    list: () => [...names],
    saveToPhotos: jest.fn(async () => true),
  };
  return files;
}

const latest: { current?: ReturnType<typeof useMemories> } = {};
function Probe() {
  const m = useMemories();
  useEffect(() => {
    latest.current = m;
  });
  return null;
}
const ctx = () => latest.current!;
async function mount(files: MemoryFiles) {
  await render(
    <MemoriesProvider files={files}>
      <Probe />
    </MemoriesProvider>,
  );
  await act(async () => {});
}

const VIDEO: PickedVideo = {
  uri: 'file:///cache/ImagePicker/ABC.MOV',
  source: 'library',
  durationSec: 42,
  width: 1080,
  height: 1920,
  moment: { when: new Date('2026-06-20T04:30:00.000Z'), place: { city: 'Orlando', region: 'Florida' } },
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('memories', () => {
  it('keeps a video with its tag, a still, when and where, and saves the list', async () => {
    const files = fakeFiles();
    await mount(files);
    await act(async () => ctx().setDraft(VIDEO));
    let kept: Awaited<ReturnType<ReturnType<typeof useMemories>['keepDraft']>>;
    await act(async () => {
      kept = await ctx().keepDraft({ festivalId: 'solstice-26', night: 'Friday', artistId: 'illenium' });
    });
    expect(kept!).toMatchObject({
      file: expect.stringMatching(/^m[a-z0-9]+\.mov$/),
      thumb: expect.stringMatching(/\.jpg$/),
      capturedAt: '2026-06-20T04:30:00.000Z',
      durationSec: 42,
      place: { city: 'Orlando', region: 'Florida' },
      festivalId: 'solstice-26',
      night: 'Friday',
      artistId: 'illenium',
    });
    expect(ctx().draft).toBeUndefined();
    const saved = JSON.parse((await AsyncStorage.getItem(MEMORIES_STORAGE_KEY))!);
    expect(saved).toHaveLength(1);
    // Only names are stored, never the phone's folder path.
    expect(JSON.stringify(saved)).not.toContain('file://');
  });

  it('keeping twice at once keeps one memory', async () => {
    await mount(fakeFiles());
    await act(async () => ctx().setDraft(VIDEO));
    await act(async () => {
      await Promise.all([ctx().keepDraft({}), ctx().keepDraft({})]);
    });
    expect(ctx().memories).toHaveLength(1);
  });

  it('retags and deletes, removing the files too', async () => {
    const files = fakeFiles();
    await mount(files);
    await act(async () => ctx().setDraft(VIDEO));
    await act(async () => void (await ctx().keepDraft({})));
    const id = ctx().memories[0].id;
    await act(async () => ctx().tag(id, { festivalId: 'solstice-26', night: 'Saturday', artistId: 'levity' }));
    expect(ctx().memories[0]).toMatchObject({ festivalId: 'solstice-26', artistId: 'levity' });
    await act(async () => void (await ctx().remove(id)));
    expect(ctx().memories).toEqual([]);
    expect(files.names.size).toBe(0);
  });

  it('a file that can’t be copied keeps nothing and says so', async () => {
    const files = { ...fakeFiles(), keep: jest.fn(async () => { throw new Error('disk full'); }) };
    await mount(files);
    await act(async () => ctx().setDraft(VIDEO));
    await act(async () => expect(await ctx().keepDraft({})).toBeUndefined());
    expect(ctx().memories).toEqual([]);
    expect(ctx().draft).toBeDefined();
  });

  it('on launch, files no memory points to are tidied, but never when the saved list is damaged', async () => {
    await AsyncStorage.setItem(MEMORIES_STORAGE_KEY, JSON.stringify([{ id: 'a', file: 'a.mp4', thumb: 'a.jpg', capturedAt: '2026-06-20T04:30:00.000Z' }]));
    const tidy = fakeFiles(['a.mp4', 'a.jpg', 'orphan.mp4']);
    await mount(tidy);
    expect([...tidy.names].sort()).toEqual(['a.jpg', 'a.mp4']);
    expect(ctx().memories.map((m) => m.id)).toEqual(['a']);

    await AsyncStorage.setItem(MEMORIES_STORAGE_KEY, JSON.stringify([{ id: 'a', file: 'a.mp4', capturedAt: '2026-06-20T04:30:00.000Z' }, { broken: true }]));
    const damaged = fakeFiles(['a.mp4', 'b.mp4']);
    await mount(damaged);
    expect(damaged.names.size).toBe(2);
  });

  it('saves a copy to Photos on request', async () => {
    const files = fakeFiles();
    await mount(files);
    await act(async () => ctx().setDraft(VIDEO));
    await act(async () => void (await ctx().keepDraft({})));
    await act(async () => expect(await ctx().saveToPhotos(ctx().memories[0].id)).toBe(true));
    expect(files.saveToPhotos).toHaveBeenCalledWith(ctx().memories[0].file);
  });
});
