import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { artistById } from '../../data/artists';
import { describeSet, festivalById, setFor } from '../../data/festivals';
import type { Clip } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { useReactions } from '../../state/reactions';
import { useTaste } from '../../state/taste';
import { watchFrom } from '../taste/watch';
import { color, motion, radius, space, type } from '../../theme/tokens';
import { ActionRail } from './ActionRail';
import { HeartIcon, PlayIcon } from './icons';
import { StageScene } from './StageScene';
import { playableSource, watchUrl } from './youtube';
import { YouTubePlayer } from './YouTubePlayer';

type Props = {
  clip: Clip;
  width: number;
  height: number;
  isActive: boolean;
  /** On screen or next to it: real footage loads ahead so a swipe lands on a ready player. */
  isNear: boolean;
  /** Space reserved at the bottom for the floating tab bar. */
  bottomSpace: number;
  onSkip: () => void;
};

const BURST = 110;
/** YouTube's embedded player must be at least 200 by 200. */
const MIN_PLAYER = 200;
/** Starts below the feed's festival header and its fade, so nothing ever sits over the player. */
const HEADER_CLEARANCE = 100;

function ClipCardBase({ clip, width, height, isActive, isNear, bottomSpace, onSkip }: Props) {
  const artist = artistById(clip.artistId);
  const reduceMotion = useReducedMotion();
  const { get, setLiked, toggleSaved, markSkipped, recordWatch } = useReactions();
  const reaction = get(clip.id);
  const { taste } = useTaste();
  const [paused, setPaused] = useState(false);
  const playing = isActive && !paused;
  const insets = useSafeAreaInsets();

  // Real footage when the clip has a playable source; the stage when it doesn't or the video fails.
  const source = playableSource(clip);
  const [videoFailed, setVideoFailed] = useState(false);
  const showVideo = !!source && !videoFailed;
  const failVideo = useCallback(() => setVideoFailed(true), []);
  const syncPlaying = useCallback((isPlaying: boolean) => setPaused(!isPlaying), []);
  const videoProgress = useSharedValue(0);
  const videoProgressStyle = useAnimatedStyle(() => ({ width: `${videoProgress.value * 100}%` }));
  // Real footage counts what YouTube actually played, so loading time is never mistaken for watching.
  const videoPlayed = useRef(0);
  const addVideoPlayed = useCallback((seconds: number) => {
    videoPlayed.current += seconds;
  }, []);

  // One clock drives the light show and the progress bar, so pausing freezes both.
  const clock = useSharedValue(0);
  const frame = useFrameCallback((f) => {
    clock.value += f.timeSincePreviousFrame ?? 0;
  }, false);

  useEffect(() => {
    frame.setActive(playing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Every time a clip comes into view it starts from the top. When it leaves,
  // how long it played becomes a quiet taste signal.
  const wasActive = useRef(isActive);
  useEffect(() => {
    if (wasActive.current && !isActive) {
      const played = showVideo && source ? videoPlayed.current : clock.value / 1000;
      const length = showVideo && source ? source.end - source.start : clip.durationSec;
      const watch = watchFrom(played, length);
      if (watch) recordWatch(clip.id, watch);
    }
    wasActive.current = isActive;
    if (isActive) {
      clock.value = 0;
      videoPlayed.current = 0;
      setPaused(false);
    }
    // Only a change of the on-screen clip matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${((clock.value / (clip.durationSec * 1000)) % 1) * 100}%`,
  }));

  // Double-tap heart burst.
  const [burstAt, setBurstAt] = useState({ x: 0, y: 0 });
  const burstScale = useSharedValue(0);
  const burstOpacity = useSharedValue(0);
  const burstStyle = useAnimatedStyle(() => ({
    opacity: burstOpacity.value,
    transform: [{ scale: burstScale.value }, { rotate: '-8deg' }],
  }));

  const likeFromDoubleTap = (x: number, y: number) => {
    setBurstAt({ x, y });
    burstScale.value = withSequence(withTiming(0, { duration: 0 }), withSpring(1, motion.bloom));
    burstOpacity.value = withSequence(withTiming(1, { duration: 60 }), withDelay(420, withTiming(0, { duration: 260 })));
    haptic.tap();
    if (!reaction.liked) setLiked(clip.id, true);
  };

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDistance(20)
    .runOnJS(true)
    .onEnd((e, ok) => {
      if (ok) likeFromDoubleTap(e.x, e.y);
    });

  const singleTap = Gesture.Tap()
    .maxDistance(12)
    .requireExternalGestureToFail(doubleTap)
    .runOnJS(true)
    .onEnd((_e, ok) => {
      if (!ok) return;
      haptic.select();
      setPaused((p) => !p);
    });

  const pauseOpacity = useSharedValue(0);
  useEffect(() => {
    pauseOpacity.value = withTiming(paused ? 1 : 0, { duration: 180 });
  }, [paused, pauseOpacity]);
  const pauseStyle = useAnimatedStyle(() => ({
    opacity: pauseOpacity.value,
    transform: [{ scale: 0.8 + 0.2 * pauseOpacity.value }],
  }));

  if (!artist) return null;
  const pct = Math.round((taste[artist.id] ?? 0) * 100);
  const festival = festivalById(clip.festivalId);
  const set = festival && setFor(festival, artist.id);
  const meta = festival && set ? describeSet(festival, set) : (festival?.name ?? '');

  const artistButton = (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push(`/artist/${artist.id}`);
      }}
      accessibilityRole="button"
      accessibilityLabel={`Open ${artist.name}`}
      hitSlop={8}
      style={({ pressed }) => [styles.artistRow, pressed && { opacity: 0.7 }]}
    >
      <ArtistAvatar artist={artist} size={40} />
      <View style={styles.artistText}>
        <Text style={styles.name} numberOfLines={1}>
          {artist.name}
        </Text>
        <Text style={styles.match}>{pct}% match</Text>
      </View>
    </Pressable>
  );

  const actions = (horizontal: boolean) => (
    <ActionRail
      horizontal={horizontal}
      liked={reaction.liked}
      saved={reaction.saved}
      onLike={() => {
        const next = !reaction.liked;
        next ? haptic.tap() : haptic.select();
        setLiked(clip.id, next);
      }}
      onSave={() => {
        reaction.saved ? haptic.select() : haptic.tap();
        toggleSaved(clip.id);
      }}
      onSkip={() => {
        haptic.soft();
        markSkipped(clip.id);
        onSkip();
      }}
    />
  );

  const burst = (
    <Animated.View
      pointerEvents="none"
      style={[styles.burst, { left: burstAt.x - BURST / 2, top: burstAt.y - BURST / 2 }, burstStyle]}
    >
      <HeartIcon color={color.glow} size={BURST} filled />
    </Animated.View>
  );

  if (source && showVideo) {
    const playerWidth = width - space.lg * 2;
    const playerHeight = Math.max(MIN_PLAYER, Math.round((playerWidth * 9) / 16));
    return (
      <View style={{ width, height }}>
        {/* The stage keeps glowing behind the video. Taps here pause, double-taps like; the player takes its own touches. */}
        <GestureDetector gesture={Gesture.Exclusive(doubleTap, singleTap)}>
          <View style={StyleSheet.absoluteFill}>
            <StageScene
              artistId={artist.id}
              bpm={clip.bpm}
              width={width}
              height={height}
              clock={clock}
              reduceMotion={reduceMotion}
            />
            <View style={[StyleSheet.absoluteFill, styles.dim]} pointerEvents="none" />
            {burst}
          </View>
        </GestureDetector>

        <View
          style={[styles.stack, { top: insets.top + HEADER_CLEARANCE, bottom: bottomSpace + space.lg }]}
          pointerEvents="box-none"
        >
          <View style={[styles.player, { width: playerWidth, height: playerHeight }]}>
            {isNear && (
              <YouTubePlayer
                source={source}
                active={isActive}
                paused={paused}
                progress={videoProgress}
                onPlayingChange={syncPlaying}
                onPlayed={addVideoPlayed}
                onFail={failVideo}
              />
            )}
          </View>
          <View style={[styles.videoTrack, { width: playerWidth }]} pointerEvents="none">
            <Animated.View style={[styles.progress, videoProgressStyle]} />
          </View>

          <View style={styles.videoInfo} pointerEvents="box-none">
            {artistButton}
            <Text style={styles.title}>{clip.title}</Text>
            <Text style={styles.meta}>{meta}</Text>
            <Text style={styles.credit}>{source.channel} on YouTube</Text>
          </View>

          <View style={styles.videoActions}>{actions(true)}</View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ width, height }}>
      <GestureDetector gesture={Gesture.Exclusive(doubleTap, singleTap)}>
        <View style={StyleSheet.absoluteFill}>
          <StageScene
            artistId={artist.id}
            bpm={clip.bpm}
            width={width}
            height={height}
            clock={clock}
            reduceMotion={reduceMotion}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(3,2,10,0.75)']}
            style={[styles.scrim, { height: height * 0.45 }]}
            pointerEvents="none"
          />

          <Animated.View style={[styles.center, pauseStyle]} pointerEvents="none">
            <View style={styles.playDisc}>
              <PlayIcon color={color.moon} />
            </View>
          </Animated.View>

          {burst}
        </View>
      </GestureDetector>

      <View style={[styles.info, { bottom: bottomSpace + space.lg }]} pointerEvents="box-none">
        {artistButton}
        <Text style={styles.title}>{clip.title}</Text>
        <Text style={styles.meta}>{meta}</Text>
        {source && videoFailed && (
          <Pressable
            onPress={() => Linking.openURL(watchUrl(source)).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel="Video unavailable here. Watch on YouTube"
            hitSlop={8}
            style={({ pressed }) => [styles.notice, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.noticeText}>Video unavailable here. Watch on YouTube</Text>
          </Pressable>
        )}
      </View>

      <View style={[styles.rail, { bottom: bottomSpace + space.lg }]}>{actions(false)}</View>

      <View style={[styles.track, { bottom: bottomSpace - 2 }]} pointerEvents="none">
        <Animated.View style={[styles.progress, progressStyle]} />
      </View>
    </View>
  );
}

export const ClipCard = memo(ClipCardBase);

const shadow = { textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 10 } as const;

const styles = StyleSheet.create({
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  playDisc: {
    width: 84,
    height: 84,
    borderRadius: 42,
    paddingLeft: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,9,24,0.45)',
  },
  burst: { position: 'absolute', width: BURST, height: BURST },
  info: { position: 'absolute', left: space.xl, right: 96 },
  artistRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  artistText: { marginLeft: space.md, flex: 1 },
  name: { ...type.headline, color: color.moon, ...shadow },
  match: { ...type.label, color: color.glow, fontVariant: ['tabular-nums'], marginTop: 1, ...shadow },
  title: { ...type.title, fontSize: 22, lineHeight: 27, color: color.moon, marginTop: space.lg, ...shadow },
  meta: { ...type.body, color: color.moonDim, marginTop: space.xs, ...shadow },
  rail: { position: 'absolute', right: space.lg },
  track: {
    position: 'absolute',
    left: space.xl,
    right: space.xl,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  progress: { height: 2, backgroundColor: color.moon },
  notice: { alignSelf: 'flex-start', marginTop: space.sm },
  noticeText: { ...type.label, color: color.glow, ...shadow },

  // Real footage: video, then the clip, then the actions, stacked and centred between header and tab bar.
  dim: { backgroundColor: 'rgba(6,5,16,0.62)' },
  stack: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  player: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  videoTrack: {
    height: 2,
    borderRadius: 1,
    marginTop: space.sm,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  videoInfo: { alignSelf: 'stretch', paddingHorizontal: space.xl, marginTop: space.xl },
  credit: { ...type.caption, color: color.moonFaint, marginTop: space.sm },
  videoActions: { marginTop: space.xxl },
});
