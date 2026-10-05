import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, type ViewToken } from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  runOnUI,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { CameraIcon } from '../camera/icons';
import { OPEN_AT, PEEK_MAX, swipeOpens } from '../camera/record';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { ChevronIcon, SearchIcon } from '../../components/TabIcons';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { QuestButton } from '../quests/QuestButton';
import { haptic } from '../../lib/haptics';
import type { Clip, Festival } from '../../data/models';
import { isCommunityClip } from '../community/clips';
import { useCatalog } from '../../state/catalog';
import { useClipPool, useCommunityFeed } from '../../state/community';
import { useSocial } from '../../state/social';
import { useStoredFocus } from '../../state/discoverFocus';
import { useGoing } from '../../state/going';
import { usePlan } from '../../state/plan';
import { useHints } from '../../state/hints';
import { markCareTipDone, useCareTip } from '../../state/careTip';
import { useQuestTip } from '../../state/questTip';
import { useReactions } from '../../state/reactions';
import { useSeen } from '../../state/seen';
import { color, motion, space, type } from '../../theme/tokens';
import { ClipCard } from './ClipCard';
import { FeedEnd } from './FeedEnd';
import { FollowingEmpty } from './FollowingEmpty';
import { FeedHint } from './FeedHint';
import { CrewStories, STORIES_H } from '../crews/CrewStories';
import { TONIGHT_PILL_H, TonightPill } from '../tonight/TonightPill';
import { useTonight } from '../tonight/useTonight';
import { useCrewUpdates } from '../../state/crewUpdates';
import { useAddMemory } from '../memories/useAddMemory';
import { useMemories } from '../../state/memories';
import { alreadyKnown, CARE_HINT, currentHint, QUESTS_HINT } from './hints';
import type { FeedPager } from './feedPager';
import { defaultFocus } from '../festivals/links';
import { SOUND_LABEL } from '../../data/models';
import { HereEmpty } from '../festivalMode/HereEmpty';
import { useFestivalMode } from '../../state/festivalMode';
import { FOLLOWING, type Focus, hereFocus, MIX, mixContext, nextDiscoverFocus, soundOf, startFocus, TONIGHT } from './focus';
import { reasonNote } from '../recommend/copy';
import type { FeedItem } from '../recommend/feed';
import { clipPlayback } from './playback';
import { useFeedLive } from './useFeedLive';
import { useShake } from '../secrets/useShake';
import { revealSecret } from '../../state/secrets';
import { useRankedFeed } from './useRankedFeed';
import { ToeGlyph } from '../toes/Toe';
import { useToes } from '../toes/useToes';
import { allowClipSound } from '../../lib/audioSession';

/**
 * Full-screen vertical feed. One clip per page. Only the clip on screen plays,
 * and only while Discover is visible and the app is in the foreground. The
 * order comes from the recommendation layer (features/recommend/feed).
 *
 * Discover is focused on one festival and shows only artists on its lineup,
 * or on your mix: every clip, from every lineup. The header opens a picker.
 * A festival page can open it focused on that festival (`festival` param,
 * `mix` for the mix); jumping to a clip (`clip` param) moves the focus if
 * that artist doesn't play the current festival. It opens where you left it.
 */
export function DiscoverFeed() {
  // One phone-shaped column, even on a wide screen (a browser on a computer); phones are never wider than this.
  const screen = useWindowDimensions();
  const width = Math.min(screen.width, FEED_MAX_WIDTH);
  const height = screen.height;
  const insets = useSafeAreaInsets();
  const toes = useToes();
  const tabSpace = useTabBarSpace();
  const listRef = useAnimatedRef<FlatList<FeedItem>>();
  const [activeIndex, setActiveIndex] = useState(0);
  const activeRef = useRef(0);
  const feedLive = useFeedLive();
  // A secret: shake the phone on Discover for a light show (once every few seconds at most).
  const lastShow = useRef(0);
  useShake(feedLive, () => {
    if (Date.now() - lastShow.current < 5000) return;
    lastShow.current = Date.now();
    revealSecret('lightshow');
  });

  // Which festival's lineup you're discovering. Changes start the feed from the top.
  const { clip: requested, festival: focusParam } = useLocalSearchParams<{ clip?: string; festival?: string }>();
  // Clearing a handled param goes through this screen's own navigation: it works from the first render,
  // even when the app starts on a link (the global router isn't ready yet then).
  const navigation = useNavigation();
  const catalog = useCatalog();
  const { going, hydrated: goingLoaded } = useGoing();
  const { stored, save: saveFocus } = useStoredFocus();
  // Undecided until the saved focus and your festivals have loaded; then what you picked last, or where you're going.
  const [focusId, setFocusId] = useState<Focus | undefined>();
  const [decided, setDecided] = useState(false);
  // A clip from the catalogue, or a video from the crowd you liked (opened from Your clips).
  const pool = useClipPool();
  const requestedClip = requested ? pool.find(requested) : undefined;
  if (stored !== undefined && goingLoaded) {
    const base = decided ? focusId : startFocus(catalog.festivals, catalog.clips, going, stored);
    const target = nextDiscoverFocus(base, { festival: focusParam || undefined, clip: requestedClip }, catalog.festivals);
    if (!decided || target !== focusId) {
      setDecided(true);
      setFocusId(target);
      setActiveIndex(0);
    }
  }
  useEffect(() => {
    if (decided && focusId) saveFocus(focusId);
  }, [decided, focusId, saveFocus]);
  // Clips play with sound even with the iPhone's silent switch on (crowd videos always did).
  useEffect(() => allowClipSound(), []);
  // Festival mode: only videos people filmed at the festival you're at (your own choice of focus is kept for later).
  const hereFestival = useFestivalMode().active?.festival;
  const viewFocus = hereFestival ? hereFocus(hereFestival.id) : focusId;
  // A new feed (festival mode switching on or off changes it without a new focus): the first clip plays.
  const [shownFocus, setShownFocus] = useState(viewFocus);
  if (shownFocus !== viewFocus) {
    setShownFocus(viewFocus);
    setActiveIndex(0);
  }
  // Tonight's preview: who plays tonight at the festival you're at, in set order. Over (or never on): the festival logic below takes over.
  const tonight = useTonight();
  const tonightKey = tonight ? `${tonight.festival.id}|${tonight.night ?? ''}` : '';
  const [tonightFocus, setTonightFocus] = useState<{ key: string; value?: { festival: Festival; night?: string } }>({ key: '' });
  if (tonightFocus.key !== tonightKey) setTonightFocus({ key: tonightKey, value: tonight && { festival: tonight.festival, night: tonight.night } });
  const tonightOn = !hereFestival && focusId === TONIGHT && !!tonightFocus.value;
  const mix = !hereFestival && focusId === MIX;
  const followingFocus = !hereFestival && focusId === FOLLOWING;
  // One sound from every lineup ("Dubstep").
  const sound = hereFestival ? undefined : soundOf(focusId);
  const soundLabel = sound ? SOUND_LABEL[sound] : undefined;
  // These draw from every lineup: each clip is shown against a festival you're going to where the artist plays.
  const wide = mix || followingFocus || !!sound;
  // If the catalogue changes under us (a hosted file arrived) and the festival is gone, open the first one with clips.
  const festival =
    hereFestival ??
    (!decided || wide
      ? undefined
      : tonightOn
        ? tonightFocus.value!.festival
        : ((focusId ? catalog.festival(focusId) : undefined) ?? defaultFocus(catalog.festivals, catalog.clips)));
  // Cleared once handled, which waits for the focus to be decided.
  useEffect(() => {
    if (focusParam && decided) navigation.setParams({ festival: '' } as never);
  }, [focusParam, decided, navigation]);

  // Clips people at the festival shared to their profiles, beside the official ones (none when signed out or switched off).
  // In Following, they're the only clips: videos from the people you follow.
  const { clips: fetched, loaded: communityLoaded } = useCommunityFeed(mix || sound ? 'mix' : followingFocus ? 'following' : festival, !!hereFestival);
  const social = useSocial();
  // Videos from the crowd you opened from Your clips stay in the feed while you're on this focus
  // (unless you hide them or block who filmed them).
  const [opened, setOpened] = useState<{ focus: Focus | undefined; clips: Clip[] }>({ focus: undefined, clips: [] });
  if (requestedClip && isCommunityClip(requestedClip) && decided) {
    const same = opened.focus === focusId;
    if (!same || !opened.clips.some((c) => c.id === requestedClip.id)) setOpened({ focus: focusId, clips: [...(same ? opened.clips : []), requestedClip] });
  }
  // The one being asked for counts straight away, so it's ranked in with the first feed rather than after it.
  const asked = requestedClip && isCommunityClip(requestedClip) ? requestedClip : undefined;
  const community = useMemo(() => {
    const wanted = opened.focus === focusId ? [...opened.clips] : [];
    if (asked && !wanted.some((c) => c.id === asked.id)) wanted.push(asked);
    const extra = wanted.filter((c) => pool.find(c.id) && !fetched.some((f) => f.id === c.id));
    return extra.length ? [...fetched, ...extra] : fetched;
  }, [opened, focusId, asked, pool, fetched]);
  // Testing festival mode on an ordinary day, with nothing filmed there yet: the lineup's sets stand in, so there's something to see.
  const testing = useFestivalMode().active?.preview;
  const standIn = !!hereFestival && !!testing && communityLoaded && fetched.length === 0;
  const feed = useRankedFeed(
    activeIndex,
    hereFestival ? (standIn ? hereFestival : viewFocus) : mix ? MIX : followingFocus ? FOLLOWING : sound ? focusId : tonightOn ? TONIGHT : festival,
    community,
    tonightOn ? tonightFocus.value : undefined,
  );
  const { mustSeesAt } = usePlan();
  const count = feed?.length ?? 0;
  // After the last clip comes one more page: the end of the lineup (or of everything), with where to go next.
  const hasEnd = !hereFestival && (wide || !!festival) && count > 0;
  const pages = hasEnd ? count + 1 : count;

  // What you've had on screen, so the feed can hold it back next time.
  const { seen, markSeen, hydrated: seenLoaded } = useSeen();
  const activeId = feed?.[activeIndex]?.clip.id;
  useEffect(() => {
    if (activeId && feedLive) markSeen(activeId);
  }, [activeId, feedLive, markSeen]);

  // First-time tips, one at a time, each gone once you've done it (or had already, before tips existed).
  const { reactions, hydrated: reactionsLoaded } = useReactions();
  const { done: hintsDone, markDone } = useHints();
  const { memories, hydrated: memoriesLoaded } = useMemories();
  const ready = !!hintsDone && seenLoaded && reactionsLoaded && memoriesLoaded;
  // What you'd done before this visit (before the tips existed, say), checked once everything has loaded.
  // Only history from before now counts: jumping straight to a clip marks it seen without any swiping.
  const [openedAt] = useState(() => Date.now());
  const checkedHistory = useRef(false);
  useEffect(() => {
    if (!ready || checkedHistory.current) return;
    checkedHistory.current = true;
    const before = Object.values(seen).filter((at) => at < openedAt).length;
    const known = alreadyKnown(before, reactions, memories.length);
    if (known.length) markDone(known);
  }, [ready, seen, reactions, memories.length, openedAt, markDone]);
  // A like or save (by double-tap or the rail) is the second tip done.
  useEffect(() => {
    if (ready && alreadyKnown(0, reactions).length) markDone(['like']);
  }, [ready, reactions, markDone]);
  // Once the three are done: holding the camera button opens Look after yourself.
  const careTipState = useCareTip();
  const careTip = careTipState && Platform.OS !== 'web';
  // Then: the ring beside it holds your daily quests. Neither shows until both are known, so they never swap.
  const questTip = useQuestTip();
  const tipsKnown = careTipState !== undefined && questTip !== undefined;
  const next =
    ready && count > 0 && activeIndex < count
      ? (currentHint(hintsDone) ?? (!tipsKnown ? undefined : careTip ? CARE_HINT : questTip && !hereFestival ? QUESTS_HINT : undefined))
      : undefined;
  // Filming (and the camera button) is in the phone app, so the website doesn't teach it.
  const hint = next === 'hold' && Platform.OS === 'web' ? undefined : next;
  // Press and hold a clip to add your own video: the third tip is done the first time you do.
  const addMemory = useAddMemory();
  const onHold = useCallback(() => {
    markDone(['hold']);
    addMemory();
  }, [markDone, addMemory]);
  // The camera: swipe right on the feed (or its button). Opening it is the third tip done too.
  const openCamera = useCallback(() => {
    markDone(['hold']);
    haptic.tap();
    router.push('/camera');
  }, [markDone]);
  // Held, the camera button opens Look after yourself (as festival mode's does).
  const openCare = useCallback(() => {
    markCareTipDone();
    haptic.settle();
    router.push('/care');
  }, []);
  const peek = useSharedValue(0);
  const swipeToCamera = useMemo(
    () =>
      Gesture.Pan()
        .enabled(Platform.OS !== 'web')
        .withTestId('swipe-to-camera')
        .activeOffsetX(18)
        .failOffsetX(-12)
        .failOffsetY([-14, 14])
        .onUpdate((e) => {
          peek.set(Math.max(0, e.translationX));
        })
        .onEnd((e) => {
          if (swipeOpens(e.translationX, e.velocityX, width)) runOnJS(openCamera)();
        })
        .onFinalize(() => {
          peek.set(withSpring(0, motion.gentle));
        }),
    [peek, width, openCamera],
  );
  // A light tick as the drag passes the point where letting go opens the camera.
  useAnimatedReaction(
    () => peek.get() > width * OPEN_AT,
    (past, before) => {
      if (past && before === false) runOnJS(haptic.select)();
    },
    [width],
  );
  const feedShift = useAnimatedStyle(() => ({
    transform: [{ translateX: PEEK_MAX * (1 - Math.exp(-peek.get() / (PEEK_MAX * 1.6))) }],
  }));
  const edgeStyle = useAnimatedStyle(() => {
    const shift = PEEK_MAX * (1 - Math.exp(-peek.get() / (PEEK_MAX * 1.6)));
    const t = Math.min(1, peek.get() / (width * OPEN_AT));
    return { width: shift, opacity: interpolate(t, [0, 0.15, 1], [0, 0.6, 1]) };
  });
  const edgeIconStyle = useAnimatedStyle(() => {
    const t = Math.min(1, peek.get() / (width * OPEN_AT));
    return { transform: [{ scale: 0.8 + 0.3 * t }], opacity: t };
  });

  // The feed's position and whether its own scrolling has the finger, read by swipes that start on a video.
  const offsetY = useSharedValue(0);
  const nativeDrag = useSharedValue(false);
  // The end page counts as reached only once it's fully on screen, which can't happen mid-swipe;
  // leaving it is picked up by the last clip coming back into view.
  const endY = useSharedValue(Number.POSITIVE_INFINITY);
  const atEnd = useSharedValue(false);
  useEffect(() => {
    endY.value = hasEnd ? count * height : Number.POSITIVE_INFINITY;
  }, [hasEnd, count, height, endY]);
  const reachEnd = useCallback(() => {
    if (activeRef.current === count) return;
    activeRef.current = count;
    haptic.select();
    setActiveIndex(count);
  }, [count]);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      offsetY.value = e.contentOffset.y;
      const end = e.contentOffset.y >= endY.value - 2;
      if (end && !atEnd.value) runOnJS(reachEnd)();
      atEnd.value = end;
    },
    onBeginDrag: () => {
      nativeDrag.value = true;
    },
    onEndDrag: () => {
      nativeDrag.value = false;
    },
  });
  const pager = useMemo<FeedPager>(
    () => ({ listRef, offsetY, nativeDrag, pageHeight: height, count: pages }),
    [listRef, offsetY, nativeDrag, height, pages],
  );

  const scrollToPage = useCallback(
    (index: number, animated: boolean) => {
      runOnUI((y: number, a: boolean) => {
        'worklet';
        scrollTo(listRef, 0, y, a);
      })(index * height, animated);
    },
    [listRef, height],
  );
  // A new focus starts at the top.
  useEffect(() => {
    activeRef.current = 0;
    scrollToPage(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewFocus]);

  // Made once: the list doesn't allow this to change while it's on screen.
  const [onViewableItemsChanged] = useState(() => ({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const index = viewableItems[0]?.index;
    if (index == null || index === activeRef.current) return;
    activeRef.current = index;
    haptic.select();
    setActiveIndex(index);
    // You moved the feed yourself (a swipe, or Skip): the swipe tip is done.
    markDone(['swipe']);
  });

  // Opened from an artist page with a specific clip: jump straight to it,
  // once the feed for its festival is laid out.
  useEffect(() => {
    if (!requested || !feed) return;
    const index = feed.findIndex((it) => it.clip.id === requested);
    // Still waiting for the clip to join the feed (its festival's feed, or a video from the crowd being added).
    if (index < 0 && requestedClip && !hereFestival && ((festival && festival.lineup.includes(requestedClip.artistId)) || (wide && isCommunityClip(requestedClip)))) return;
    if (index >= 0) {
      activeRef.current = index;
      requestAnimationFrame(() => {
        setActiveIndex(index);
        scrollToPage(index, false);
      });
    }
    navigation.setParams({ clip: '' } as never);
    // Only a new request, or a new feed while one is waiting, should jump.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested, feed]);

  const skipFrom = useCallback(
    (index: number) => {
      if (index + 1 < pages) scrollToPage(index + 1, true);
    },
    [scrollToPage, pages],
  );

  // Your crew's updates along the top, while a crew's festival is on or coming up.
  const storiesOn = useCrewUpdates().crewCount > 0;
  // On a festival night, a way back to Tonight sits above the stories.
  // In festival mode the whole app is tonight, so no pill.
  const pillTonight = hereFestival ? undefined : tonight;
  const tonightSpace = pillTonight ? TONIGHT_PILL_H : 0;
  const storiesSpace = (storiesOn ? STORIES_H : 0) + tonightSpace;

  return (
    <GestureDetector gesture={swipeToCamera}>
    <View style={[styles.root, { width, alignSelf: 'center' }]}>
      {/* Swiping right: the camera's edge peeks in on the left, glowing as you near the point that opens it. */}
      <Animated.View style={[styles.cameraEdge, edgeStyle]} pointerEvents="none">
        <LinearGradient colors={['#1A1238', '#05040E']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.cameraEdgeIcon, edgeIconStyle]}>
          <CameraIcon color={color.glow} size={26} />
          <Text style={styles.cameraEdgeText}>Camera</Text>
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.shifting, feedShift]}>
      <Animated.FlatList
        ref={listRef}
        data={feed ?? []}
        keyExtractor={(it: FeedItem) => it.clip.id}
        extraData={`${activeIndex}:${feedLive}:${going.join()}`}
        renderItem={({ item, index }: { item: FeedItem; index: number }) => {
          const playback = clipPlayback(index, activeIndex, feedLive);
          // In your mix, each clip is shown against a festival you're going to where the artist plays, if any.
          const context = wide ? mixContext(item.clip, catalog.festivals, going) : festival;
          return (
            <ClipCard
              clip={item.clip}
              note={reasonNote(item.reason, catalog.artist)}
              festival={context}
              mustSee={!!context && mustSeesAt(context.id).has(item.clip.artistId)}
              width={width}
              height={height}
              isActive={playback.active}
              live={playback.live}
              isNear={Math.abs(index - activeIndex) <= 1}
              bottomSpace={tabSpace}
              pager={pager}
              index={index}
              onSkip={skipFrom}
              onNext={skipFrom}
              onHold={onHold}
              topExtra={storiesSpace}
            />
          );
        }}
        ListFooterComponent={
          hasEnd ? (
            <FeedEnd festival={festival} following={followingFocus} soundLabel={soundLabel} width={width} height={height} bottomSpace={tabSpace} onRestart={() => scrollToPage(0, true)} />
          ) : null
        }
        getItemLayout={(_d, index) => ({ length: height, offset: height * index, index })}
        pagingEnabled
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        windowSize={3}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        removeClippedSubviews
      />

      <LinearGradient
        colors={['rgba(3,2,10,0.6)', 'rgba(3,2,10,0)']}
        style={[styles.topScrim, { height: insets.top + 90 + storiesSpace }]}
        pointerEvents="none"
      />
      {hereFestival && feed && count === 0 ? (
        <HereEmpty festival={hereFestival} loading={!communityLoaded} bottomSpace={tabSpace} onFilm={openCamera} />
      ) : null}
      {followingFocus && feed && count === 0 ? (
        <FollowingEmpty
          signedIn={!!social.user}
          follows={social.following.size}
          loading={!communityLoaded}
          bottomSpace={tabSpace}
        />
      ) : null}
      {(festival || wide) && (
        <View style={[styles.header, { top: insets.top + space.sm }]} pointerEvents="box-none">
          {hereFestival ? (
            <Pressable
              onPress={() => {
                haptic.select();
                router.push('/tonight');
              }}
              accessibilityRole="button"
              accessibilityLabel={`${hereFestival.name}, videos filmed here. Open tonight.`}
              hitSlop={8}
              style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.headerTitle}>
                <View style={styles.liveDot} />
                <Text style={styles.festival} numberOfLines={1}>
                  {hereFestival.name}
                </Text>
              </View>
              <Text style={styles.dates} numberOfLines={1}>
                {standIn ? 'Test: lineup sets stand in for videos filmed here' : 'Videos filmed here'}
              </Text>
            </Pressable>
          ) : (
          <Pressable
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/discover-focus', params: { current: focusId } });
            }}
            accessibilityRole="button"
            accessibilityLabel={`${tonightOn ? `Tonight, who plays ${tonight?.night ? `${tonight.night} ` : ''}at ${festival?.name}, in set order` : festival ? `${festival.name}, live sets from the lineup` : followingFocus ? 'Following, videos from people you follow' : soundLabel ? `${soundLabel}, live sets from every lineup` : 'Your mix, a bit of everything'}. Choose what to discover.`}
            hitSlop={8}
            style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.headerTitle}>
              <Text style={styles.festival} numberOfLines={1}>{tonightOn ? 'Tonight' : festival ? festival.name : followingFocus ? 'Following' : (soundLabel ?? 'Your mix')}</Text>
              {toes ? <ToeGlyph size={12} color={color.moonDim} /> : <ChevronIcon color={color.moonDim} size={13} direction="down" />}
            </View>
            {/* Short, so the title never fights the buttons: the dates, or where the clips come from. */}
            <Text style={styles.dates} numberOfLines={1}>
              {tonightOn && tonight ? `${tonight.night ? `${tonight.night} at ` : ''}${festival?.name} · in set order` : festival ? festival.dates || 'Live sets from the lineup' : followingFocus ? 'People you follow' : 'Every lineup'}
            </Text>
          </Pressable>
          )}
          <View style={styles.headerEnd}>
            {/* Today's quests: a ring that fills as you go. */}
            {!hereFestival ? <QuestButton /> : null}
            {/* Film your own video (or swipe right). The camera needs the phone app. */}
            {Platform.OS !== 'web' ? (
              <GlassCircleButton
                label="Open the camera to film a memory"
                hint="Hold to open Look after yourself"
                onPress={openCamera}
                onLongPress={openCare}
                longPressLabel="Look after yourself"
              >
                <CameraIcon color={color.moon} size={18} />
              </GlassCircleButton>
            ) : null}
            {/* Search everything: people, artists, festivals. */}
            <GlassCircleButton label="Search artists, festivals and people" onPress={() => router.push('/search')}>
              <SearchIcon color={color.moon} size={17} />
            </GlassCircleButton>
          </View>
        </View>
      )}
      {pillTonight ? (
        <View style={[styles.stories, { top: insets.top + space.sm + HEADER_HEIGHT }]} pointerEvents="box-none">
          <TonightPill tonight={pillTonight} />
        </View>
      ) : null}
      {storiesOn ? (
        <View style={[styles.stories, { top: insets.top + space.sm + HEADER_HEIGHT + 4 + tonightSpace }]} pointerEvents="box-none">
          <CrewStories />
        </View>
      ) : null}
      {/* A first-time tip on its own line under the title, so the header stays one clean row. */}
      {hint && (festival || wide) ? (
        <View style={[styles.hint, { top: insets.top + space.sm + HEADER_HEIGHT + storiesSpace }]} pointerEvents="none">
          <FeedHint hint={hint} />
        </View>
      ) : null}
      </Animated.View>
    </View>
    </GestureDetector>
  );
}

/** The feed's widest: about a large phone. */
const FEED_MAX_WIDTH = 520;
/** Roughly the header row's height, for the tip under it. */
const HEADER_HEIGHT = 48;

const styles = StyleSheet.create({
  stories: { position: 'absolute', left: 0, right: 0 },
  root: { flex: 1, backgroundColor: color.night, overflow: 'hidden' },
  shifting: { flex: 1 },
  cameraEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cameraEdgeIcon: { alignItems: 'center', gap: 6, width: 90 },
  cameraEdgeText: { ...type.caption, color: color.moonDim },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
    position: 'absolute',
    left: space.xl,
    right: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  headerButton: { alignSelf: 'flex-start', flexShrink: 1 },
  hint: { position: 'absolute', left: space.xl, right: space.xl, flexDirection: 'row' },
  headerEnd: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  festival: { ...type.headline, color: color.moon },
  dates: { ...type.caption, color: color.moonDim, marginTop: 1 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF7EB6', shadowColor: '#FF7EB6', shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
});
