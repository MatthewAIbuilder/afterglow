import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions, View, type ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { CLIPS } from '../../data/clips';
import { FESTIVALS } from '../../data/festivals';
import type { Clip } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { color, space, type } from '../../theme/tokens';
import { ClipCard } from './ClipCard';

/** Full-screen vertical feed. One clip per page, only the visible one plays. */
export function DiscoverFeed() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const festival = FESTIVALS[0];
  const listRef = useRef<FlatList<Clip>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeRef = useRef(0);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const index = viewableItems[0]?.index;
    if (index == null || index === activeRef.current) return;
    activeRef.current = index;
    haptic.select();
    setActiveIndex(index);
  }).current;

  // Opened from an artist page with a specific clip: jump straight to it.
  const { clip: requested } = useLocalSearchParams<{ clip?: string }>();
  useEffect(() => {
    if (!requested) return;
    const index = CLIPS.findIndex((c) => c.id === requested);
    if (index >= 0) {
      activeRef.current = index;
      setActiveIndex(index);
      requestAnimationFrame(() => listRef.current?.scrollToIndex({ index, animated: false }));
    }
    router.setParams({ clip: '' });
  }, [requested]);

  const skipFrom = useCallback(
    (index: number) => {
      if (index + 1 < CLIPS.length) listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    },
    [],
  );

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        data={CLIPS}
        keyExtractor={(c) => c.id}
        renderItem={({ item, index }) => (
          <ClipCard
            clip={item}
            width={width}
            height={height}
            isActive={index === activeIndex}
            bottomSpace={tabSpace}
            onSkip={() => skipFrom(index)}
          />
        )}
        getItemLayout={(_d, index) => ({ length: height, offset: height * index, index })}
        pagingEnabled
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        showsVerticalScrollIndicator={false}
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
      <View style={[styles.header, { top: insets.top + space.sm }]} pointerEvents="none">
        <Text style={styles.festival}>{festival.name}</Text>
        <Text style={styles.dates}>{festival.dates}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: { position: 'absolute', left: space.xl, right: space.xl },
  festival: { ...type.headline, color: color.moon },
  dates: { ...type.caption, color: color.moonDim, marginTop: 1 },
});
