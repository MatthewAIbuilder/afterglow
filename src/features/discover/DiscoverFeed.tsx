import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View, type ViewToken } from 'react-native';
import Animated, {
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
import { useCatalog } from '../../state/catalog';
import { usePlan } from '../../state/plan';
import { useSeen } from '../../state/seen';
import { color, space, type } from '../../theme/tokens';
import { ClipCard } from './ClipCard';
import type { FeedPager } from './feedPager';
import { defaultFocus, nextFocus } from '../festivals/links';
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
 * Discover is focused on one festival and shows only artists on its lineup.
 * A festival page can open it focused on that festival (`festival` param);
 * jumping to a clip (`clip` param) moves the focus if that artist doesn't
 * play the current one.
 */
export function DiscoverFeed() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const listRef = useAnimatedRef<FlatList<FeedItem>>();
  const [activeIndex, setActiveIndex] = useState(0);
  const activeRef = useRef(0);
  const feedLive = useFeedLive();

  // Which festival's lineup you're discovering. Changes start the feed from the top.
  const { clip: requested, festival: focusParam } = useLocalSearchParams<{ clip?: string; festival?: string }>();
  const catalog = useCatalog();
  const [focusId, setFocusId] = useState(() => defaultFocus(catalog.festivals, catalog.clips)?.id);
  const requestedClip = requested ? catalog.clip(requested) : undefined;
  const target = nextFocus(
    focusId ? catalog.festival(focusId) : undefined,
    { festival: focusParam ? catalog.festival(focusParam) : undefined, clip: requestedClip },
    catalog.festivals,
  )?.id;
  if (target !== focusId) {
    setFocusId(target);
    setActiveIndex(0);
  }
  // If the catalogue changes under us (a hosted file arrived) and the festival is gone, open the first one with clips.
  const festival = (focusId ? catalog.festival(focusId) : undefined) ?? defaultFocus(catalog.festivals, catalog.clips);
  useEffect(() => {
    if (focusParam) router.setParams({ festival: '' });
  }, [focusParam]);

  const feed = useRankedFeed(activeIndex, festival);
  const { mustSeesAt } = usePlan();
  const starred = festival ? mustSeesAt(festival.id) : undefined;
  const count = feed?.length ?? 0;

  // What you've had on screen, so the feed can hold it back next time.
  const { markSeen } = useSeen();
  const activeId = feed?.[activeIndex]?.clip.id;
  useEffect(() => {
    if (activeId && feedLive) markSeen(activeId);
  }, [activeId, feedLive, markSeen]);

  // The feed's position and whether its own scrolling has the finger, read by swipes that start on a video.
  const offsetY = useSharedValue(0);
  const nativeDrag = useSharedValue(false);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      offsetY.value = e.contentOffset.y;
    },
    onBeginDrag: () => {
      nativeDrag.value = true;
    },
    onEndDrag: () => {
      nativeDrag.value = false;
    },
  });
  const pager = useMemo<FeedPager>(
    () => ({ listRef, offsetY, nativeDrag, pageHeight: height, count }),
    [listRef, offsetY, nativeDrag, height, count],
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
  }).current;

  // Opened from an artist page with a specific clip: jump straight to it,
  // once the feed for its festival is laid out.
  useEffect(() => {
    if (!requested || !feed) return;
    const index = feed.findIndex((it) => it.clip.id === requested);
    if (index < 0 && requestedClip && festival && festival.lineup.includes(requestedClip.artistId)) return;
    if (index >= 0) {
      activeRef.current = index;
      setActiveIndex(index);
      requestAnimationFrame(() => scrollToPage(index, false));
    }
    router.setParams({ clip: '' });
    // Only a new request, or a new feed while one is waiting, should jump.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested, feed]);

  const skipFrom = useCallback(
    (index: number) => {
      if (index + 1 < count) scrollToPage(index + 1, true);
    },
    [scrollToPage, count],
  );

  return (
    <View style={styles.root}>
      <Animated.FlatList
        ref={listRef}
        data={feed ?? []}
        keyExtractor={(it: FeedItem) => it.clip.id}
        extraData={`${activeIndex}:${feedLive}`}
        renderItem={({ item, index }: { item: FeedItem; index: number }) => {
          const playback = clipPlayback(index, activeIndex, feedLive);
          return (
            <ClipCard
              clip={item.clip}
              note={reasonNote(item.reason, catalog.artist)}
              festival={festival}
              mustSee={!!starred?.has(item.clip.artistId)}
              width={width}
              height={height}
              isActive={playback.active}
              live={playback.live}
              isNear={Math.abs(index - activeIndex) <= 1}
              bottomSpace={tabSpace}
              pager={pager}
              onSkip={() => skipFrom(index)}
            />
          );
        }}
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
      {festival && (
        <View style={[styles.header, { top: insets.top + space.sm }]} pointerEvents="box-none">
          <Pressable
            onPress={() => {
              haptic.select();
              router.push(`/festival/${festival.id}`);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${festival.name}, live sets from the lineup. Opens the festival and your plan.`}
            hitSlop={8}
            style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.headerTitle}>
              <Text style={styles.festival}>{festival.name}</Text>
              <ChevronIcon color={color.moonDim} size={13} />
            </View>
            <Text style={styles.dates}>Live sets from the lineup · {festival.dates}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: { position: 'absolute', left: space.xl, right: space.xl },
  headerButton: { alignSelf: 'flex-start' },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  festival: { ...type.headline, color: color.moon },
  dates: { ...type.caption, color: color.moonDim, marginTop: 1 },
});
