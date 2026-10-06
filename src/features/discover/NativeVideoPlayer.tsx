import { useVideoPlayer, VideoView } from 'expo-video';
import { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { EngineProps } from './ClipPlayer';
import type { VideoMedia } from './media';
import { canCountWatch, playedSpan, shouldPlay } from './playback';
import { loopPosition } from '../memories/trim';
import { seekTo } from '../memories/seek';
import { useVideoSize } from '../memories/useVideoSize';
import { fitFor, type VideoSize } from '../memories/videoFit';

/** Give up if the video hasn't loaded after this long, and show the stage instead. */
const LOAD_TIMEOUT = 15000;
/** How often the player reports its position, in seconds (for the progress line and watch time). */
const TICK = 0.25;

/**
 * A video file someone shared (a community clip), in the phone's own player.
 * The same rules as the YouTube player: it plays only while it's the live
 * clip and you haven't paused it, starts from the top whenever it comes on
 * screen, and reports only stretches that actually played while live. No
 * controls are drawn on it; taps on the card pause and play it. Only
 * ClipPlayer uses this.
 */
function NativeVideoPlayerBase({ media, active, live, paused, progress, onPlayed, onReady, onStarted, onFail }: EngineProps<VideoMedia>) {
  // A trimmed video plays only its part: it starts there and loops back at its end.
  const part = media.community.clip;
  const start = part?.start ?? 0;
  const player = useVideoPlayer(media.uri, (p) => {
    p.loop = true;
    p.timeUpdateEventInterval = TICK;
    if (part) p.currentTime = part.start;
  });
  const wantPlaying = shouldPlay({ active, live }, paused);
  // Fill the frame only when the video's real shape (read from the video itself) nearly matches it; otherwise show it whole.
  const [frame, setFrame] = useState<VideoSize>();
  const size = useVideoSize(player, media.uri);
  const ready = useRef(false);
  const isPlaying = useRef(false);
  const lastTime = useRef<number | null>(null);
  const wasActive = useRef(false);
  // The latest props, for the player's event handlers (subscribed once).
  const now = useRef({ active, live, onPlayed, onReady, onStarted, onFail });
  useEffect(() => {
    now.current = { active, live, onPlayed, onReady, onStarted, onFail };
  });

  useEffect(() => {
    const t = setTimeout(() => {
      if (!ready.current) now.current.onFail();
    }, LOAD_TIMEOUT);
    const subs = [
      player.addListener('statusChange', ({ status }) => {
        if (status === 'readyToPlay' && !ready.current) {
          ready.current = true;
          now.current.onReady();
        } else if (status === 'error') now.current.onFail();
      }),
      player.addListener('playingChange', ({ isPlaying: playing }) => {
        isPlaying.current = playing;
        if (playing) now.current.onStarted();
      }),
      player.addListener('timeUpdate', ({ currentTime: at }) => {
        const back = loopPosition(at, part);
        if (back !== undefined) {
          seekTo(player, back);
          lastTime.current = null;
          return;
        }
        // Times within the part that plays.
        const currentTime = Math.max(0, at - start);
        const length = media.lengthSec > 0 ? media.lengthSec : player.duration || 1;
        progress.set(Math.min(1, Math.max(0, currentTime / length)));
        const { active: a, live: l, onPlayed: played } = now.current;
        const span = playedSpan(lastTime.current, currentTime, canCountWatch({ active: a, live: l }, isPlaying.current), 0);
        lastTime.current = currentTime;
        if (span) played?.(span.from, span.to);
      }),
    ];
    return () => {
      clearTimeout(t);
      subs.forEach((s) => s.remove());
    };
  }, [player, media.lengthSec, progress, part, start]);

  // One place decides what plays: coming on screen starts from the top; otherwise play only while live and not paused.
  useEffect(() => {
    const cameActive = active && !wasActive.current;
    wasActive.current = active;
    lastTime.current = null;
    if (cameActive) {
      progress.set(0);
      if (part) seekTo(player, part.start);
      else player.replay();
    }
    if (wantPlaying) player.play();
    else player.pause();
  }, [active, wantPlaying, player, progress, part]);

  return (
    <View
      style={styles.frame}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0 && (width !== frame?.width || height !== frame?.height)) setFrame({ width, height });
      }}
    >
      <VideoView
        player={player}
        style={styles.video}
        contentFit={fitFor(size, frame ?? {})}
        nativeControls={false}
        allowsPictureInPicture={false}
        // In the page on the website: an iPhone would otherwise open its own full-screen player.
        playsInline
        accessibilityLabel={media.credit}
      />
    </View>
  );
}

export const NativeVideoPlayer = memo(NativeVideoPlayerBase);

const styles = StyleSheet.create({
  // A video tag doesn't stretch to fill on the website without a size of its own.
  video: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  frame: { flex: 1, backgroundColor: '#000' },
});
