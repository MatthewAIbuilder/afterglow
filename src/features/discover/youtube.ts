import type { Clip, YouTubeClipSource } from '../../data/models';

/**
 * Pure helpers for real footage played in YouTube's official embedded player.
 * Kept free of React so the rules are easy to test.
 */

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** The clip's footage if it can be played, otherwise undefined and the card shows the stage. */
export function playableSource(clip: Clip): YouTubeClipSource | undefined {
  const s = clip.source;
  if (!s || s.provider !== 'youtube') return undefined;
  if (!VIDEO_ID.test(s.videoId)) return undefined;
  if (!Number.isFinite(s.start) || !Number.isFinite(s.end) || s.start < 0 || s.end <= s.start) return undefined;
  return s;
}

/** How far through the clip a playback time is, 0 to 1. A video shorter than the section ends early. */
export function clipProgress(time: number, source: YouTubeClipSource, duration?: number) {
  const end = duration && duration > source.start ? Math.min(source.end, duration) : source.end;
  const p = (time - source.start) / (end - source.start);
  return Math.min(1, Math.max(0, p));
}

/** The video's own still, shown while the player loads. Horizontal stills come letterboxed, so fill and crop. */
export function posterUrl(source: YouTubeClipSource) {
  return `https://i.ytimg.com/vi/${source.videoId}/hqdefault.jpg`;
}

/** Link to the same moment on YouTube itself, for videos that can't play here. */
export function watchUrl(source: YouTubeClipSource) {
  return `https://www.youtube.com/watch?v=${source.videoId}&t=${Math.floor(source.start)}s`;
}

/** Messages the player page sends back. */
export type PlayerMessage =
  | { type: 'ready' }
  | { type: 'state'; state: number }
  | { type: 'time'; time: number; duration?: number; muted?: boolean }
  | { type: 'error'; code: number };

/** YouTube player states we react to. */
export const PLAYER_STATE = { ended: 0, playing: 1, paused: 2 } as const;

export function parsePlayerMessage(raw: string): PlayerMessage | undefined {
  try {
    const m = JSON.parse(raw);
    if (m?.type === 'ready') return { type: 'ready' };
    if (m?.type === 'state' && typeof m.state === 'number') return { type: 'state', state: m.state };
    if (m?.type === 'time' && typeof m.time === 'number')
      return { type: 'time', time: m.time, duration: typeof m.duration === 'number' ? m.duration : undefined, ...(typeof m.muted === 'boolean' ? { muted: m.muted } : {}) };
    if (m?.type === 'error' && typeof m.code === 'number') return { type: 'error', code: m.code };
  } catch {}
  return undefined;
}

/**
 * A minimal page hosting the official IFrame Player API. The player keeps its
 * own controls and branding; nothing is drawn over it. The page loops the clip
 * section and reports readiness, state, time and errors.
 */
export function playerHtml(source: YouTubeClipSource, origin: string) {
  const config = JSON.stringify({
    videoId: source.videoId,
    start: source.start,
    end: source.end,
    origin,
  });
  return `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body{margin:0;padding:0;height:100%;background:#000;overflow:hidden}#player{position:absolute;top:0;left:0;width:100%;height:100%}</style>
</head><body>
<div id="player"></div>
<script>
var C = ${config};
var player, timer;
function send(m) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
function tick() {
  if (!player || !player.getCurrentTime) return;
  var t = player.getCurrentTime();
  if (t >= C.end - 0.25 || t < C.start - 1) { player.seekTo(C.start, true); t = C.start; }
  send({ type: 'time', time: t, duration: player.getDuration ? player.getDuration() : undefined, muted: player.isMuted ? player.isMuted() : undefined });
}
function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    videoId: C.videoId,
    playerVars: { start: Math.floor(C.start), end: Math.ceil(C.end), playsinline: 1, controls: 1, rel: 0, autoplay: 0, origin: C.origin, widget_referrer: C.origin },
    events: {
      onReady: function () { send({ type: 'ready' }); },
      onStateChange: function (e) {
        clearInterval(timer);
        if (e.data === 1) timer = setInterval(tick, 250);
        if (e.data === 0) { player.seekTo(C.start, true); player.playVideo(); }
        send({ type: 'state', state: e.data });
      },
      onError: function (e) { send({ type: 'error', code: e.data }); }
    }
  });
}
window.afterglow = {
  play: function () { if (player && player.playVideo) player.playVideo(); },
  pause: function () { if (player && player.pauseVideo) player.pauseVideo(); },
  // Back to the top of the clip, then play or stay paused (seeking alone would start a cued video).
  // With sound, unmute first: YouTube remembers a mute across every player, so one muted clip would mute the next.
  restart: function (play, sound) { if (player && player.seekTo) { if (sound && player.unMute) player.unMute(); player.seekTo(C.start, true); if (play) player.playVideo(); else player.pauseVideo(); } }
};
</script>
<script src="https://www.youtube.com/iframe_api"></script>
</body></html>`;
}
