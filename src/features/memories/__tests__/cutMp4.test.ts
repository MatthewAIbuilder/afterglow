import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { cutMp4, CutError, type CutResult } from '../cutMp4';
import { cutVideoPart } from '../cutPart.web';

// Eight seconds of a test pattern from ffmpeg, as a phone writes it: a MOV with the movie header at the end,
// H.264 with B-frames and a keyframe every half second, AAC sound, and a third (subtitle) track.
const SOURCE = new Uint8Array(readFileSync(join(__dirname, 'fixtures', 'eight-seconds.mov')));
const reader = (bytes: Uint8Array) => async (offset: number, length: number) => bytes.slice(offset, offset + length);
const joined = (r: CutResult, from: Uint8Array) => {
  const out = new Uint8Array(r.size);
  let at = 0;
  for (const p of r.pieces) {
    const b = p instanceof Uint8Array ? p : from.subarray(p.offset, p.offset + p.size);
    out.set(b, at);
    at += b.length;
  }
  expect(at).toBe(r.size);
  return out;
};
const fourccs = (b: Uint8Array) => {
  const out: string[] = [];
  let at = 0;
  while (at + 8 <= b.length) {
    const size = ((b[at] << 24) >>> 0) + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3];
    out.push(String.fromCharCode(b[at + 4], b[at + 5], b[at + 6], b[at + 7]));
    at += size === 1 ? Number(new DataView(b.buffer, b.byteOffset + at + 8, 8).getBigUint64(0)) : size;
  }
  return out;
};
const count = (b: Uint8Array, type: string) => {
  let n = 0;
  for (let i = 0; i + 4 <= b.length; i++) if (String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]) === type) n++;
  return n;
};

describe('cutting a part out of a video', () => {
  it('starts at the keyframe before the part, keeps picture and sound, and is far smaller', async () => {
    const r = await cutMp4(reader(SOURCE), SOURCE.length, 3.2, 5.2);
    // Keyframes every half second: 3.0 is the one before 3.2.
    expect(r.from).toBeCloseTo(3, 1);
    expect(r.size).toBeLessThan(SOURCE.length * 0.6);
    const out = joined(r, SOURCE);
    // The header first (so it plays as it downloads), then the samples.
    expect(fourccs(out)).toEqual(['ftyp', 'moov', 'mdat']);
    expect(count(out, 'trak')).toBe(2);
    expect(count(out, 'avc1')).toBe(1);
    expect(count(out, 'mp4a')).toBeGreaterThan(0);
    // Nothing else of the phone's comes along.
    expect(count(out, 'tx3g')).toBe(0);
    expect(count(out, 'udta')).toBe(0);
  });

  it('the cut file can be cut again (its tables are whole), and the same part comes out', async () => {
    const first = joined(await cutMp4(reader(SOURCE), SOURCE.length, 2, 6), SOURCE);
    const again = await cutMp4(reader(first), first.length, 0, 4);
    expect(again.from).toBeCloseTo(0, 2);
    const twice = joined(again, first);
    expect(twice.length).toBe(first.length);
  });

  it('the very start and the very end', async () => {
    const start = await cutMp4(reader(SOURCE), SOURCE.length, 0, 2);
    expect(start.from).toBe(0);
    const end = await cutMp4(reader(SOURCE), SOURCE.length, 6, 8);
    expect(end.from).toBeCloseTo(6, 1);
    expect(fourccs(joined(end, SOURCE))).toEqual(['ftyp', 'moov', 'mdat']);
  });

  it('reads the header and the part, never the rest of the file', async () => {
    let read = 0;
    const counting = async (offset: number, length: number) => {
      read += length;
      return SOURCE.slice(offset, offset + length);
    };
    const r = await cutMp4(counting, SOURCE.length, 3, 4);
    // Only the boxes' headers, ftyp and moov are read; the samples come as ranges of the original.
    expect(read).toBeLessThan(SOURCE.length * 0.3);
    expect(r.pieces.some((p) => !(p instanceof Uint8Array))).toBe(true);
  });

  it('says so when it isn’t a video it can cut', async () => {
    const junk = new Uint8Array(64).fill(7);
    await expect(cutMp4(reader(junk), junk.length, 0, 1)).rejects.toBeInstanceOf(CutError);
    await expect(cutMp4(reader(SOURCE), SOURCE.length, 4, 4)).rejects.toBeInstanceOf(CutError);
    // A file cut off before its movie header (still uploading, say).
    const short = SOURCE.slice(0, SOURCE.length - 500);
    await expect(cutMp4(reader(short), short.length, 0, 1)).rejects.toBeInstanceOf(Error);
  });
});

describe('on the website', () => {
  it('the part becomes a file of its own, joined from pieces of the chosen one, with the window moved to match', async () => {
    const video = new Blob([SOURCE], { type: 'video/quicktime' });
    const r = await cutVideoPart(video, { start: 3.2, end: 5.2 });
    expect(r).toBeDefined();
    expect(r!.blob.type).toBe('video/quicktime');
    expect(r!.blob.size).toBeLessThan(SOURCE.length * 0.6);
    // The cut starts at the keyframe at 3 s, so the part plays from 0.2 s in it, still two seconds long.
    expect(r!.clip.start).toBeCloseTo(0.2, 1);
    expect(r!.clip.end - r!.clip.start).toBeCloseTo(2, 2);
    const bytes = new Uint8Array(await r!.blob.arrayBuffer());
    expect(fourccs(bytes)).toEqual(['ftyp', 'moov', 'mdat']);
  });

  it('a file it can’t cut is shared whole instead', async () => {
    expect(await cutVideoPart(new Blob([new Uint8Array(64)]), { start: 0, end: 2 })).toBeUndefined();
  });
});
