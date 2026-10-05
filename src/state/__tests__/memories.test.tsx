import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { useEffect } from 'react';
import type { MemoryFiles, PickedVideo } from '../../features/memories/device';
import { newMemoryId } from '../../features/memories/store';
import { MEMORIES_DAMAGED_KEY, MEMORIES_STORAGE_KEY, MemoriesProvider, useMemories } from '../memories';

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

  it('on launch, old files no memory points to are tidied, but never when the saved list is damaged', async () => {
    const old = newMemoryId(Date.now() - 3 * 24 * 3600_000);
    const recent = newMemoryId(Date.now() - 3600_000);
    await AsyncStorage.setItem(MEMORIES_STORAGE_KEY, JSON.stringify([{ id: 'a', file: 'a.mp4', thumb: 'a.jpg', capturedAt: '2026-06-20T04:30:00.000Z' }]));
    // An orphan from days ago goes; one from an hour ago (perhaps being kept right now) and a name that doesn't say when stay.
    const tidy = fakeFiles(['a.mp4', 'a.jpg', `${old}.mov`, `${old}.jpg`, `${recent}.mov`, 'orphan.mp4']);
    await mount(tidy);
    expect([...tidy.names].sort()).toEqual(['a.jpg', 'a.mp4', `${recent}.mov`, 'orphan.mp4'].sort());
    expect(ctx().memories.map((m) => m.id)).toEqual(['a']);

    const damagedList = JSON.stringify([{ id: 'a', file: 'a.mp4', capturedAt: '2026-06-20T04:30:00.000Z' }, { broken: true }]);
    await AsyncStorage.setItem(MEMORIES_STORAGE_KEY, damagedList);
    const damaged = fakeFiles(['a.mp4', `${old}.mov`]);
    await mount(damaged);
    expect(damaged.names.size).toBe(2);
    // The damaged list is kept aside as it was, and from then on nothing is tidied, even once the list reads back whole.
    expect(await AsyncStorage.getItem(MEMORIES_DAMAGED_KEY)).toBe(damagedList);
    await act(async () => ctx().tag('a', { festivalId: 'solstice-26' }));
    const after = fakeFiles(['a.mp4', `${old}.mov`]);
    await mount(after);
    expect(after.names.size).toBe(2);
  });

  it('a list that couldn’t be read is never written over, and is read again later', async () => {
    jest.useFakeTimers();
    try {
      await AsyncStorage.setItem(MEMORIES_STORAGE_KEY, JSON.stringify([{ id: 'a', file: 'a.mp4', capturedAt: '2026-06-20T04:30:00.000Z' }]));
      // (The storage mock's getItem is itself a mock: only this one call fails.)
      jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('busy'));
      const files = fakeFiles(['a.mp4']);
      await mount(files);
      expect(ctx().hydrated).toBe(false);
      // A video kept meanwhile is shown, but the saved list isn't replaced by it.
      await act(async () => void (await ctx().keepNow(VIDEO)));
      expect(ctx().memories).toHaveLength(1);
      expect(JSON.parse((await AsyncStorage.getItem(MEMORIES_STORAGE_KEY))!).map((m: { id: string }) => m.id)).toEqual(['a']);
      // Read again a little later: both are there, and now saved together. Nothing was tidied away.
      await act(async () => {
        jest.advanceTimersByTime(3_000);
      });
      await act(async () => {});
      expect(ctx().hydrated).toBe(true);
      expect(ctx().memories).toHaveLength(2);
      const saved = JSON.parse((await AsyncStorage.getItem(MEMORIES_STORAGE_KEY))!);
      expect(saved.map((m: { id: string }) => m.id)).toContain('a');
      expect(saved).toHaveLength(2);
      expect(files.names.has('a.mp4')).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps a fresh recording straight away, untagged, and remembers what was deleted', async () => {
    const files = fakeFiles();
    await mount(files);
    let kept: Awaited<ReturnType<ReturnType<typeof useMemories>['keepNow']>>;
    await act(async () => {
      kept = await ctx().keepNow({ ...VIDEO, source: 'camera' });
    });
    expect(kept!).toMatchObject({ durationSec: 42, festivalId: undefined, artistId: undefined });
    expect(JSON.parse((await AsyncStorage.getItem(MEMORIES_STORAGE_KEY))!)).toHaveLength(1);
    expect(ctx().wasRemoved(kept!.id)).toBe(false);
    await act(async () => void (await ctx().remove(kept!.id)));
    expect(ctx().wasRemoved(kept!.id)).toBe(true);
    expect(files.names.size).toBe(0);
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
