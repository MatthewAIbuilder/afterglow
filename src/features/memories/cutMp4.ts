/**
 * Cutting a part out of an MP4 or MOV without re-encoding, pure. A phone's
 * video is a list of samples (frames and bits of sound) in one big `mdat`,
 * with a table in `moov` saying where each one is and when it plays. To keep
 * only a part, this reads that table, picks the video's samples from the
 * keyframe at or before the part's start to its end (and the sound alongside),
 * and writes a new, small table pointing at just those, followed by their
 * bytes. Nothing is decoded, so it takes a moment even for a long 4K video,
 * and the picture and sound stay exactly as filmed.
 *
 * It works on any reader (a browser's File in `cutPart.web.ts`, plain bytes in
 * the tests), and hands back the new file as pieces: its own bytes and ranges
 * of the original, so a browser can join them without holding the video in
 * memory. Only the video and sound tracks are kept: the phone's other tracks
 * and its notes about the file (including where it was filmed) are left out.
 */

/** Reads `length` bytes from `offset`. */
export type ReadBytes = (offset: number, length: number) => Promise<Uint8Array>;

/** A piece of the new file: bytes of its own, or a range of the original. */
export type CutPiece = Uint8Array | { offset: number; size: number };

export type CutResult = {
  pieces: CutPiece[];
  /** The new file's size in bytes. */
  size: number;
  /**
   * Where the new file's time 0 is in the original, in seconds (just before the keyframe at or before the
   * asked start): a time t in the original is t − from in the new file.
   */
  from: number;
};

export class CutError extends Error {}

type Box = { type: string; start: number; headerSize: number; size: number };

const fourcc = (b: Uint8Array, at: number) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
const u32 = (b: Uint8Array, at: number) => ((b[at] << 24) >>> 0) + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3];
const i32 = (b: Uint8Array, at: number) => (b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3];
const u64 = (b: Uint8Array, at: number) => u32(b, at) * 2 ** 32 + u32(b, at + 4);

/** The boxes directly inside `b` from `from` to `to`. */
function children(b: Uint8Array, from: number, to: number): Box[] {
  const out: Box[] = [];
  let at = from;
  while (at + 8 <= to) {
    let size = u32(b, at);
    const type = fourcc(b, at + 4);
    let headerSize = 8;
    if (size === 1) {
      size = u64(b, at + 8);
      headerSize = 16;
    } else if (size === 0) size = to - at;
    if (size < headerSize || at + size > to) throw new CutError(`bad box ${type}`);
    out.push({ type, start: at, headerSize, size });
    at += size;
  }
  return out;
}
const child = (b: Uint8Array, parent: Box, type: string) => children(b, parent.start + parent.headerSize, parent.start + parent.size).find((c) => c.type === type);
const bytesOf = (b: Uint8Array, box: Box) => b.subarray(box.start, box.start + box.size);
/** Where a full box's content starts (after its version and flags). */
const body = (box: Box) => box.start + box.headerSize + 4;

/** The top-level boxes of the file, read a header at a time (the `mdat` is skipped, never read). */
async function topLevel(read: ReadBytes, fileSize: number): Promise<Box[]> {
  const out: Box[] = [];
  let at = 0;
  while (at + 8 <= fileSize) {
    const h = await read(at, Math.min(16, fileSize - at));
    let size = u32(h, 0);
    const type = fourcc(h, 4);
    let headerSize = 8;
    if (size === 1) {
      if (h.length < 16) throw new CutError('short header');
      size = u64(h, 8);
      headerSize = 16;
    } else if (size === 0) size = fileSize - at;
    if (size < headerSize) throw new CutError(`bad box ${type}`);
    out.push({ type, start: at, headerSize, size: Math.min(size, fileSize - at) });
    at += size;
  }
  return out;
}

type Track = {
  kind: 'vide' | 'soun';
  timescale: number;
  /** Composition offset the edit list skips (B-frames, or an audio priming delay), in media time. */
  mediaTime: number;
  tkhd: Uint8Array;
  hdlr: Uint8Array;
  mediaHeader: Uint8Array | undefined;
  dinf: Uint8Array | undefined;
  stsd: Uint8Array;
  mdhd: Uint8Array;
  // Per sample, in decode order.
  offsets: number[];
  sizes: number[];
  dts: number[];
  durations: number[];
  ctts: number[] | undefined;
  sync: boolean[] | undefined;
};

/** Expands a run-length table: counts then values. */
function runs(b: Uint8Array, box: Box, signed = false): number[] {
  const n = u32(b, body(box));
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const at = body(box) + 4 + i * 8;
    const count = u32(b, at);
    const value = signed ? i32(b, at + 4) : u32(b, at + 4);
    for (let k = 0; k < count; k++) out.push(value);
  }
  return out;
}

function readTrack(m: Uint8Array, trak: Box): Track | undefined {
  const mdia = child(m, trak, 'mdia');
  const tkhd = child(m, trak, 'tkhd');
  if (!mdia || !tkhd) return undefined;
  const hdlr = child(m, mdia, 'hdlr');
  const mdhd = child(m, mdia, 'mdhd');
  const minf = child(m, mdia, 'minf');
  if (!hdlr || !mdhd || !minf) return undefined;
  const kind = fourcc(m, body(hdlr) + 4);
  if (kind !== 'vide' && kind !== 'soun') return undefined;
  const stbl = child(m, minf, 'stbl');
  if (!stbl) return undefined;
  const stsd = child(m, stbl, 'stsd');
  const stts = child(m, stbl, 'stts');
  const stsz = child(m, stbl, 'stsz');
  const stsc = child(m, stbl, 'stsc');
  const stco = child(m, stbl, 'stco');
  const co64 = child(m, stbl, 'co64');
  if (!stsd || !stts || !stsz || !stsc || (!stco && !co64)) throw new CutError('missing sample table');
  // One kind of sample description only (what phones write); several would need sample_description_index kept.
  if (u32(m, body(stsd)) !== 1) throw new CutError('several sample descriptions');

  const mdhdV = m[mdhd.start + mdhd.headerSize];
  const timescale = mdhdV === 1 ? u32(m, body(mdhd) + 16) : u32(m, body(mdhd) + 8);

  // Sizes.
  const fixed = u32(m, body(stsz));
  const count = u32(m, body(stsz) + 4);
  const sizes: number[] = [];
  for (let i = 0; i < count; i++) sizes.push(fixed || u32(m, body(stsz) + 8 + i * 4));

  // Chunk offsets, then each sample's offset from the sample-to-chunk table.
  const chunkOffsets: number[] = [];
  if (stco) for (let i = 0, n = u32(m, body(stco)); i < n; i++) chunkOffsets.push(u32(m, body(stco) + 4 + i * 4));
  else if (co64) for (let i = 0, n = u32(m, body(co64)); i < n; i++) chunkOffsets.push(u64(m, body(co64) + 4 + i * 8));
  const stscN = u32(m, body(stsc));
  const offsets: number[] = [];
  let sample = 0;
  for (let e = 0; e < stscN && sample < count; e++) {
    const first = u32(m, body(stsc) + 4 + e * 12) - 1;
    const per = u32(m, body(stsc) + 8 + e * 12);
    const last = e + 1 < stscN ? u32(m, body(stsc) + 4 + (e + 1) * 12) - 1 : chunkOffsets.length;
    for (let c = first; c < last && sample < count; c++) {
      let at = chunkOffsets[c];
      for (let k = 0; k < per && sample < count; k++) {
        offsets.push(at);
        at += sizes[sample];
        sample++;
      }
    }
  }
  if (offsets.length !== count) throw new CutError('sample table doesn’t add up');

  const durations = runs(m, stts).slice(0, count);
  if (durations.length !== count) throw new CutError('timing table doesn’t add up');
  const dts: number[] = [];
  let tm = 0;
  for (const d of durations) {
    dts.push(tm);
    tm += d;
  }
  const cttsBox = child(m, stbl, 'ctts');
  const ctts = cttsBox ? runs(m, cttsBox, true).slice(0, count) : undefined;
  const stss = child(m, stbl, 'stss');
  let sync: boolean[] | undefined;
  if (stss) {
    sync = new Array(count).fill(false);
    for (let i = 0, n = u32(m, body(stss)); i < n; i++) {
      const s = u32(m, body(stss) + 4 + i * 4) - 1;
      if (s >= 0 && s < count) sync[s] = true;
    }
  }

  // The edit list's start in the media (the first edit that isn't empty), when there is one.
  let mediaTime = 0;
  const edts = child(m, trak, 'edts');
  const elst = edts ? child(m, edts, 'elst') : undefined;
  if (elst) {
    const v = m[elst.start + elst.headerSize];
    const n = u32(m, body(elst));
    for (let i = 0; i < n; i++) {
      const at = body(elst) + 4 + i * (v === 1 ? 20 : 12);
      const t = v === 1 ? u64(m, at + 8) : i32(m, at + 4);
      const empty = v === 1 ? u32(m, at + 8) === 0xffffffff && u32(m, at + 12) === 0xffffffff : t === -1;
      if (!empty) {
        mediaTime = t;
        break;
      }
    }
  }

  const header = ['vmhd', 'smhd'].map((type) => child(m, minf, type)).find(Boolean);
  const dinf = child(m, minf, 'dinf');
  return {
    kind,
    timescale,
    mediaTime,
    tkhd: bytesOf(m, tkhd),
    hdlr: bytesOf(m, hdlr),
    mediaHeader: header ? bytesOf(m, header) : undefined,
    dinf: dinf ? bytesOf(m, dinf) : undefined,
    stsd: bytesOf(m, stsd),
    mdhd: bytesOf(m, mdhd),
    offsets,
    sizes,
    dts,
    durations,
    ctts,
    sync,
  };
}

// Writing.

const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
function be32(n: number) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0);
  return b;
}
function be32s(n: number) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setInt32(0, n);
  return b;
}
function be64(n: number) {
  const b = new Uint8Array(8);
  const v = new DataView(b.buffer);
  v.setUint32(0, Math.floor(n / 2 ** 32));
  v.setUint32(4, n >>> 0);
  return b;
}
const box = (type: string, ...content: Uint8Array[]) => {
  const inner = concat(content);
  return concat([be32(8 + inner.length), ascii(type), inner]);
};
const fullBox = (type: string, version: number, flags: number, ...content: Uint8Array[]) =>
  box(type, Uint8Array.of(version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255), ...content);

/** A copy of a header box (mvhd, tkhd, mdhd) with a new duration, in either version. */
function withDuration(src: Uint8Array, duration: number, at: { v0: number; v1: number }): Uint8Array {
  const out = src.slice();
  const headerSize = u32(src, 0) === 1 ? 16 : 8;
  const v = src[headerSize];
  const pos = headerSize + 4 + (v === 1 ? at.v1 : at.v0);
  if (v === 1) out.set(be64(duration), pos);
  else out.set(be32(Math.min(duration, 0xffffffff)), pos);
  return out;
}
const MVHD_DURATION = { v0: 12, v1: 20 };
const TKHD_DURATION = { v0: 16, v1: 24 };
const MDHD_DURATION = { v0: 12, v1: 20 };

/** Run-length pairs from a list. */
function pairs(values: number[], signed = false): Uint8Array[] {
  const out: Uint8Array[] = [];
  let i = 0;
  while (i < values.length) {
    let n = 1;
    while (i + n < values.length && values[i + n] === values[i]) n++;
    out.push(be32(n), signed ? be32s(values[i]) : be32(values[i]));
    i += n;
  }
  return out;
}

type Kept = { track: Track; from: number; to: number; dataOffset: number };

function trakBox(k: Kept, movieTimescale: number, chunkOffset: number): Uint8Array {
  const { track: tr, from, to } = k;
  const n = to - from;
  const durations = tr.durations.slice(from, to);
  const mediaDuration = durations.reduce((a, b) => a + b, 0);
  const movieDuration = Math.round((Math.max(0, mediaDuration - Math.max(0, tr.mediaTime)) * movieTimescale) / tr.timescale);
  const sizes = tr.sizes.slice(from, to);
  const stbl = [
    tr.stsd,
    fullBox('stts', 0, 0, be32(pairs(durations).length / 2), ...pairs(durations)),
  ];
  if (tr.ctts) {
    const offs = tr.ctts.slice(from, to);
    const negative = offs.some((o) => o < 0);
    stbl.push(fullBox('ctts', negative ? 1 : 0, 0, be32(pairs(offs, true).length / 2), ...pairs(offs, true)));
  }
  if (tr.sync) {
    const idx: number[] = [];
    for (let i = from; i < to; i++) if (tr.sync[i]) idx.push(i - from + 1);
    stbl.push(fullBox('stss', 0, 0, be32(idx.length), ...idx.map(be32)));
  }
  stbl.push(
    // Every kept sample in one chunk, one after another.
    fullBox('stsc', 0, 0, be32(1), be32(1), be32(n), be32(1)),
    fullBox('stsz', 0, 0, be32(0), be32(n), ...sizes.map(be32)),
    fullBox('co64', 0, 0, be32(1), be64(chunkOffset)),
  );
  const minf = box('minf', ...(tr.mediaHeader ? [tr.mediaHeader] : []), tr.dinf ?? box('dinf', fullBox('dref', 0, 0, be32(1), fullBox('url ', 0, 1))), box('stbl', ...stbl));
  const mdia = box('mdia', withDuration(tr.mdhd, mediaDuration, MDHD_DURATION), tr.hdlr, minf);
  const edts = box('edts', fullBox('elst', 1, 0, be32(1), be64(movieDuration), be64(Math.max(0, tr.mediaTime)), be32(0x00010000)));
  return box('trak', withDuration(tr.tkhd, movieDuration, TKHD_DURATION), edts, mdia);
}

/** Video plays from (dts + composition offset − the edit's start) / timescale, in seconds. */
const shownAt = (tr: Track, i: number) => (tr.dts[i] + (tr.ctts?.[i] ?? 0) - tr.mediaTime) / tr.timescale;

/**
 * The part from `start` to `end` seconds as a new file. The video starts at the
 * keyframe at or before `start` (`from` says where that is), and runs a little
 * past `end` so the last frames are whole; the sound follows the video.
 */
export async function cutMp4(read: ReadBytes, fileSize: number, start: number, end: number): Promise<CutResult> {
  if (!(end > start) || !(fileSize > 0)) throw new CutError('nothing to keep');
  const top = await topLevel(read, fileSize);
  const ftypBox = top.find((b) => b.type === 'ftyp');
  const moovBox = top.find((b) => b.type === 'moov');
  if (!moovBox) throw new CutError('no movie header');
  if (moovBox.size > 64 * 1024 * 1024) throw new CutError('movie header too big');
  const ftyp = ftypBox ? await read(ftypBox.start, ftypBox.size) : undefined;
  const m = await read(moovBox.start, moovBox.size);
  const moov: Box = { type: 'moov', start: 0, headerSize: moovBox.headerSize, size: moovBox.size };
  const mvhd = child(m, moov, 'mvhd');
  if (!mvhd) throw new CutError('no movie header');
  const mvhdV = m[mvhd.start + mvhd.headerSize];
  const movieTimescale = mvhdV === 1 ? u32(m, body(mvhd) + 16) : u32(m, body(mvhd) + 8);
  if (children(m, moov.headerSize, moov.size).some((b) => b.type === 'mvex')) throw new CutError('fragmented');

  const tracks = children(m, moov.headerSize, moov.size)
    .filter((b) => b.type === 'trak')
    .map((b) => readTrack(m, b))
    .filter((tr): tr is Track => !!tr && tr.sizes.length > 0);
  const video = tracks.find((tr) => tr.kind === 'vide');
  if (!video) throw new CutError('no video');

  // The video: from the last keyframe shown at or before the start, to the first sample shown after the end (a second's margin).
  const count = video.sizes.length;
  const isKey = (i: number) => !video.sync || video.sync[i];
  let from = 0;
  for (let i = 0; i < count; i++) if (isKey(i) && shownAt(video, i) <= start + 1e-6) from = i;
  let to = count;
  for (let i = from; i < count; i++) {
    if (video.dts[i] / video.timescale - video.mediaTime / video.timescale > end + 1) {
      to = i;
      break;
    }
  }
  const startDecode = video.dts[from] / video.timescale;
  const endDecode = (video.dts[to - 1] + video.durations[to - 1]) / video.timescale;

  const kept: Kept[] = [{ track: video, from, to, dataOffset: 0 }];
  // Each sound track: the samples decoded over the same stretch as the video.
  for (const tr of tracks) {
    if (tr.kind !== 'soun') continue;
    let a = tr.dts.findIndex((d) => d / tr.timescale >= startDecode - 1e-6);
    if (a < 0) continue;
    let b = tr.dts.findIndex((d) => d / tr.timescale >= endDecode - 1e-6);
    if (b < 0) b = tr.sizes.length;
    if (b <= a) continue;
    a = Math.max(0, a);
    kept.push({ track: tr, from: a, to: b, dataOffset: 0 });
  }

  // Lay out: ftyp, moov, then one mdat with each track's samples in turn. The moov's size doesn't depend on the
  // offsets (co64 is always 8 bytes), so it's built once to measure, then again with the real offsets.
  const dataSizes = kept.map((k) => k.track.sizes.slice(k.from, k.to).reduce((x, y) => x + y, 0));
  const totalData = dataSizes.reduce((x, y) => x + y, 0);
  const mdatHeader = concat([be32(1), ascii('mdat'), be64(16 + totalData)]);
  const movieDurationOf = (k: Kept) => {
    const d = k.track.durations.slice(k.from, k.to).reduce((x, y) => x + y, 0);
    return Math.round((Math.max(0, d - Math.max(0, k.track.mediaTime)) * movieTimescale) / k.track.timescale);
  };
  const longest = Math.max(...kept.map(movieDurationOf));
  const moovWith = (offsets: number[]) => box('moov', withDuration(bytesOf(m, mvhd), longest, MVHD_DURATION), ...kept.map((k, i) => trakBox(k, movieTimescale, offsets[i])));
  const head = (ftyp?.length ?? 0) + moovWith(kept.map(() => 0)).length + mdatHeader.length;
  let at = head;
  const offsets = dataSizes.map((s) => {
    const o = at;
    at += s;
    return o;
  });
  const newMoov = moovWith(offsets);

  // The samples, as ranges of the original (neighbours joined into one).
  const ranges: { offset: number; size: number }[] = [];
  for (const k of kept) {
    for (let i = k.from; i < k.to; i++) {
      const offset = k.track.offsets[i];
      const size = k.track.sizes[i];
      if (offset + size > fileSize) throw new CutError('sample past the end of the file');
      const last = ranges[ranges.length - 1];
      if (last && last.offset + last.size === offset) last.size += size;
      else ranges.push({ offset, size });
    }
  }
  const pieces: CutPiece[] = [...(ftyp ? [ftyp] : []), newMoov, mdatHeader, ...ranges];
  return { pieces, size: head + totalData, from: startDecode };
}
