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
import { ArtistAvatar, artistColors } from '../../components/ArtistAvatar';
import { ChevronIcon, FestivalsIcon, ShareIcon } from '../../components/TabIcons';
import { APP_NAME } from '../../config/app';
import { setFor } from '../../data/festival';
import type { Artist, Clip, Festival } from '../../data/types';
import { partnersOf, titleWithoutPartners, together } from '../../data/b2b';
import { haptic } from '../../lib/haptics';
import { useAutoplay } from '../../state/autoplay';
import { useCatalog } from '../../state/catalog';
import { useCommunity } from '../../state/community';
import { useReactions } from '../../state/reactions';
import { useSocial } from '../../state/social';
import { useTaste } from '../../state/taste';
import { describeSet } from '../festivals/format';
import { ticketLine } from '../festivals/links';
import { useGoing } from '../../state/going';
import { useToday } from '../../lib/useToday';
import { showAlert } from '../../lib/dialog';
import { takeNotForMeTip } from '../../state/notForMeTip';
import { StarIcon } from '../plan/icons';
import { addPlayed, excuseWatch, startWatch, watchOf, type WatchSession } from '../taste/watch';
import { color, glowA, motion, radius, space, type, nightA } from '../../theme/tokens';
import { GlassFill } from '../../components/LiquidGlass';
import { ActionRail } from './ActionRail';
import { AUTOPLAY_COUNTDOWN_SEC, countdownTick, passFinished } from './autoplay';
import { UpNextPill } from './UpNextPill';
import { AmbientBackdrop } from './AmbientBackdrop';
import { ClipPlayer } from './ClipPlayer';
import { EdgeGlow } from '../../components/EdgeGlow';
import { showsGlow } from '../standing/standing';
import { useStanding } from '../standing/useStanding';
import { type FeedPager, usePlayerSwipe } from './feedPager';
import { HeartIcon, PlayIcon } from './icons';
import { clipMedia } from './media';
import { clipShareText } from './share';
import { communityMenu } from '../community/menu';
import { flagMenu } from './flagMenu';
import { useClipFlags } from '../../state/clipFlags';
import { useSprouts } from '../../state/sprouts';
import { Collectible } from '../sprouts/Collectible';
import { artistLook } from '../sprouts/artistLook';
import { tierLabel } from '../sprouts/artistSprouts';
import { shouldPlay } from './playback';
import { StageScene } from './StageScene';
import { markUnplayable } from './unplayable';
import { fillsScreen, MIN_PLAYER, tallLayout } from './videoLayout';
import { useSendOrShare } from '../messages/useSendOrShare';
import { ToeGlyph } from '../toes/Toe';
import { useToes } from '../toes/useToes';
import { useCommentCount } from '../social/useCommentCount';
import { commentCaption } from '../social/copy';
import { t } from '../../i18n';
import { crowdPlace, shownClipTitle } from '../community/clips';
import { TrackLine } from '../memories/TrackLine';
import { OrgWatermark } from '../organizers/OrgWatermark';
import { eventPath } from '../festivalMode/showEvent';
import { useEventLookup } from '../festivalMode/useEvent';

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
  /** Where it is in the feed: handed back to `onSkip` and `onNext`, so the feed can pass the same functions to every clip. */
  index: number;
  onSkip: (index: number) => void;
  /** Move on to the next clip by itself (after a clip is watched to the end), without counting it as a skip. */
  onNext?: (index: number) => void;
  /** Press and hold: add your own video. */
  onHold?: () => void;
  /** Extra room under the header (your crew's stories), so nothing ever sits over the player. */
  topExtra?: number;
};

const BURST = 110;
/** How long to hold before adding a video starts. */
const HOLD_MS = 450;
/** Room a SoundCloud card keeps under its player for the artist, title, credit and buttons. */
const SOUNDCLOUD_ROOM = 250;
/** Starts below the feed's festival header and its fade, so nothing ever sits over the player. */
const HEADER_CLEARANCE = 100;

/** "LAYZ b2b KOMPANY": each name opens that artist's page. */
function B2bNames({ players, onOpen }: { players: readonly Artist[]; onOpen: (id: string) => void }) {
  return players.map((a, i) => (
    <Text key={a.id}>
      {i > 0 ? <Text style={styles.b2b}>{' b2b '}</Text> : null}
      <Text onPress={() => onOpen(a.id)} accessibilityRole="link" accessibilityLabel={t('Open {artist}', { artist: a.name })}>
        {a.name}
      </Text>
    </Text>
  ));
}

function ClipCardBase({ clip, note, festival, mustSee, width, height, isActive, live, isNear, bottomSpace, pager, index, onSkip, onNext, onHold, topExtra = 0 }: Props) {
  const catalog = useCatalog();
  const lookupEvent = useEventLookup();
  const artist = catalog.artist(clip.artistId);
  const reduceMotion = useReducedMotion();
  const { get, setLiked, toggleSaved, markSkipped, recordWatch } = useReactions();
  const reaction = get(clip.id);
  const { taste } = useTaste();
  const { isGoing } = useGoing();
  const today = useToday();
  const [paused, setPaused] = useState(false);
  // Plays only while on screen, with Discover visible and the app in the foreground.
  const playing = shouldPlay({ active: isActive, live }, paused);
  const insets = useSafeAreaInsets();
  // A double-tap leaves a toe print instead of a heart, for one person only.
  const toes = useToes();

  // Real footage when the clip has playable media; the stage when it doesn't or the video fails.
  const media = useMemo(() => clipMedia(clip, artist?.imageUrl), [clip, artist?.imageUrl]);
  // An artist's SoundCloud page: their uploads in SoundCloud's own player.
  const page = media?.provider === 'soundcloud' ? media : undefined;
  // A community clip (someone's shared video): credited to them, with Report / Hide / Block.
  const community = media?.provider === 'video' ? media.community : undefined;
  // The edge glow: on every video, unless the person who filmed a crowd video has Afterglow Plus.
  const filmer = useStanding(community?.uid);
  const glow = !!media && showsGlow(filmer);
  const communityState = useCommunity();
  const clipFlags = useClipFlags();
  const { artists: collectibles } = useSprouts();
  const social = useSocial();
  const sendOrShare = useSendOrShare();
  // Comments: a shared video keeps its own (on the video); every other clip has the clip's.
  const commentTarget = useMemo(
    () => (community ? { kind: 'video' as const, id: community.sharedId } : { kind: 'clip' as const, id: clip.id }),
    [community, clip.id],
  );
  const commentCount = useCommentCount(commentTarget, isNear || isActive);
  const { remember } = communityState;
  // So your reactions keep counting for the artist after this clip leaves the feed.
  const reacted = reaction.liked || reaction.skipped || !!reaction.watched;
  // A liked one is also kept whole, so Your clips can list and play it later.
  useEffect(() => {
    if (community && (isActive || reacted)) remember(clip, reaction.liked);
  }, [isActive, reacted, reaction.liked, community, clip, remember]);
  const [videoFailed, setVideoFailed] = useState(false);
  const showVideo = !!media && !videoFailed;
  const failVideo = useCallback(() => {
    markUnplayable(clip.id);
    setVideoFailed(true);
  }, [clip.id]);
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
      clock.set(0);
      // After this render, so coming into view never re-renders in the middle of one.
      void Promise.resolve().then(() => setPaused(false));
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
    const timer = setTimeout(() => {
      const step = countdownTick(upNext);
      setUpNext(step === 'next' ? null : step);
      if (step === 'next') onNextRef.current?.(index);
    }, 1000);
    return () => clearTimeout(timer);
  }, [upNext, playing, index]);
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
    burstScale.set(withSequence(withTiming(0, { duration: 0 }), withSpring(1, motion.bloom)));
    burstOpacity.set(withSequence(withTiming(1, { duration: 60 }), withDelay(420, withTiming(0, { duration: 260 }))));
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
  // A back to back: everyone playing, shown together, matched by the one you like best.
  const players = [artist, ...partnersOf(clip).map((id) => catalog.artist(id)).filter((a): a is Artist => !!a && a.id !== artist.id)];
  const shown = together(players) ?? artist;
  const pct = Math.round(Math.max(...players.map((a) => taste[a.id] ?? 0)) * 100);
  // Where the artist plays next (the festival you're discovering, or one you're going to), as a ticket;
  // without one, the clip's own festival in plain words.
  const ticket = festival ? ticketLine(festival, artist.id, isGoing(festival.id), today) : undefined;
  const context = ticket ? festival : undefined;
  const own = catalog.festival(clip.festivalId);
  const ownSet = own && setFor(own, artist.id);
  // Every card leads with where it was filmed, then the artist, then where they play next. A crowd video's place is
  // its festival, show or throwback (no "From the crowd"); a YouTube or SoundCloud set's is its festival on Afterglow,
  // or else its own title ("Live at Red Rocks 2025").
  const title = community
    ? crowdPlace(clip.title, own?.name)
    : (own?.name ?? shownClipTitle(players.length > 1 ? titleWithoutPartners(clip.title, players.slice(1).map((a) => a.name)) : clip.title));
  // Their set there (day, time, stage) when there's no ticket to show; the festival's name is already the title.
  const meta = community ? '' : own && ownSet ? describeSet(own, ownSet) : '';
  // When the place is a festival or show on Afterglow, it opens every video from there.
  const place = title ? lookupEvent(clip.festivalId) : undefined;
  const placeTitle = (lines?: number) =>
    title ? (
      place ? (
        <Pressable
          onPress={() => {
            haptic.select();
            // Going to look at the place isn't passing on this video.
            if (watch.current) watch.current = excuseWatch(watch.current);
            router.push({ pathname: '/videos/[id]', params: { id: place.id } });
          }}
          accessibilityRole="link"
          accessibilityLabel={t('{place}. Opens every video filmed there.', { place: title })}
          hitSlop={6}
          style={({ pressed }) => [styles.placeRow, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.title, styles.placeTitle]} numberOfLines={lines}>
            {title}
          </Text>
          <Text style={styles.placeChevron}>›</Text>
        </Pressable>
      ) : (
        <Text style={[styles.title, styles.placeTitle, styles.placeAlone]} numberOfLines={lines}>
          {title}
        </Text>
      )
    ) : null;

  const openArtist = (id: string) => {
    haptic.select();
    // Curious enough to look them up: a short watch isn't passing on it.
    if (watch.current) watch.current = excuseWatch(watch.current);
    // In the festival's context, so you can star them as a must-see there.
    router.push({ pathname: '/artist/[id]', params: { id, festival: context?.id } });
  };
  // Their collectible, when it's yours: a little badge by their name.
  const mineSprout = collectibles.find((a) => a.artistId === artist.id);
  const artistButton = (
    <Pressable
      onPress={() => openArtist(artist.id)}
      accessibilityRole="button"
      accessibilityLabel={note ? t('Open {artist}, {pct} percent match, {note}', { artist: shown.name, pct, note }) : t('Open {artist}, {pct} percent match', { artist: shown.name, pct })}
      hitSlop={8}
      style={({ pressed }) => [styles.artistRow, pressed && { opacity: 0.7 }]}
    >
      <ArtistAvatar artist={shown} size={40} />
      <View style={styles.artistText}>
        <Text style={styles.name} numberOfLines={2}>
          {players.length > 1 ? <B2bNames players={players} onOpen={openArtist} /> : artist.name}
        </Text>
        <Text style={styles.match} numberOfLines={1}>
          {t('{pct}% match', { pct })}
          {note ? <Text style={styles.note}>{`  ·  ${note}`}</Text> : null}
        </Text>
        {mineSprout ? (
          <View style={styles.mine} accessible accessibilityLabel={t('Your {artist} collectible: {level}', { artist: artist.name, level: tierLabel(mineSprout) })}>
            <Collectible look={artistLook(artist)} tier={mineSprout.tier} shiny={!!mineSprout.shiny} size={20} still />
            <Text style={styles.mineText} numberOfLines={1}>
              {tierLabel(mineSprout)}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );

  // Where they play next: a ticket that opens the festival, with its lineup and your plan.
  const metaLine = (singleLine: boolean) =>
    context && ticket ? (
      <Pressable
        onPress={() => {
          haptic.select();
          router.push(eventPath(context));
        }}
        accessibilityRole="button"
        accessibilityLabel={
          mustSee
            ? t('{title}, {detail}, one of your must sees. Opens the festival.', { title: ticket.title, detail: ticket.detail })
            : t('{title}, {detail}. Opens the festival.', { title: ticket.title, detail: ticket.detail })
        }
        hitSlop={6}
        style={({ pressed }) => [styles.ticket, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
        testID="clip-ticket"
      >
        <View style={styles.ticketIcon}>
          <FestivalsIcon color={color.glow} size={17} />
        </View>
        <View style={styles.ticketText}>
          <Text style={styles.ticketTitle} numberOfLines={1}>
            {ticket.title}
          </Text>
          <View style={styles.ticketDetailRow}>
            {mustSee && <StarIcon color={color.glow} filled size={11} />}
            <Text style={styles.ticketDetail} numberOfLines={singleLine ? 1 : 2}>
              {ticket.detail}
            </Text>
          </View>
        </View>
        <ChevronIcon color={color.moonFaint} size={11} />
      </Pressable>
    ) : meta ? (
      <Text style={styles.meta} numberOfLines={singleLine ? 1 : undefined}>
        {meta}
      </Text>
    ) : null;

  const actions = (horizontal: boolean) => (
    <ActionRail
      horizontal={horizontal}
      liked={reaction.liked}
      saved={reaction.saved}
      onLike={() => {
        const next = !reaction.liked;
        if (next) haptic.tap();
        else haptic.select();
        setLiked(clip.id, next);
      }}
      onSave={
        community
          ? undefined
          : () => {
              if (reaction.saved) haptic.select();
              else haptic.tap();
              toggleSaved(clip.id);
            }
      }
      onSkip={() => {
        haptic.soft();
        markSkipped(clip.id);
        onSkip(index);
        // The first time: your no counts, so say how.
        void takeNotForMeTip().then((first) => {
          if (first)
            showAlert(
              t('Noted, less like this'),
              t('Not for me tells {app} you didn’t like this one. You’ll see less of {artist} and sounds like theirs, and their match goes down. Likes do the opposite.', { app: APP_NAME, artist: shown.name }),
              [{ text: t('Got it') }],
            );
        });
      }}
      filmer={
        community && media
          ? {
              uid: community.uid,
              handle: community.handle,
              label: t('{credit}. Opens their profile.', { credit: media.credit }),
              onPress: () => {
                haptic.select();
                if (watch.current) watch.current = excuseWatch(watch.current);
                router.push({ pathname: '/u/[handle]', params: { handle: community.handle } });
              },
            }
          : undefined
      }
      comments={{
        caption: commentCaption(commentCount),
        label: commentCount ? t('Comments, {n}', { n: commentCount }) : t('Comments'),
        onPress: () => {
          haptic.select();
          // Stopping to read what people said isn't passing on it.
          if (watch.current) watch.current = excuseWatch(watch.current);
          router.push(
            commentTarget.kind === 'video'
              ? { pathname: '/comments/[id]', params: { id: commentTarget.id } }
              : { pathname: '/comments/[id]', params: { id: commentTarget.id, kind: 'clip' } },
          );
        },
      }}
    />
  );

  const burst = (
    <Animated.View
      pointerEvents="none"
      style={[styles.burst, { left: burstAt.x - BURST / 2, top: burstAt.y - BURST / 2 }, burstStyle]}
    >
      {toes ? <ToeGlyph size={BURST * 0.85} color={color.glow} /> : <HeartIcon color={color.glow} size={BURST} filled />}
    </Animated.View>
  );

  if (media && showVideo) {
    const top = insets.top + HEADER_CLEARANCE + topExtra;
    const bottom = bottomSpace + space.lg;
    const tall = media.vertical ? tallLayout({ width, height, top, bottom }) : undefined;
    const stackedWidth = width - space.lg * 2;
    const frame = tall
      ? tall.player
      : page
        ? // SoundCloud's big-picture player: up to square, leaving room for the card's words and buttons.
          { w: stackedWidth, h: Math.max(MIN_PLAYER, Math.min(stackedWidth, height - top - bottom - SOUNDCLOUD_ROOM)) }
        : { w: stackedWidth, h: Math.max(MIN_PLAYER, Math.round((stackedWidth * 9) / 16)) };

    // The player takes its own taps; a vertical swipe on it still moves the feed. The edge glow sits just
    // outside it (never over a YouTube picture); videos filmed with the app also carry the AFTERGLOW label.
    const player = (
      <View style={{ width: frame.w, height: frame.h }}>
        {glow ? <EdgeGlow width={frame.w} height={frame.h} radius={radius.md + 3} inset={-3} label={!!community} active={playing} /> : null}
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
      {/* A video an event organizer posted carries its logo, faintly. */}
      {community ? <OrgWatermark uid={community.uid} size={18} style={{ top: space.sm, right: space.sm }} /> : null}
      </View>
    );
    const track = (
      <View style={[styles.videoTrack, { width: frame.w }]} pointerEvents="none">
        <Animated.View style={[styles.progress, videoProgressStyle]} />
      </View>
    );
    const info = (
      <>
        {upNextPill}
        {placeTitle(tall ? 1 : undefined)}
        {artistButton}
        {community?.track ? <TrackLine track={community.track} /> : null}
        {community ? null : metaLine(!!tall)}
        {community ? (
          // Who filmed it is their photo on the rail; the menu sits beside where they play.
          <View style={styles.metaWithMore}>
            <View style={styles.metaShrink}>{metaLine(!!tall)}</View>
            <Pressable
              onPress={() =>
                communityMenu(community, { report: social.report, hide: communityState.hide, block: social.setBlocked })
              }
              accessibilityRole="button"
              accessibilityLabel={t('More: report, hide or block @{handle}', { handle: community.handle })}
              hitSlop={12}
              style={({ pressed }) => [styles.moreButton, pressed && { opacity: 0.6, transform: [{ scale: 0.92 }] }]}
            >
              <Text style={styles.more}>•••</Text>
            </Pressable>
          </View>
        ) : page ? (
          <View style={styles.creditRow}>
            <Pressable
              onPress={() => {
                haptic.select();
                Linking.openURL(page.externalUrl).catch(() => {});
              }}
              accessibilityRole="link"
              accessibilityLabel={t('Open {artist} on SoundCloud', { artist: artist.name })}
              hitSlop={6}
              style={({ pressed }) => [styles.creditText, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.credit} numberOfLines={1}>
                {`${page.externalUrl.replace(/^https:\/\//, '')} ↗`}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                haptic.select();
                sendOrShare({ kind: 'artist', id: artist.id }, clipShareText(artist.name, clip.title, page.externalUrl, context, APP_NAME));
              }}
              accessibilityRole="button"
              accessibilityLabel={t('Share {artist} on SoundCloud', { artist: artist.name })}
              hitSlop={12}
              style={({ pressed }) => [styles.share, pressed && { opacity: 0.6, transform: [{ scale: 0.92 }] }]}
            >
              <ShareIcon color={color.moonDim} size={15} />
            </Pressable>
            <Pressable
              onPress={() => flagMenu(clip, artist.name, page.externalUrl, clipFlags)}
              accessibilityRole="button"
              accessibilityLabel={t("Something wrong with {artist}'s SoundCloud page? Hide it or report it", { artist: artist.name })}
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
              sendOrShare({ kind: 'clip', id: clip.id }, clipShareText(artist.name, clip.title, media.externalUrl, context, APP_NAME));
            }}
            accessibilityRole="button"
            accessibilityLabel={t('Share this clip of {artist}', { artist: artist.name })}
            hitSlop={12}
            style={({ pressed }) => [styles.share, pressed && { opacity: 0.6, transform: [{ scale: 0.92 }] }]}
          >
            <ShareIcon color={color.moonDim} size={15} />
          </Pressable>
          <Pressable
            onPress={() => flagMenu(clip, artist.name, media.externalUrl, clipFlags)}
            accessibilityRole="button"
            accessibilityLabel={t('Something wrong with this clip of {artist}? Hide it or report it', { artist: artist.name })}
            hitSlop={12}
            style={({ pressed }) => [styles.share, pressed && { opacity: 0.6, transform: [{ scale: 0.92 }] }]}
          >
            <Text style={styles.more}>•••</Text>
          </Pressable>
        </View>
        ) : null}
      </>
    );

    if (fillsScreen(media)) {
      // A crowd video filmed upright: edge to edge, the clip info and buttons over the bottom, like TikTok.
      return (
        <View style={{ width, height }}>
          <GestureDetector gesture={surface}>
            <View style={StyleSheet.absoluteFill}>
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
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
              <LinearGradient colors={['rgba(3,2,10,0.7)', 'rgba(3,2,10,0)']} style={[styles.topFade, { height: top + 40 }]} pointerEvents="none" />
              <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(3,2,10,0.82)']} style={[styles.scrim, { height: height * 0.5 }]} pointerEvents="none" />
              <Animated.View style={[styles.center, pauseStyle]} pointerEvents="none">
                <View style={styles.playDisc}>
                  <GlassFill radius={42} tint={0.35} frost={false} />
                  <View pointerEvents="none">
                    <PlayIcon color={color.moon} />
                  </View>
                </View>
              </Animated.View>
              {burst}
            </View>
          </GestureDetector>
          {/* Filmed with Afterglow: the edge glow around the screen, with the word on the right. */}
          {glow ? <EdgeGlow width={width} height={height} radius={44} inset={4} label active={playing} /> : null}
          <View style={[styles.info, { bottom: bottomSpace + space.lg }]} pointerEvents="box-none">
            {info}
          </View>
          <View style={[styles.rail, { bottom: bottomSpace + space.lg }]}>{actions(false)}</View>
          <View style={[styles.track, { bottom: bottomSpace - 2 }]} pointerEvents="none">
            <Animated.View style={[styles.progress, videoProgressStyle]} />
          </View>
        </View>
      );
    }

    return (
      <View style={{ width, height }}>
        {/* The video's own colours glow out to the edges. Taps here pause, double-taps like; the player takes its own touches. */}
        <GestureDetector gesture={surface}>
          <View style={StyleSheet.absoluteFill}>
            {media.posterUrl ? (
              <AmbientBackdrop uri={media.posterUrl} playing={playing} reduceMotion={reduceMotion} />
            ) : (
              // A SoundCloud page with no picture anywhere: the artist's own colours.
              <LinearGradient colors={[artistColors(artist.id, artist.color)[0], color.night]} style={StyleSheet.absoluteFill} />
            )}
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
              <GlassFill radius={42} tint={0.35} frost={false} />
              <View pointerEvents="none">
                <PlayIcon color={color.moon} />
              </View>
            </View>
          </Animated.View>

          {burst}
        </View>
      </GestureDetector>

      <View style={[styles.info, { bottom: bottomSpace + space.lg }]} pointerEvents="box-none">
        {upNextPill}
        {placeTitle()}
        {artistButton}
        {metaLine(false)}
        {media?.provider === 'video' && videoFailed && <Text style={styles.noticeText}>{t('This video isn’t available right now.')}</Text>}
        {media?.provider === 'soundcloud' && videoFailed && (
          <Pressable
            onPress={() => Linking.openURL(media.externalUrl).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel={t("SoundCloud isn't playing here. Listen on SoundCloud")}
            hitSlop={8}
            style={({ pressed }) => [styles.notice, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.noticeText}>{t('SoundCloud isn’t playing here. Listen on SoundCloud')}</Text>
          </Pressable>
        )}
        {media?.provider === 'youtube' && videoFailed && (
          <Pressable
            onPress={() => Linking.openURL(media.externalUrl).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel={t('Video unavailable here. Watch on YouTube')}
            hitSlop={8}
            style={({ pressed }) => [styles.notice, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.noticeText}>{t('Video unavailable here. Watch on YouTube')}</Text>
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
  mine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  mineText: { ...type.caption, fontSize: 11, color: 'rgba(255,229,138,0.9)', fontWeight: '600' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  topFade: { position: 'absolute', left: 0, right: 0, top: 0 },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  playDisc: {
    width: 84,
    height: 84,
    borderRadius: 42,
    paddingLeft: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burst: { position: 'absolute', width: BURST, height: BURST },
  info: { position: 'absolute', left: space.xl, right: 96 },
  // Kept inside the column, so a long "why" line never runs under the buttons beside it.
  artistRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', maxWidth: '100%' },
  artistText: { marginLeft: space.md, flex: 1, flexShrink: 1 },
  name: { ...type.headline, color: color.moon, ...shadow },
  b2b: { color: color.moonDim, fontWeight: '400' },
  match: { ...type.label, color: color.glow, fontVariant: ['tabular-nums'], marginTop: 1, ...shadow },
  note: { color: color.moonDim, fontWeight: '500' },
  title: { ...type.title, fontSize: 22, lineHeight: 27, color: color.moon, marginTop: space.lg, ...shadow },
  // A crowd video's place, above the artist.
  placeRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.xs, maxWidth: '100%', marginBottom: space.md },
  placeTitle: { marginTop: 0, flexShrink: 1 },
  placeAlone: { marginBottom: space.md },
  placeChevron: { ...type.title, fontSize: 22, lineHeight: 27, color: color.moonDim, ...shadow },
  meta: { ...type.body, color: color.moonDim, marginTop: space.xs, ...shadow },
  ticket: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: space.sm,
    marginTop: space.md,
    paddingLeft: space.sm,
    paddingRight: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: nightA(0.5),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  ticketIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glowA(0.16),
  },
  ticketText: { flexShrink: 1 },
  ticketTitle: { ...type.label, color: color.moon },
  ticketDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  ticketDetail: { ...type.caption, color: color.moonDim, flexShrink: 1 },
  metaWithMore: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  metaShrink: { flexShrink: 1 },
  moreButton: { marginLeft: 'auto', paddingHorizontal: space.xs, paddingBottom: space.sm },
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
