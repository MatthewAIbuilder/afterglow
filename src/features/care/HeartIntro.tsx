import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { HeartIcon } from '../discover/icons';

/**
 * The heart at the top of Look after yourself. Arriving from the held
 * camera button (`bloom`), it lands from big and low into its place while
 * the pink glow of the bloom fades away; otherwise it just sits there,
 * softly lit.
 */
export function HeartMark({ bloom }: { bloom: boolean }) {
  const reduce = useReducedMotion();
  const animate = bloom && !reduce;
  const t = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (animate) t.set(withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [animate, t]);
  const heart = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - t.get()) * 260 }, { scale: 1 + (1 - t.get()) * 2.2 }],
  }));
  const glow = useAnimatedStyle(() => ({ opacity: 0.35 + (1 - t.get()) * 0.65, transform: [{ translateY: (1 - t.get()) * 260 }, { scale: 1 + (1 - t.get()) * 3 }] }));
  return (
    <View style={styles.wrap} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Animated.View style={[styles.glow, glow]} />
      <Animated.View style={heart}>
        <HeartIcon color="#FF7EB6" size={34} filled />
      </Animated.View>
    </View>
  );
}

/** The bloom's pink wash, fading as the page settles. */
export function BloomWash({ bloom }: { bloom: boolean }) {
  const reduce = useReducedMotion();
  const animate = bloom && !reduce;
  const o = useSharedValue(animate ? 0.55 : 0);
  useEffect(() => {
    if (animate) o.set(withTiming(0, { duration: 650, easing: Easing.out(Easing.quad) }));
  }, [animate, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.get() }));
  if (!animate) return null;
  return <Animated.View style={[StyleSheet.absoluteFill, styles.wash, style]} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  wrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  glow: { position: 'absolute', width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,79,139,0.35)' },
  wash: { backgroundColor: '#FF4F8B' },
});
