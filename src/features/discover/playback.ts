/**
 * Playback rules for the Discover feed. Pure, so they can be tested and so the
 * same rules hold for any player behind ClipPlayer (YouTube today, native
 * video later).
 *
 * Three ideas:
 * - The feed is live only while Discover is on screen and the app is in the
 *   foreground. Another tab, a pushed page or a backgrounded app all stop it.
 * - Of the clips, only the active one (the one on screen) can be live.
 * - Only live, actually-playing time counts as watching, so hidden or
 *   background playback can never become a taste signal.
 */

/** The feed can play: Discover is the visible screen and the app is in the foreground. */
export function feedIsLive(screenFocused: boolean, appState: string | null | undefined) {
  // 'inactive' (iOS: control centre, incoming call, app switcher) and 'background' both stop playback.
  // Some platforms report 'unknown' or nothing before the first change; treat that as foreground.
  return screenFocused && appState !== 'background' && appState !== 'inactive';
}

export type ClipPlayback = {
  /** This clip is the one on screen in the feed. Coming active restarts it from the top. */
  active: boolean;
  /** Active, and the feed is live: the only state in which anything may play or count. */
  live: boolean;
};

export function clipPlayback(index: number, activeIndex: number, feedLive: boolean): ClipPlayback {
  const active = index === activeIndex;
  return { active, live: active && feedLive };
}

/** Whether the clip should be playing right now: live and not paused by you. */
export function shouldPlay(p: ClipPlayback, userPaused: boolean) {
  return p.live && !userPaused;
}

/** Whether playback may count as watching (for watch-time signals). Needs a live clip that is actually playing. */
export function canCountWatch(p: ClipPlayback, actuallyPlaying: boolean) {
  return p.live && actuallyPlaying;
}

/** A jump between two time reports bigger than this is a seek or a stall, not playback. */
export const MAX_TICK_SEC = 1.5;

/**
 * Seconds of real playback between two position reports, or 0 when they must
 * not count: not eligible, first report, a seek backwards (including the loop
 * back to the start) or a jump forwards.
 */
export function playedBetween(prevTime: number | null, time: number, eligible: boolean) {
  if (!eligible || prevTime == null) return 0;
  const d = time - prevTime;
  return d > 0 && d <= MAX_TICK_SEC ? d : 0;
}

/**
 * The stretch of the clip that played between two position reports, in
 * seconds into the clip, or undefined when it must not count (same rules as
 * playedBetween). Watch-time signals use this so the same seconds can't be
 * counted twice.
 */
export function playedSpan(prevTime: number | null, time: number, eligible: boolean, clipStart: number) {
  if (playedBetween(prevTime, time, eligible) === 0 || prevTime == null) return undefined;
  return { from: prevTime - clipStart, to: time - clipStart };
}

/** After we tell a player to play or pause, its reports may lag. Ignore contrary reports for this long. */
export const COMMAND_GRACE_MS = 1000;

export type PlayerAction = 'user-paused' | 'user-played' | 'force-pause';

/**
 * What to do when the player reports it started or stopped playing. The player
 * has its own controls, so a report that disagrees with what we asked for is
 * either you using those controls (follow it) or a hidden player playing when
 * it shouldn't (stop it). Reports we caused, or that arrive while we're still
 * waiting for our last command to land, change nothing.
 */
export function readPlayerReport(
  report: 'playing' | 'paused',
  { live, wantPlaying, msSinceCommand }: { live: boolean; wantPlaying: boolean; msSinceCommand: number },
): PlayerAction | undefined {
  if (report === 'playing' && !live) return 'force-pause';
  if (!live || msSinceCommand < COMMAND_GRACE_MS) return undefined;
  if (report === 'playing' && !wantPlaying) return 'user-played';
  if (report === 'paused' && wantPlaying) return 'user-paused';
  return undefined;
}

/** How long an active, loaded player may keep the still up waiting for playback before showing itself anyway. */
export const POSTER_MAX_WAIT_MS = 2500;

/**
 * The still stays up until the player has something to show: it has played,
 * or it's loaded and has been on screen long enough that its own play button
 * should be reachable (autoplay refused).
 */
export function showPoster({ ready, hasPlayed, waitedLong }: { ready: boolean; hasPlayed: boolean; waitedLong: boolean }) {
  if (!ready) return true;
  return !hasPlayed && !waitedLong;
}

/** A drag must travel this share of the screen, or flick this fast, to change page. */
const PAGE_DISTANCE = 0.18;
const PAGE_MIN_DISTANCE = 56;
const PAGE_VELOCITY = 600;

/**
 * The page a vertical drag over the player lands on: one step up or down, or
 * back where it started. dy and vy are the finger's movement; up is negative.
 */
export function pageAfterDrag(index: number, count: number, dy: number, vy: number, pageHeight: number) {
  'worklet';
  const far = Math.max(PAGE_MIN_DISTANCE, pageHeight * PAGE_DISTANCE);
  let next = index;
  if (dy < -far || (vy < -PAGE_VELOCITY && dy < 0)) next = index + 1;
  else if (dy > far || (vy > PAGE_VELOCITY && dy > 0)) next = index - 1;
  return Math.min(count - 1, Math.max(0, next));
}
