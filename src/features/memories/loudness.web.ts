/**
 * How loud a video is over time, on the website: its sound decoded in the
 * page (nothing is uploaded) and measured in half-second slices. Only for
 * videos up to LOUDNESS_MAX_SEC, so a long one doesn't fill an iPhone's
 * memory; anything that can't be read gives undefined and the suggestion
 * starts at the beginning instead.
 */
export const LOUDNESS_MAX_SEC = 240;
/** Nor for a file bigger than this (a few minutes of 4K would be read whole into memory). */
export const LOUDNESS_MAX_BYTES = 300 * 1024 * 1024;
const SLICE_SEC = 0.5;

type AudioCtx = { decodeAudioData(b: ArrayBuffer): Promise<{ sampleRate: number; numberOfChannels: number; length: number; getChannelData(i: number): Float32Array }>; close(): Promise<void> };

export async function loudnessOf(uri: string, durationSec: number, bytes?: number): Promise<number[] | undefined> {
  if (!(durationSec > 0) || durationSec > LOUDNESS_MAX_SEC || (bytes !== undefined && bytes > LOUDNESS_MAX_BYTES) || typeof window === 'undefined') return undefined;
  const Ctor = (window as unknown as { AudioContext?: new () => AudioCtx; webkitAudioContext?: new () => AudioCtx }).AudioContext ?? (window as unknown as { webkitAudioContext?: new () => AudioCtx }).webkitAudioContext;
  if (!Ctor) return undefined;
  let ctx: AudioCtx | undefined;
  try {
    const bytes = await (await fetch(uri)).arrayBuffer();
    ctx = new Ctor();
    const audio = await ctx.decodeAudioData(bytes);
    const per = Math.max(1, Math.round(audio.sampleRate * SLICE_SEC));
    const slices = Math.ceil(audio.length / per);
    const out = new Array<number>(slices).fill(0);
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const data = audio.getChannelData(c);
      // Every 8th sample is plenty for loudness, and quick.
      for (let i = 0; i < data.length; i += 8) out[Math.floor(i / per)] += data[i] * data[i];
    }
    return out.map((sum) => Math.sqrt(sum / (per / 8) / audio.numberOfChannels));
  } catch {
    return undefined;
  } finally {
    void ctx?.close().catch(() => {});
  }
}
