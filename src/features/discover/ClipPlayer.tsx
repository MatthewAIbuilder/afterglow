import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { color } from '../../theme/tokens';
import type { ClipMedia } from './media';
import { NativeVideoPlayer } from './NativeVideoPlayer';
import { POSTER_MAX_WAIT_MS, showPoster } from './playback';
import { SoundCloudPlayer } from './SoundCloudPlayer';
import { YouTubePlayer } from './YouTubePlayer';

/**
 * How long to wait before loading the player of a clip next to the one on
 * screen: so a swipe's snap never shares its frames with a new player
 * starting up (a browser needs longer).
 */
export const NEAR_LOAD_DELAY_MS = Platform.OS === 'web' ? 900 : 450;

type Common = {
  media: ClipMedia;
  /** This clip is the one on screen. Coming active restarts it from the top. */
  active: boolean;
  /** Active, Discover visible and the app in the foreground. Nothing plays or counts otherwise. */
  live: boolean;
  /** Paused by you (a tap on the card, or the player's own controls). */
  paused: boolean;
  /** 0 to 1 through the clip, for the progress line. */
  progress: SharedValue<number>;
  /** You paused or played with the player's own controls. */
  onPausedChange: (paused: boolean) => void;
  /**
   * A stretch of the clip that actually played while live, in seconds into
   * the clip, reported as it happens. The only source for watch-time
   * signals: hidden, backgrounded or paused playback never reaches it.
   */
  onPlayed?: (from: number, to: number) => void;
  /** The footage can't play here: the card falls back to the stage. */
  onFail: () => void;
};

export type ClipPlayerProps = Common & {
  /** Near the screen: load the player so a swipe lands on a ready video. Otherwise only the still shows. */
  load: boolean;
};

/** What each provider's player implements, for its own kind of media. Only ClipPlayer renders one. */
export type EngineProps<M extends ClipMedia = ClipMedia> = Omit<Common, 'media'> & {
  media: M;
  onReady: () => void;
  /** Frames are actually moving. */
  onStarted: () => void;
};

/**
 * The one video surface Discover uses. It shows the clip's still while the
 * player loads, fades into the player once it has something to show, and
 * picks the player for the clip's provider. Discover never deals with a
 * provider directly, so a native video player can later slot in here.
 */
function ClipPlayerBase({ load: near, ...props }: ClipPlayerProps) {
  const { media, live } = props;
  // In a browser, starting a YouTube player is heavy work: the clips next door wait a moment so a swipe lands smoothly.
  const waitToLoad = !props.active;
  const [mayLoad, setMayLoad] = useState(!waitToLoad);
  // Once a clip has been on screen it stays loaded while near: swiping on never throws it away.
  if (props.active && !mayLoad) setMayLoad(true);
  useEffect(() => {
    if (!near || mayLoad || !waitToLoad) return;
    const t = setTimeout(() => setMayLoad(true), NEAR_LOAD_DELAY_MS);
    return () => clearTimeout(t);
  }, [near, mayLoad, waitToLoad]);
  // A SoundCloud page loads only while on screen: its player can't be told to stay quiet before it's ready.
  const load = near && (mayLoad || !waitToLoad) && (media.provider !== 'soundcloud' || props.active);
  const reduceMotion = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [waitedLong, setWaitedLong] = useState(false);
  const [posterFaded, setPosterFaded] = useState(false);

  // Unloading throws the player away; it starts fresh, behind the still, next time.
  const [loaded, setLoaded] = useState(load);
  if (load !== loaded) {
    setLoaded(load);
    if (!load) {
      setReady(false);
      setHasPlayed(false);
      setWaitedLong(false);
      setPosterFaded(false);
    }
  }

  // On screen and loaded but not playing (autoplay refused): show the player so its own play button can be reached.
  useEffect(() => {
    if (!ready || !live || hasPlayed || waitedLong) return;
    const t = setTimeout(() => setWaitedLong(true), POSTER_MAX_WAIT_MS);
    return () => clearTimeout(t);
  }, [ready, live, hasPlayed, waitedLong]);

  const posterUp = showPoster({ ready, hasPlayed, waitedLong });
  const posterMounted = posterUp || !posterFaded;
  const posterOpacity = useSharedValue(1);
  useEffect(() => {
    if (posterUp) {
      posterOpacity.set(1);
      return;
    }
    posterOpacity.set(
      withTiming(0, { duration: reduceMotion ? 0 : 280 }, (done) => {
        if (done) runOnJS(setPosterFaded)(true);
      }),
    );
  }, [posterUp, reduceMotion, posterOpacity]);
  const posterStyle = useAnimatedStyle(() => ({ opacity: posterOpacity.get() }));

  const onReady = useCallback(() => setReady(true), []);
  const onStarted = useCallback(() => setHasPlayed(true), []);

  return (
    <View style={styles.frame}>
      {load && media.provider === 'youtube' && <YouTubePlayer {...props} media={media} onReady={onReady} onStarted={onStarted} />}
      {load && media.provider === 'video' && <NativeVideoPlayer {...props} media={media} onReady={onReady} onStarted={onStarted} />}
      {load && media.provider === 'soundcloud' && <SoundCloudPlayer {...props} media={media} onReady={onReady} onStarted={onStarted} />}
      {posterMounted && !!media.posterUrl && (
        <Animated.View style={[StyleSheet.absoluteFill, posterStyle]} pointerEvents="none">
          <Image
            source={{ uri: media.posterUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={media.vertical ? 24 : 0}
            transition={200}
            accessible={false}
          />
          <View style={[StyleSheet.absoluteFill, styles.posterShade]} />
          {live && posterUp && <ActivityIndicator style={StyleSheet.absoluteFill} color={color.moonDim} />}
        </Animated.View>
      )}
    </View>
  );
}

export const ClipPlayer = memo(ClipPlayerBase);

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: color.nightRaised },
  posterShade: { backgroundColor: 'rgba(6,5,16,0.28)' },
});
