import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, type ViewToken } from 'react-native';
import Animated, {
  runOnJS,
  runOnUI,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { ChevronIcon } from '../../components/TabIcons';
import { haptic } from '../../lib/haptics';
import type { Clip } from '../../data/models';
import { isCommunityClip } from '../community/clips';
import { useCatalog } from '../../state/catalog';
import { useClipPool, useCommunityFeed } from '../../state/community';
import { useSocial } from '../../state/social';
import { useStoredFocus } from '../../state/discoverFocus';
import { useGoing } from '../../state/going';
import { usePlan } from '../../state/plan';
import { useHints } from '../../state/hints';
import { useReactions } from '../../state/reactions';
import { useSeen } from '../../state/seen';
import { color, space, type } from '../../theme/tokens';
import { ClipCard } from './ClipCard';
import { FeedEnd } from './FeedEnd';
import { FollowingEmpty } from './FollowingEmpty';
import { FeedHint } from './FeedHint';
import { useAddMemory } from '../memories/useAddMemory';
import { useMemories } from '../../state/memories';
import { alreadyKnown, currentHint } from './hints';
import type { FeedPager } from './feedPager';
import { defaultFocus } from '../festivals/links';
import { FOLLOWING, type Focus, MIX, mixContext, nextDiscoverFocus, startFocus } from './focus';
import { reasonNote } from '../recommend/copy';
import type { FeedItem } from '../recommend/feed';
import { clipPlayback } from './playback';
import { useFeedLive } from './useFeedLive';
import { useRankedFeed } from './useRankedFeed';

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
  const tabSpace = useTabBarSpace();
  const listRef = useAnimatedRef<FlatList<FeedItem>>();
  const [activeIndex, setActiveIndex] = useState(0);
  const activeRef = useRef(0);
  const feedLive = useFeedLive();

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
  const mix = focusId === MIX;
  const followingFocus = focusId === FOLLOWING;
  // Both draw from every lineup: each clip is shown against a festival you're going to where the artist plays.
  const wide = mix || followingFocus;
  // If the catalogue changes under us (a hosted file arrived) and the festival is gone, open the first one with clips.
  const festival =
    !decided || wide
      ? undefined
      : ((focusId ? catalog.festival(focusId) : undefined) ?? defaultFocus(catalog.festivals, catalog.clips));
  // Cleared once handled, which waits for the focus to be decided.
  useEffect(() => {
    if (focusParam && decided) navigation.setParams({ festival: '' } as never);
  }, [focusParam, decided, navigation]);

  // Clips people at the festival shared to their profiles, beside the official ones (none when signed out or switched off).
  // In Following, they're the only clips: videos from the people you follow.
  const { clips: fetched, loaded: communityLoaded } = useCommunityFeed(mix ? 'mix' : followingFocus ? 'following' : festival);
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
  const feed = useRankedFeed(activeIndex, mix ? MIX : followingFocus ? FOLLOWING : festival, community);
  const { mustSeesAt } = usePlan();
  const count = feed?.length ?? 0;
  // After the last clip comes one more page: the end of the lineup (or of everything), with where to go next.
  const hasEnd = (wide || !!festival) && count > 0;
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
  const next = ready && count > 0 && activeIndex < count ? currentHint(hintsDone) : undefined;
  // Adding your own videos is in the phone app, so the website doesn't teach the hold.
  const hint = next === 'hold' && Platform.OS === 'web' ? undefined : next;
  // Press and hold a clip to add your own video: the third tip is done the first time you do.
  const addMemory = useAddMemory();
  const onHold = useCallback(() => {
    markDone(['hold']);
    addMemory();
  }, [markDone, addMemory]);

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
  }, [focusId]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const index = viewableItems[0]?.index;
    if (index == null || index === activeRef.current) return;
    activeRef.current = index;
    haptic.select();
    setActiveIndex(index);
    // You moved the feed yourself (a swipe, or Skip): the swipe tip is done.
    markDone(['swipe']);
  }).current;

  // Opened from an artist page with a specific clip: jump straight to it,
  // once the feed for its festival is laid out.
  useEffect(() => {
    if (!requested || !feed) return;
    const index = feed.findIndex((it) => it.clip.id === requested);
    // Still waiting for the clip to join the feed (its festival's feed, or a video from the crowd being added).
    if (index < 0 && requestedClip && ((festival && festival.lineup.includes(requestedClip.artistId)) || (wide && isCommunityClip(requestedClip)))) return;
    if (index >= 0) {
      activeRef.current = index;
      setActiveIndex(index);
      requestAnimationFrame(() => scrollToPage(index, false));
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

  return (
    <View style={[styles.root, { width, alignSelf: 'center' }]}>
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
              onSkip={() => skipFrom(index)}
              onHold={onHold}
            />
          );
        }}
        ListFooterComponent={
          hasEnd ? (
            <FeedEnd festival={festival} following={followingFocus} width={width} height={height} bottomSpace={tabSpace} onRestart={() => scrollToPage(0, true)} />
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
        style={[styles.topScrim, { height: insets.top + 90 }]}
        pointerEvents="none"
      />
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
          <Pressable
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/discover-focus', params: { current: focusId } });
            }}
            accessibilityRole="button"
            accessibilityLabel={`${festival ? `${festival.name}, live sets from the lineup` : followingFocus ? 'Following, videos from people you follow' : 'Your mix, a bit of everything'}. Choose what to discover.`}
            hitSlop={8}
            style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.headerTitle}>
              <Text style={styles.festival} numberOfLines={1}>{festival ? festival.name : followingFocus ? 'Following' : 'Your mix'}</Text>
              <ChevronIcon color={color.moonDim} size={13} direction="down" />
            </View>
            <Text style={styles.dates} numberOfLines={1}>
              {festival ? `Live sets from the lineup · ${festival.dates}` : followingFocus ? 'Videos from people you follow' : 'A bit of everything, from every lineup'}
            </Text>
          </Pressable>
          {hint ? <FeedHint hint={hint} /> : null}
        </View>
      )}
    </View>
  );
}

/** The feed's widest: about a large phone. */
const FEED_MAX_WIDTH = 520;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
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
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  festival: { ...type.headline, color: color.moon },
  dates: { ...type.caption, color: color.moonDim, marginTop: 1 },
});
