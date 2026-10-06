import { memo, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { APP_ORIGIN } from '../../config/app';
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

/**
 * SoundCloud's official embedded player (the artist's uploads), in a web
 * view sized by ClipPlayer, as YouTube's is. It's only loaded while its card
 * is on screen, so two never play at once; it plays while live and not paused,
 * and pausing or playing with its own buttons is reported back. Nothing is
 * drawn over it. Only ClipPlayer uses this.
 */
function SoundCloudPlayerBase({ media, active, live, paused, progress, onPausedChange, onReady, onStarted, onFail }: EngineProps<SoundCloudMedia>) {
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const wantPlaying = shouldPlay({ active, live }, paused);
  // Built once: the page starts playing by itself when it opens on screen (in case the controls can't load).
  const [html] = useState(() => soundcloudPlayerHtml(media.source.url, { autoPlay: wantPlaying, accent: color.glow }));
  const lastCommandAt = useRef(0);

  useEffect(() => {
    if (ready) return;
    const t = setTimeout(onFail, LOAD_TIMEOUT);
    return () => clearTimeout(t);
  }, [ready, onFail]);

  useEffect(() => {
    if (!ready) return;
    lastCommandAt.current = Date.now();
    web.current?.injectJavaScript(`window.afterglow && window.afterglow.${wantPlaying ? 'play' : 'pause'}(); true;`);
  }, [ready, wantPlaying]);

  const onMessage = (e: WebViewMessageEvent) => {
    const m = parseSoundCloudMessage(e.nativeEvent.data);
    if (!m) return;
    if (m.type === 'ready') {
      setReady(true);
      onReady();
    } else if (m.type === 'error') onFail();
    else if (m.type === 'progress') progress.set(m.share);
    else if (m.type === 'play') {
      onStarted();
      if (!live) web.current?.injectJavaScript('window.afterglow && window.afterglow.pause(); true;');
      else if (paused && Date.now() - lastCommandAt.current > OWN_COMMAND_MS) onPausedChange(false);
    } else if (m.type === 'pause') {
      if (live && !paused && Date.now() - lastCommandAt.current > OWN_COMMAND_MS) onPausedChange(true);
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
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        // Keep the player in place; a link inside it (the SoundCloud logo, a track title) opens SoundCloud itself.
        onShouldStartLoadWithRequest={(req) => {
          const { url } = req;
          if (req.isTopFrame === false) return true;
          if (url === 'about:blank' || url.startsWith('data:') || url.startsWith(APP_ORIGIN)) return true;
          Linking.openURL(url).catch(() => {});
          return false;
        }}
        onOpenWindow={(e) => {
          Linking.openURL(e.nativeEvent.targetUrl).catch(() => {});
        }}
        onError={() => onFail()}
        onContentProcessDidTerminate={() => onFail()}
        onRenderProcessGone={() => onFail()}
        accessibilityLabel={t('SoundCloud player')}
      />
    </View>
  );
}

export const SoundCloudPlayer = memo(SoundCloudPlayerBase);

const styles = StyleSheet.create({
  frame: { flex: 1 },
  web: { flex: 1, backgroundColor: 'transparent' },
});
