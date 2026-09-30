import { createElement, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { EngineProps } from './ClipPlayer';
import type { YouTubeMedia } from './media';
import { canCountWatch, playedSpan, readPlayerReport, shouldPlay } from './playback';
import { clipProgress, parsePlayerMessage, PLAYER_STATE, playerHtml } from './youtube';

/** Give up if the player hasn't loaded after this long, and show the stage instead. */
const LOAD_TIMEOUT = 15000;
/** Browsers only let video start with sound after you've interacted with the page; if a play hasn't started by then, play muted. */
const AUTOPLAY_GRACE_MS = 1500;

type PlayerWindow = Window & {
  afterglow?: { play(): void; pause(): void; restart(play: boolean): void };
  player?: { mute?: () => void; playVideo?: () => void; getPlayerState?: () => number };
};

/**
 * YouTube's official embedded player in a browser: the same player page as
 * the phone (youtube.ts), in a same-origin frame instead of a web view, with
 * the same rules for what plays and what counts as watched. If the browser
 * won't start a clip with sound yet, it plays muted (YouTube's own controls
 * can turn the sound on). Only ClipPlayer uses this (Metro picks it on web).
 */
function YouTubePlayerBase({ media, active, live, paused, progress, onPausedChange, onPlayed, onReady, onStarted, onFail }: EngineProps<YouTubeMedia>) {
  const { source } = media;
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(
    // The phone's web view gives the page `window.ReactNativeWebView`; here the same messages go to this window.
    () => playerHtml(source, window.location.origin).replace('<script>', '<script>window.ReactNativeWebView={postMessage:function(d){parent.postMessage({afterglowPlayer:d},"*")}};</script><script>'),
    [source],
  );
  const wantPlaying = shouldPlay({ active, live }, paused);

  const lastCommandAt = useRef(0);
  const wasActive = useRef(false);
  const isPlaying = useRef(false);
  const lastTime = useRef<number | null>(null);
  const muted = useRef(false);

  useEffect(() => {
    if (ready) return;
    const t = setTimeout(onFail, LOAD_TIMEOUT);
    return () => clearTimeout(t);
  }, [ready, onFail]);

  const win = () => frame.current?.contentWindow as PlayerWindow | null | undefined;
  const command = useCallback((run: (a: NonNullable<PlayerWindow['afterglow']>) => void) => {
    lastCommandAt.current = Date.now();
    const a = win()?.afterglow;
    if (a) run(a);
  }, []);

  // One place decides what the player does, as on the phone: coming on screen starts from the top; otherwise play only while live and not paused.
  useEffect(() => {
    if (!ready) return;
    const cameActive = active && !wasActive.current;
    wasActive.current = active;
    lastTime.current = null;
    if (cameActive) {
      progress.set(0);
      command((a) => a.restart(wantPlaying));
    } else {
      command((a) => (wantPlaying ? a.play() : a.pause()));
    }
    if (!wantPlaying || muted.current) return;
    // Not started with sound (no tap on the page yet): start muted instead.
    const t = setTimeout(() => {
      const p = win()?.player;
      if (isPlaying.current || !p?.mute || !p.playVideo) return;
      muted.current = true;
      lastCommandAt.current = Date.now();
      p.mute();
      p.playVideo();
    }, AUTOPLAY_GRACE_MS);
    return () => clearTimeout(t);
  }, [ready, active, wantPlaying, progress, command]);

  // Messages from this player's frame only.
  const now = useRef({ active, live, wantPlaying, onPlayed, onReady, onStarted, onFail, onPausedChange });
  useEffect(() => {
    now.current = { active, live, wantPlaying, onPlayed, onReady, onStarted, onFail, onPausedChange };
  });
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const raw = (e.data as { afterglowPlayer?: unknown } | null)?.afterglowPlayer;
      const m = typeof raw === 'string' ? parsePlayerMessage(raw) : undefined;
      if (!m) return;
      const c = now.current;
      if (m.type === 'ready') {
        setReady(true);
        c.onReady();
      } else if (m.type === 'error') c.onFail();
      else if (m.type === 'time') {
        progress.set(clipProgress(m.time, source, m.duration));
        const span = playedSpan(lastTime.current, m.time, canCountWatch({ active: c.active, live: c.live }, isPlaying.current), source.start);
        lastTime.current = m.time;
        if (span) c.onPlayed?.(span.from, span.to);
      } else if (m.type === 'state') {
        isPlaying.current = m.state === PLAYER_STATE.playing;
        if (isPlaying.current) c.onStarted();
        const report = m.state === PLAYER_STATE.playing ? 'playing' : m.state === PLAYER_STATE.paused ? 'paused' : undefined;
        if (!report) return;
        const action = readPlayerReport(report, { live: c.live, wantPlaying: c.wantPlaying, msSinceCommand: Date.now() - lastCommandAt.current });
        if (action === 'force-pause') command((a) => a.pause());
        else if (action === 'user-paused') c.onPausedChange(true);
        else if (action === 'user-played') c.onPausedChange(false);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [source, progress, command]);

  return (
    <View style={styles.frame}>
      {createElement('iframe', {
        ref: frame,
        srcDoc: html,
        title: 'Live set video',
        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
        allowFullScreen: true,
        style: { border: 0, width: '100%', height: '100%', background: 'transparent', opacity: ready ? 1 : 0 },
      })}
    </View>
  );
}

export const YouTubePlayer = memo(YouTubePlayerBase);

const styles = StyleSheet.create({
  frame: { flex: 1 },
});
