import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { APP_ORIGIN } from '../../config/app';
import type { EngineProps } from './ClipPlayer';
import type { YouTubeMedia } from './media';
import { canCountWatch, playedSpan, readPlayerReport, shouldPlay } from './playback';
import { clipProgress, parsePlayerMessage, PLAYER_STATE, playerHtml } from './youtube';
import { t } from '../../i18n';

/** Give up if the player hasn't loaded after this long, and show the stage instead. */
const LOAD_TIMEOUT = 15000;

/**
 * YouTube's official embedded player, in a web view sized by ClipPlayer.
 * Nothing is drawn over it once it shows: our controls live outside its frame.
 * Only ClipPlayer uses this; Discover never talks to YouTube directly.
 */
function YouTubePlayerBase({
  media,
  active,
  live,
  paused,
  progress,
  onPausedChange,
  onPlayed,
  onReady,
  onStarted,
  onFail,
}: EngineProps<YouTubeMedia>) {
  const { source } = media;
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => playerHtml(source, APP_ORIGIN), [source]);
  const wantPlaying = shouldPlay({ active, live }, paused);

  const lastCommandAt = useRef(0);
  const wasActive = useRef(false);
  const isPlaying = useRef(false);
  const lastTime = useRef<number | null>(null);

  useEffect(() => {
    if (ready) return;
    const t = setTimeout(onFail, LOAD_TIMEOUT);
    return () => clearTimeout(t);
  }, [ready, onFail]);

  const command = useCallback((js: string) => {
    lastCommandAt.current = Date.now();
    web.current?.injectJavaScript(`window.afterglow && window.afterglow.${js}; true;`);
  }, []);

  // One place decides what the player does: coming on screen starts the clip
  // from the top; otherwise it plays only while live and not paused by you.
  useEffect(() => {
    if (!ready) return;
    const cameActive = active && !wasActive.current;
    wasActive.current = active;
    lastTime.current = null;
    if (cameActive) {
      progress.set(0);
      // With sound: the app can always play sound, and a mute from an earlier clip mustn't carry over.
      command(`restart(${wantPlaying}, true)`);
    } else {
      command(wantPlaying ? 'play()' : 'pause()');
    }
  }, [ready, active, wantPlaying, progress, command]);

  const onMessage = (e: WebViewMessageEvent) => {
    const m = parsePlayerMessage(e.nativeEvent.data);
    if (!m) return;
    if (m.type === 'ready') {
      setReady(true);
      onReady();
    } else if (m.type === 'error') onFail();
    else if (m.type === 'time') {
      progress.set(clipProgress(m.time, source, m.duration));
      // Only time that played while this clip was live and actually playing counts as watching.
      const span = playedSpan(lastTime.current, m.time, canCountWatch({ active, live }, isPlaying.current), source.start);
      lastTime.current = m.time;
      if (span) onPlayed?.(span.from, span.to);
    } else if (m.type === 'state') {
      isPlaying.current = m.state === PLAYER_STATE.playing;
      if (isPlaying.current) onStarted();
      const report = m.state === PLAYER_STATE.playing ? 'playing' : m.state === PLAYER_STATE.paused ? 'paused' : undefined;
      if (!report) return;
      const action = readPlayerReport(report, {
        live,
        wantPlaying,
        msSinceCommand: Date.now() - lastCommandAt.current,
      });
      if (action === 'force-pause') command('pause()');
      else if (action === 'user-paused') onPausedChange(true);
      else if (action === 'user-played') onPausedChange(false);
    }
  };

  return (
    <View style={styles.frame}>
      <WebView
        ref={web}
        source={{ html, baseUrl: APP_ORIGIN }}
        style={[styles.web, { opacity: ready ? 1 : 0 }]}
        onMessage={onMessage}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        // Keep the player in place; any link inside it (the YouTube logo, the title) opens YouTube itself.
        onShouldStartLoadWithRequest={(req) => {
          const { url } = req;
          // The player's own frame (iOS reports it; Android only asks about the top frame).
          if (req.isTopFrame === false) return true;
          if (url === 'about:blank' || url.startsWith('data:') || url.startsWith(APP_ORIGIN)) return true;
          Linking.openURL(url).catch(() => {});
          return false;
        }}
        onOpenWindow={(e) => {
          Linking.openURL(e.nativeEvent.targetUrl).catch(() => {});
        }}
        onError={() => onFail()}
        onHttpError={(e) => {
          if (e.nativeEvent.url.startsWith(APP_ORIGIN)) return;
          if (e.nativeEvent.url.includes('iframe_api')) onFail();
        }}
        onContentProcessDidTerminate={() => {
          // iOS dropped the page (memory pressure). Reload and set it up again once it's ready.
          setReady(false);
          wasActive.current = false;
          isPlaying.current = false;
          web.current?.reload();
        }}
        onRenderProcessGone={() => onFail()}
        accessibilityLabel={t('Live set video')}
      />
    </View>
  );
}

export const YouTubePlayer = memo(YouTubePlayerBase);

const styles = StyleSheet.create({
  frame: { flex: 1 },
  web: { flex: 1, backgroundColor: 'transparent' },
});
