import { useMemo } from 'react';
import type { FlatList } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { type AnimatedRef, scrollTo, type SharedValue, useSharedValue } from 'react-native-reanimated';
import type { Clip } from '../../data/types';
import { pageAfterDrag } from './playback';

/** What a card needs to move the feed itself, shared by DiscoverFeed. */
export type FeedPager = {
  listRef: AnimatedRef<FlatList<Clip>>;
  /** The feed's scroll position, kept on the UI thread. */
  offsetY: SharedValue<number>;
  /** The feed's own scrolling has the finger. */
  nativeDrag: SharedValue<boolean>;
  pageHeight: number;
  count: number;
};

/**
 * Vertical swipes that start on the video. The embedded player is a web page
 * and may keep the touch for itself, so this moves the feed directly: the
 * page follows the finger and settles on the next, previous or same clip.
 * Taps and sideways drags (the player's own seek bar) never start it, so the
 * player's controls keep working. If the feed's own scrolling picks up the
 * touch instead, this steps aside.
 */
export function usePlayerSwipe({ listRef, offsetY, nativeDrag, pageHeight, count }: FeedPager) {
  const start = useSharedValue(0);
  const owning = useSharedValue(false);

  return useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-10, 10])
        .failOffsetX([-14, 14])
        .onStart(() => {
          owning.set(!nativeDrag.get());
          start.set(offsetY.get());
        })
        .onUpdate((e) => {
          if (!owning.get()) return;
          if (nativeDrag.get()) {
            owning.set(false);
            return;
          }
          const max = (count - 1) * pageHeight;
          scrollTo(listRef, 0, Math.min(max, Math.max(0, start.get() - e.translationY)), false);
        })
        .onFinalize((e) => {
          if (!owning.get()) return;
          owning.set(false);
          const from = Math.round(start.get() / pageHeight);
          const to = pageAfterDrag(from, count, e.translationY, e.velocityY, pageHeight);
          scrollTo(listRef, 0, to * pageHeight, true);
        }),
    [listRef, offsetY, nativeDrag, pageHeight, count, start, owning],
  );
}
