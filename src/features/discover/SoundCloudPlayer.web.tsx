import { createElement, memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { color } from '../../theme/tokens';
import type { EngineProps } from './ClipPlayer';
import type { SoundCloudMedia } from './media';
import { shouldPlay } from './playback';
import { parseSoundCloudMessage, soundcloudPlayerHtml } from './soundcloud';
import { t } from '../../i18n';

/** Give up if the player hasn't loaded after this long, and show the stage instead. */
const LOAD_TIMEOUT = 15000;
/** A play or pause the player reports this soon after one of ours is ours, not yours. */
const OWN_COMMAND_MS = 1200;

type PlayerWindow = Window & { afterglow?: { play(): void; pause(): void } };

/**
 * SoundCloud's official embedded player in a browser: the same page as the
 * phone (soundcloud.ts), in a same-origin frame instead of a web view, with
 * the same rules for what plays. A browser may refuse to start it with sound
 * before you've touched the page; SoundCloud's own play button is there then.
 * Only ClipPlayer uses this (Metro picks it on web).
 */
function SoundCloudPlayerBase({ media, active, live, paused, progress, onPausedChange, onReady, onStarted, onFail }: EngineProps<SoundCloudMedia>) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const wantPlaying = shouldPlay({ active, live }, paused);
  const [html] = useState(() =>
    soundcloudPlayerHtml(media.source.url, { autoPlay: wantPlaying, accent: color.glow }).replace(
      '<script>',
      '<script>window.ReactNativeWebView={postMessage:function(d){parent.postMessage({afterglowSoundCloud:d},"*")}};</script><script>',
    ),
  );
  const lastCommandAt = useRef(0);

  useEffect(() => {
    if (ready) return;
    const t = setTimeout(onFail, LOAD_TIMEOUT);
    return () => clearTimeout(t);
  }, [ready, onFail]);

  useEffect(() => {
    if (!ready) return;
    lastCommandAt.current = Date.now();
    const a = (frame.current?.contentWindow as PlayerWindow | null | undefined)?.afterglow;
    if (wantPlaying) a?.play();
    else a?.pause();
  }, [ready, wantPlaying]);

  // Messages from this player's frame only.
  const now = useRef({ live, paused, onReady, onStarted, onFail, onPausedChange });
  useEffect(() => {
    now.current = { live, paused, onReady, onStarted, onFail, onPausedChange };
  });
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const m = parseSoundCloudMessage((e.data as { afterglowSoundCloud?: unknown } | null)?.afterglowSoundCloud);
      if (!m) return;
      const c = now.current;
      const yours = Date.now() - lastCommandAt.current > OWN_COMMAND_MS;
      if (m.type === 'ready') {
        setReady(true);
        c.onReady();
      } else if (m.type === 'error') c.onFail();
      else if (m.type === 'progress') progress.set(m.share);
      else if (m.type === 'play') {
        c.onStarted();
        if (!c.live) (frame.current.contentWindow as PlayerWindow | null)?.afterglow?.pause();
        else if (c.paused && yours) c.onPausedChange(false);
      } else if (m.type === 'pause' && c.live && !c.paused && yours) c.onPausedChange(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [progress]);

  return (
    <View style={styles.frame}>
      {createElement('iframe', {
        ref: frame,
        srcDoc: html,
        title: t('SoundCloud player'),
        allow: 'autoplay; encrypted-media',
        style: { border: 0, width: '100%', height: '100%', background: 'transparent', opacity: ready ? 1 : 0 },
      })}
    </View>
  );
}

export const SoundCloudPlayer = memo(SoundCloudPlayerBase);

const styles = StyleSheet.create({
  frame: { flex: 1 },
});
