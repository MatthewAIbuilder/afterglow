import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
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
import { ChevronIcon, ShareIcon } from '../../components/TabIcons';
import { APP_NAME } from '../../config/app';
import { setFor } from '../../data/festival';
import type { Clip, Festival } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { useAutoplay } from '../../state/autoplay';
import { useCatalog } from '../../state/catalog';
import { useCommunity } from '../../state/community';
import { useReactions } from '../../state/reactions';
import { useSocial } from '../../state/social';
import { useTaste } from '../../state/taste';
import { describeSet } from '../festivals/format';
import { festivalLine } from '../festivals/links';
import { StarIcon } from '../plan/icons';
import { addPlayed, excuseWatch, startWatch, watchOf, type WatchSession } from '../taste/watch';
import { color, motion, radius, space, type } from '../../theme/tokens';
import { ActionRail } from './ActionRail';
import { AUTOPLAY_COUNTDOWN_SEC, countdownTick, passFinished } from './autoplay';
import { UpNextPill } from './UpNextPill';
import { AmbientBackdrop } from './AmbientBackdrop';
import { ClipPlayer } from './ClipPlayer';
import { type FeedPager, usePlayerSwipe } from './feedPager';
import { HeartIcon, PlayIcon } from './icons';
import { clipMedia } from './media';
import { clipShareText } from './share';
import { communityMenu } from '../community/menu';
import { flagMenu } from './flagMenu';
import { useClipFlags } from '../../state/clipFlags';
import { shouldPlay } from './playback';
import { StageScene } from './StageScene';
import { MIN_PLAYER, tallLayout } from './videoLayout';
import { shareMessage } from '../../lib/share';

type Props = {
  clip: Clip;
  /** Why this clip is in your feed, in a few words (from the recommendation layer). Strong matches have none. */
  note?: string;
  /** The festival Discover is focused on. The clip shows the artist's place there and links to it. */
  festival?: Festival;
  /** You starred this artist as a must-see at that festival. */
  mustSee?: boolean;
  width: number;
  height: number;
  isActive: boolean;
  /** Active, Discover visible and the app in the foreground. Nothing plays unless this is true. */
  live: boolean;
  /** On screen or next to it: real footage loads ahead so a swipe lands on a ready player. */
  isNear: boolean;
  /** Space reserved at the bottom for the floating tab bar. */
  bottomSpace: number;
  /** Lets a vertical swipe on the video move the feed. */
  pager: FeedPager;
  onSkip: () => void;
  /** Move on to the next clip by itself (after a clip is watched to the end), without counting it as a skip. */
  onNext?: () => void;
  /** Press and hold: add your own video. */
  onHold?: () => void;
  /** Extra room under the header (your crew's stories), so nothing ever sits over the player. */
  topExtra?: number;
};

const BURST = 110;
/** How long to hold before adding a video starts. */
const HOLD_MS = 450;
/** Starts below the feed's festival header and its fade, so nothing ever sits over the player. */
const HEADER_CLEARANCE = 100;

function ClipCardBase({ clip, note, festival, mustSee, width, height, isActive, live, isNear, bottomSpace, pager, onSkip, onNext, onHold, topExtra = 0 }: Props) {
  const catalog = useCatalog();
  const artist = catalog.artist(clip.artistId);
  const reduceMotion = useReducedMotion();
  const { get, setLiked, toggleSaved, markSkipped, recordWatch } = useReactions();
  const reaction = get(clip.id);
  const { taste } = useTaste();
  const [paused, setPaused] = useState(false);
  // Plays only while on screen, with Discover visible and the app in the foreground.
  const playing = shouldPlay({ active: isActive, live }, paused);
  const insets = useSafeAreaInsets();

  // Real footage when the clip has playable media; the stage when it doesn't or the video fails.
  const media = useMemo(() => clipMedia(clip), [clip]);
  // A community clip (someone's shared video): credited to them, with Report / Hide / Block.
  const community = media?.provider === 'video' ? media.community : undefined;
  const communityState = useCommunity();
  const clipFlags = useClipFlags();
  const social = useSocial();
  const { remember } = communityState;
  // So your reactions keep counting for the artist after this clip leaves the feed.
  const reacted = reaction.liked || reaction.skipped || !!reaction.watched;
  // A liked one is also kept whole, so Your clips can list and play it later.
  useEffect(() => {
    if (community && (isActive || reacted)) remember(clip, reaction.liked);
  }, [isActive, reacted, reaction.liked, community, clip, remember]);
  const [videoFailed, setVideoFailed] = useState(false);
  const showVideo = !!media && !videoFailed;
  const failVideo = useCallback(() => setVideoFailed(true), []);
  const playerSwipe = usePlayerSwipe(pager);
  const videoProgress = useSharedValue(0);
  const videoProgressStyle = useAnimatedStyle(() => ({ width: `${videoProgress.value * 100}%` }));

  // How this visit to the clip is being watched. Only real footage counts, and
  // only what the player reports as played while live; see features/taste/watch.
  const watch = useRef<WatchSession | null>(null);

  // Watched to the end: count down, then glide to the next clip, unless you stay (or pause).
  const autoplay = useAutoplay();
  const [upNext, setUpNext] = useState<number | null>(null);
  const [stayed, setStayed] = useState(false);
  // A new visit to the clip starts fresh; pausing during the countdown means you're staying.
  const [visitActive, setVisitActive] = useState(isActive);
  if (visitActive !== isActive) {
    setVisitActive(isActive);
    setUpNext(null);
    setStayed(false);
  }
  if (paused && upNext !== null) {
    setUpNext(null);
    setStayed(true);
  }
  // The feed passes a fresh function each render; keep the latest without restarting the countdown.
  const onNextRef = useRef(onNext);
  useEffect(() => {
    onNextRef.current = onNext;
  }, [onNext]);
  const canNext = !!onNext;
  const finishPass = useCallback(() => {
    if (!autoplay.enabled || stayed || !canNext) return;
    setUpNext((n) => n ?? AUTOPLAY_COUNTDOWN_SEC);
  }, [autoplay.enabled, stayed, canNext]);
  const stay = useCallback(() => {
    haptic.select();
    setStayed(true);
    setUpNext(null);
  }, []);

  const lengthSec = media?.lengthSec ?? 0;
  const onPlayed = useCallback(
    (from: number, to: number) => {
      if (watch.current) watch.current = addPlayed(watch.current, from, to);
      if (passFinished(to, lengthSec)) finishPass();
    },
    [lengthSec, finishPass],
  );
  const wasActive = useRef(false);
  useEffect(() => {
    if (isActive && !wasActive.current) watch.current = media ? startWatch(media.lengthSec) : null;
    if (!isActive && wasActive.current && watch.current) {
      // Swiped away (or skipped): the visit is over, and how it went is a quiet signal.
      const w = watchOf(watch.current);
      if (w) recordWatch(clip.id, w);
      watch.current = null;
    }
    wasActive.current = isActive;
  }, [isActive, media, clip.id, recordWatch]);
  // Leaving Discover mid-clip isn't passing on it.
  useEffect(() => {
    if (isActive && !live && watch.current && watch.current.playedSec > 0) watch.current = excuseWatch(watch.current);
  }, [isActive, live]);

  // One clock drives the light show and the progress bar, so pausing freezes both.
  const clock = useSharedValue(0);
  const frame = useFrameCallback((f) => {
    clock.value += f.timeSincePreviousFrame ?? 0;
  }, false);

  useEffect(() => {
    frame.setActive(playing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Every time a clip comes into view it starts from the top.
  useEffect(() => {
    if (isActive) {
      clock.value = 0;
      setPaused(false);
    }
  }, [isActive, clock]);

  // The drawn stage has no player: its own clock reaching the clip's length is a finished pass.
  const stageOnly = !showVideo;
  const stageMs = clip.durationSec * 1000;
  useAnimatedReaction(
    () => stageOnly && clock.value >= stageMs,
    (done, before) => {
      if (done && !before) runOnJS(finishPass)();
    },
    [stageOnly, stageMs, finishPass],
  );

  // The countdown runs only while the clip plays.
  useEffect(() => {
    if (upNext === null || !playing) return;
    const t = setTimeout(() => {
      const step = countdownTick(upNext);
      setUpNext(step === 'next' ? null : step);
      if (step === 'next') onNextRef.current?.();
    }, 1000);
    return () => clearTimeout(t);
  }, [upNext, playing]);
  const upNextPill = upNext !== null ? <UpNextPill left={upNext} onStay={stay} /> : null;

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

  // Press and hold anywhere around the clip to add your own video. It races the taps, so a tap never waits for it.
  const hold = Gesture.LongPress()
    .minDuration(HOLD_MS)
    .maxDistance(12)
    .enabled(!!onHold)
    .withTestId(`hold-${clip.id}`)
    .runOnJS(true)
    .onStart(() => {
      haptic.tap();
      setPaused(true);
      onHold?.();
    });
  const surface = Gesture.Race(hold, Gesture.Exclusive(doubleTap, singleTap));

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
  // The artist's place at the festival you're discovering; without a focus, the clip's own festival.
  const line = festival ? festivalLine(festival, artist.id) : undefined;
  const context = line ? festival : undefined;
  const own = catalog.festival(clip.festivalId);
  const ownSet = own && setFor(own, artist.id);
  const meta = line ?? (own && ownSet ? describeSet(own, ownSet) : (own?.name ?? ''));

  const artistButton = (
    <Pressable
      onPress={() => {
        haptic.select();
        // Curious enough to look them up: a short watch isn't passing on it.
        if (watch.current) watch.current = excuseWatch(watch.current);
        // In the festival's context, so you can star them as a must-see there.
        router.push({ pathname: '/artist/[id]', params: { id: artist.id, festival: context?.id } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`Open ${artist.name}, ${pct} percent match${note ? `, ${note}` : ''}`}
      hitSlop={8}
      style={({ pressed }) => [styles.artistRow, pressed && { opacity: 0.7 }]}
    >
      <ArtistAvatar artist={artist} size={40} />
      <View style={styles.artistText}>
        <Text style={styles.name} numberOfLines={1}>
          {artist.name}
        </Text>
        <Text style={styles.match} numberOfLines={1}>
          {pct}% match
          {note ? <Text style={styles.note}>{`  ·  ${note}`}</Text> : null}
        </Text>
      </View>
    </Pressable>
  );

  // Where they play: opens the festival, with its lineup and your plan.
  const metaLine = (singleLine: boolean) =>
    context ? (
      <Pressable
        onPress={() => {
          haptic.select();
          router.push(`/festival/${context.id}`);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${meta} at ${context.name}${mustSee ? ', one of your must sees' : ''}. Opens the festival.`}
        hitSlop={6}
        style={({ pressed }) => [styles.metaRow, pressed && { opacity: 0.7 }]}
      >
        {mustSee && <StarIcon color={color.glow} filled size={13} />}
        <Text style={[styles.meta, styles.metaInRow]} numberOfLines={singleLine ? 1 : undefined}>
          {meta}
        </Text>
        <ChevronIcon color={color.moonFaint} size={11} />
      </Pressable>
    ) : (
      <Text style={styles.meta} numberOfLines={singleLine ? 1 : undefined}>
        {meta}
      </Text>
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
      onSave={
        community
          ? undefined
          : () => {
              reaction.saved ? haptic.select() : haptic.tap();
              toggleSaved(clip.id);
            }
      }
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

  if (media && showVideo) {
    const top = insets.top + HEADER_CLEARANCE + topExtra;
    const bottom = bottomSpace + space.lg;
    const tall = media.vertical ? tallLayout({ width, height, top, bottom }) : undefined;
    const stackedWidth = width - space.lg * 2;
    const frame = tall
      ? tall.player
      : { w: stackedWidth, h: Math.max(MIN_PLAYER, Math.round((stackedWidth * 9) / 16)) };

    // The player takes its own taps; a vertical swipe on it still moves the feed.
    const player = (
      <GestureDetector gesture={playerSwipe}>
        <View style={[styles.player, { width: frame.w, height: frame.h }]}>
          <ClipPlayer
            media={media}
            load={isNear}
            active={isActive}
            live={live}
            paused={paused}
            progress={videoProgress}
            onPausedChange={setPaused}
            onPlayed={onPlayed}
            onFail={failVideo}
          />
        </View>
      </GestureDetector>
    );
    const track = (
      <View style={[styles.videoTrack, { width: frame.w }]} pointerEvents="none">
        <Animated.View style={[styles.progress, videoProgressStyle]} />
      </View>
    );
    const info = (
      <>
        {upNextPill}
        {artistButton}
        <Text style={styles.title} numberOfLines={tall ? 1 : undefined}>
          {clip.title}
        </Text>
        {metaLine(!!tall)}
        {community ? (
          <View style={styles.creditRow}>
            <Pressable
              onPress={() => {
                haptic.select();
                if (watch.current) watch.current = excuseWatch(watch.current);
                router.push({ pathname: '/u/[handle]', params: { handle: community.handle } });
              }}
              accessibilityRole="link"
              accessibilityLabel={`${media.credit}. Opens their profile.`}
              hitSlop={6}
              style={({ pressed }) => [styles.creditText, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.credit} numberOfLines={1}>
                {media.credit}
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                communityMenu(community, { report: social.report, hide: communityState.hide, block: social.setBlocked })
              }
              accessibilityRole="button"
              accessibilityLabel={`More: report, hide or block @${community.handle}`}
              hitSlop={12}
              style={({ pressed }) => [styles.share, pressed && { opacity: 0.6, transform: [{ scale: 0.92 }] }]}
            >
              <Text style={styles.more}>•••</Text>
            </Pressable>
          </View>
        ) : media.provider === 'youtube' ? (
        <View style={styles.creditRow}>
          <Text style={[styles.credit, styles.creditText]} numberOfLines={1}>
            {media.credit}
          </Text>
          <Pressable
            onPress={() => {
              haptic.select();
              void shareMessage(clipShareText(artist.name, clip.title, media.externalUrl, context, APP_NAME));
            }}
            accessibilityRole="button"
            accessibilityLabel={`Share this clip of ${artist.name}`}
            hitSlop={12}
            style={({ pressed }) => [styles.share, pressed && { opacity: 0.6, transform: [{ scale: 0.92 }] }]}
          >
            <ShareIcon color={color.moonDim} size={15} />
          </Pressable>
          <Pressable
            onPress={() => flagMenu(clip, artist.name, media.externalUrl, clipFlags)}
            accessibilityRole="button"
            accessibilityLabel={`Something wrong with this clip of ${artist.name}? Hide it or report it`}
            hitSlop={12}
            style={({ pressed }) => [styles.share, pressed && { opacity: 0.6, transform: [{ scale: 0.92 }] }]}
          >
            <Text style={styles.more}>•••</Text>
          </Pressable>
        </View>
        ) : null}
      </>
    );

    return (
      <View style={{ width, height }}>
        {/* The video's own colours glow out to the edges. Taps here pause, double-taps like; the player takes its own touches. */}
        <GestureDetector gesture={surface}>
          <View style={StyleSheet.absoluteFill}>
            <AmbientBackdrop uri={media.posterUrl} playing={playing} reduceMotion={reduceMotion} />
            {burst}
          </View>
        </GestureDetector>

        {tall ? (
          // Vertical footage: tall player with the rail beside it and the clip below. Nothing of ours overlaps it.
          <>
            <View style={[styles.abs, { left: tall.player.x, top: tall.player.y }]}>
              {player}
              {track}
            </View>
            <View style={[styles.abs, styles.railBox, { left: tall.rail.x, top: tall.rail.y, width: tall.rail.w }]}>
              {actions(false)}
            </View>
            <View
              style={[styles.abs, { left: tall.info.x, top: tall.info.y + space.sm, width: tall.info.w }]}
              pointerEvents="box-none"
            >
              {info}
            </View>
          </>
        ) : (
          <View style={[styles.stack, { top, bottom }]} pointerEvents="box-none">
            {player}
            {track}
            <View style={styles.videoInfo} pointerEvents="box-none">
              {info}
            </View>
            <View style={styles.videoActions}>{actions(true)}</View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={{ width, height }}>
      <GestureDetector gesture={surface}>
        <View style={StyleSheet.absoluteFill}>
          <StageScene
            artistId={artist.id}
            artistColor={artist.color}
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
        {upNextPill}
        {artistButton}
        <Text style={styles.title}>{clip.title}</Text>
        {metaLine(false)}
        {media?.provider === 'video' && videoFailed && <Text style={styles.noticeText}>This video isn’t available right now.</Text>}
        {media?.provider === 'youtube' && videoFailed && (
          <Pressable
            onPress={() => Linking.openURL(media.externalUrl).catch(() => {})}
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
  note: { color: color.moonDim, fontWeight: '500' },
  title: { ...type.title, fontSize: 22, lineHeight: 27, color: color.moon, marginTop: space.lg, ...shadow },
  meta: { ...type.body, color: color.moonDim, marginTop: space.xs, ...shadow },
  metaRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginTop: space.xs, maxWidth: '100%' },
  metaInRow: { marginTop: 0, flexShrink: 1 },
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
  stack: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  player: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  abs: { position: 'absolute' },
  railBox: { alignItems: 'center' },
  videoTrack: {
    height: 2,
    borderRadius: 1,
    marginTop: space.sm,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  videoInfo: { alignSelf: 'stretch', paddingHorizontal: space.xl, marginTop: space.xl },
  credit: { ...type.caption, color: color.moonFaint, marginTop: space.sm },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  creditText: { flex: 1 },
  share: { marginTop: space.sm, paddingHorizontal: space.xs },
  more: { ...type.caption, color: color.moonDim, letterSpacing: 1 },
  videoActions: { marginTop: space.xxl },
});
