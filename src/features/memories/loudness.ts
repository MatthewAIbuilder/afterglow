/**
 * How loud a video is over time, for suggesting where to trim it. Only the
 * website reads the sound (loudness.web.ts); the phone's own picker trims a
 * long video before Afterglow sees it, so here there's nothing to read.
 */
export async function loudnessOf(_uri: string, _durationSec: number): Promise<number[] | undefined> {
  return undefined;
}
