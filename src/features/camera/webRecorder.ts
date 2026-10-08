/**
 * Filming in a browser, the pure parts. The website's camera records with the
 * browser's own recorder (MediaRecorder) into an MP4, the one kind every
 * phone plays back and the only kind a share to Discover takes (WebM, which
 * some browsers prefer, can't be shared), so the formats are tried in order.
 */

/** Recording formats, best first. Safari records `video/mp4`; newer Chrome and Firefox too, with H.264 named. */
export const RECORD_TYPES = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4'] as const;

/** The first format this browser can record, or undefined when it can't record an MP4 at all. */
export function recordType(supported: (type: string) => boolean): string | undefined {
  for (const type of RECORD_TYPES) {
    try {
      if (supported(type)) return type;
    } catch {
      // A browser that throws on the question can't answer it.
    }
  }
  return undefined;
}

/** The file's type without its codecs (what storage and the players go by). */
export const baseType = (type: string) => type.split(';')[0].trim() || 'video/mp4';

/** Quality to record at: good on a phone, still small enough that a minute fits a share (about 45 MB). */
export const RECORD_BITS_PER_SEC = 6_000_000;

/** What the browser's camera is asked for: the back camera (or the front), sharp but not 4K, with sound. */
export function cameraAsk(facing: 'back' | 'front', withSound: boolean) {
  return {
    video: { facingMode: { ideal: facing === 'back' ? 'environment' : 'user' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: withSound,
  };
}

/** Why the camera isn't showing, from what the browser said. */
export type CameraProblem = 'unsupported' | 'denied' | 'failed';
export function cameraProblem(error: unknown): CameraProblem {
  const name = (error as { name?: string } | undefined)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotSupportedError') return 'unsupported';
  return 'failed';
}
