import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { Artist } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { usePlan } from '../../state/plan';
import { color, motion } from '../../theme/tokens';
import { StarIcon } from './icons';

/** Star to mark an artist as a must-see at one festival. Planning only, never changes the match. */
export function MustSeeToggle({
  artist,
  festivalId,
  size = 20,
}: {
  artist: Artist;
  festivalId: string;
  size?: number;
}) {
  const { isMustSee, toggleMustSee } = usePlan();
  const on = isMustSee(festivalId, artist.id);
  const reduceMotion = useReducedMotion();
  const s = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (on && !reduceMotion) s.value = withSequence(withTiming(1.3, { duration: 110 }), withSpring(1, motion.snappy));
  }, [on, reduceMotion, s]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));

  return (
    <Pressable
      onPress={() => {
        if (on) haptic.select();
        else haptic.tap();
        toggleMustSee(festivalId, artist.id);
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? `Remove ${artist.name} from your must sees` : `Mark ${artist.name} as a must see`}
      style={styles.hit}
    >
      <Animated.View style={style}>
        <StarIcon color={on ? color.glow : color.moonFaint} filled={on} size={size} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
