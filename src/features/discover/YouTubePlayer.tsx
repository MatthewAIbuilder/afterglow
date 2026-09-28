import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { APP_ORIGIN } from '../../config/app';
import type { ClipSource } from '../../data/types';
import { color } from '../../theme/tokens';
import { clipProgress, parsePlayerMessage, PLAYER_STATE, playerHtml } from './youtube';

type Props = {
  source: ClipSource;
  /** This clip is the one on screen. Only the active player ever plays. */
  active: boolean;
  /** Paused by a tap outside the player. */
  paused: boolean;
  /** 0 to 1 through the clip, for the progress line under the player. */
  progress: SharedValue<number>;
  /** The player itself was played or paused (its own controls, or autoplay). */
  onPlayingChange: (playing: boolean) => void;
  /** Seconds of the clip that actually played, reported as it goes. Loops count again; seeking back doesn't. */
  onPlayed?: (seconds: number) => void;
  /** The video can't play here: removed, private, embedding off, or the player never loaded. */
  onFail: () => void;
};

/** Give up if the player hasn't loaded after this long, and show the stage instead. */
const LOAD_TIMEOUT = 15000;
/** A gap between time reports bigger than this is a seek, not playback. */
const MAX_TICK = 1.5;

/**
 * YouTube's official embedded player, in a web view sized by the parent.
 * Nothing is drawn over it: our controls live outside its frame.
 */
function YouTubePlayerBase({ source, active, paused, progress, onPlayingChange, onPlayed, onFail }: Props) {
  const web = useRef<WebView>(null);
  const lastTime = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => playerHtml(source, APP_ORIGIN), [source]);

  useEffect(() => {
    if (ready) return;
    const t = setTimeout(onFail, LOAD_TIMEOUT);
    return () => clearTimeout(t);
  }, [ready, onFail]);

  const command = useCallback((name: 'play' | 'pause' | 'restart') => {
    web.current?.injectJavaScript(`window.afterglow && window.afterglow.${name}(); true;`);
  }, []);

  // Coming into view starts the clip from the top, like the stage clips.
  useEffect(() => {
    if (!ready) return;
    lastTime.current = null;
    if (active) {
      progress.set(0);
      command('restart');
    } else {
      command('pause');
    }
  }, [active, ready, progress, command]);

  useEffect(() => {
    if (!ready || !active) return;
    command(paused ? 'pause' : 'play');
  }, [paused, ready, active, command]);

  const onMessage = (e: WebViewMessageEvent) => {
    const m = parsePlayerMessage(e.nativeEvent.data);
    if (!m) return;
    if (m.type === 'ready') setReady(true);
    else if (m.type === 'error') onFail();
    else if (m.type === 'time') {
      progress.set(clipProgress(m.time, source));
      if (active && lastTime.current != null) {
        const played = m.time - lastTime.current;
        if (played > 0 && played <= MAX_TICK) onPlayed?.(played);
      }
      lastTime.current = m.time;
    }
    else if (m.type === 'state' && active) {
      if (m.state === PLAYER_STATE.playing) onPlayingChange(true);
      else if (m.state === PLAYER_STATE.paused) onPlayingChange(false);
    }
  };

  return (
    <View style={styles.frame}>
      {!ready && <ActivityIndicator style={StyleSheet.absoluteFill} color={color.moonDim} />}
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
        onContentProcessDidTerminate={() => web.current?.reload()}
        onRenderProcessGone={() => onFail()}
        accessibilityLabel="Live set video"
      />
    </View>
  );
}

export const YouTubePlayer = memo(YouTubePlayerBase);

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: '#000' },
  web: { flex: 1, backgroundColor: '#000' },
});
