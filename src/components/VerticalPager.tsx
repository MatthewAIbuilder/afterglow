import { useCallback, useState, type ReactNode } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { color } from '../theme/tokens';

/** At most this many pages in one swipe-through (a link carries their ids). */
export const PAGER_MAX = 100;

/** The ids to swipe through: the list given (when it holds this one), or just this one. */
export function pagerIds(list: string | undefined, id: string): string[] {
  const ids = (list ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, PAGER_MAX);
  return ids.includes(id) ? [...new Set(ids)] : [id];
}

/**
 * Full-screen pages you swipe up and down through, like Discover: one page
 * per id, a screen tall, snapping into place. Only the page in view is
 * `active` (its video plays); its neighbours are ready underneath.
 */
export function VerticalPager({ ids, start, renderPage }: { ids: string[]; start: string; renderPage: (id: string, active: boolean) => ReactNode }) {
  const { height } = useWindowDimensions();
  const first = Math.max(0, ids.indexOf(start));
  const [index, setIndex] = useState(first);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.round(e.nativeEvent.contentOffset.y / Math.max(1, height));
      setIndex((cur) => (cur === i ? cur : Math.min(ids.length - 1, Math.max(0, i))));
    },
    [height, ids.length],
  );
  return (
    <FlatList
      style={styles.root}
      testID="pager"
      data={ids}
      keyExtractor={(x) => x}
      pagingEnabled
      decelerationRate="fast"
      snapToInterval={height}
      showsVerticalScrollIndicator={false}
      initialScrollIndex={first}
      getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
      onScroll={onScroll}
      scrollEventThrottle={32}
      initialNumToRender={1}
      maxToRenderPerBatch={2}
      windowSize={3}
      renderItem={({ item, index: i }) => <View style={{ height }}>{renderPage(item, i === index)}</View>}
    />
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: color.night } });
