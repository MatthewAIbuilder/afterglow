/**
 * Sound for YouTube clips on the website. Pure. Browsers only let a video
 * start with sound once you've interacted with the page, and refuse quietly
 * otherwise, so the player has to tell a refusal apart from a video that's
 * just slow to load (which used to start muted by mistake).
 */

/** YouTube's player states, as its page reports them. */
export const YT_STATE = { unstarted: -1, ended: 0, playing: 1, paused: 2, buffering: 3, cued: 5 } as const;

/** How long a play gets before its state is checked. */
export const AUTOPLAY_GRACE_MS = 1200;
/** How often it's checked after that. */
export const AUTOPLAY_CHECK_MS = 400;
/** A video still loading after this long is a slow connection, not a refusal: leave it be. */
export const BUFFER_PATIENCE_MS = 10000;
/** A play the player hasn't answered yet (or still calls unstarted) gets this long before it counts as refused. */
export const UNSTARTED_PATIENCE_MS = 3000;

export type AutoplayVerdict = 'started' | 'loading' | 'refused' | 'give-up';

/**
 * Where a play stands, from the last state the player reported and how long
 * ago it was asked to play: playing (or looped round) is started; still
 * loading waits (up to `BUFFER_PATIENCE_MS`, then it's left alone); no
 * answer yet, or still unstarted, waits up to `UNSTARTED_PATIENCE_MS`; cued,
 * or paused by the browser, is a refusal.
 */
export function autoplayVerdict(lastState: number | undefined, waitedMs: number): AutoplayVerdict {
  if (lastState === YT_STATE.playing || lastState === YT_STATE.ended) return 'started';
  if (lastState === YT_STATE.buffering) return waitedMs < BUFFER_PATIENCE_MS ? 'loading' : 'give-up';
  if (lastState === undefined || lastState === YT_STATE.unstarted) return waitedMs < UNSTARTED_PATIENCE_MS ? 'loading' : 'refused';
  return 'refused';
}

/**
 * Whether the browser refused sound since you last touched the page. While
 * it has, the next clips start muted straight away instead of sitting silent
 * for a moment first; a tap or key press anywhere lets the next one try with
 * sound again.
 */
export type SoundMemory = { refused: boolean };

export const afterRefusal = (): SoundMemory => ({ refused: true });
export const afterGesture = (): SoundMemory => ({ refused: false });
export const startMuted = (m: SoundMemory) => m.refused;
