import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { HeartIcon } from '../features/discover/icons';

/**
 * The camera button turning into a heart: held, the camera fades into a
 * glowing heart that swells (`hold` 0 to 1); let go early and it eases back.
 * Held all the way, the heart blooms out across the screen (`burst` 0 to 1)
 * as Look after yourself opens. Purely visual: hidden from screen readers.
 */

/** The pink of the heart, light to deep. */
export const HEART_COLORS = ['#FFB3D1', '#FF7EB6', '#FF4F8B'] as const;
/** How big the bloom layer is before it scales up. */
export const BLOOM = 120;

/** The heart drawn over the camera button while you hold it. */
export function HeartFace({ hold }: { hold: SharedValue<number> }) {
  const fill = useAnimatedStyle(() => ({ opacity: interpolate(hold.get(), [0, 0.6], [0, 1], 'clamp') }));
  const heart = useAnimatedStyle(() => ({
    opacity: interpolate(hold.get(), [0.15, 0.7], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(hold.get(), [0, 1], [0.35, 1.08], 'clamp') }],
  }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.round, fill]}>
        <LinearGradient colors={HEART_COLORS} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, heart]}>
        <HeartIcon color="#FFFFFF" size={26} filled />
      </Animated.View>
    </View>
  );
}

/** Behind the bar: a soft pink halo that grows as you hold. */
export function HeartHalo({ hold, bottom }: { hold: SharedValue<number>; bottom: number }) {
  const halo = useAnimatedStyle(() => ({
    opacity: interpolate(hold.get(), [0, 1], [0, 0.7], 'clamp'),
    transform: [{ scale: interpolate(hold.get(), [0, 1], [0.4, 1.35], 'clamp') }],
  }));
  return (
    <Animated.View style={[styles.layer, { bottom: bottom - BLOOM / 2 }, halo]} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={[styles.glow, styles.glowOuter]} />
      <View style={[styles.glow, styles.glowInner]} />
    </Animated.View>
  );
}

/** In front of everything: the heart blooming out when the hold completes. */
export function HeartBurst({ burst, bottom }: { burst: SharedValue<number>; bottom: number }) {
  const wash = useAnimatedStyle(() => {
    const t = burst.get();
    return {
      opacity: t <= 0 ? 0 : interpolate(t, [0, 0.35, 1], [0.95, 0.75, 0]),
      transform: [{ scale: interpolate(Easing.out(Easing.cubic)(t), [0, 1], [0.5, 16]) }],
    };
  });
  const ring = useAnimatedStyle(() => {
    const t = burst.get();
    return { opacity: t <= 0 ? 0 : interpolate(t, [0, 0.7], [1, 0], 'clamp'), transform: [{ scale: interpolate(t, [0, 0.7], [0.6, 5], 'clamp') }] };
  });
  const heart = useAnimatedStyle(() => {
    const t = burst.get();
    return {
      opacity: t <= 0 ? 0 : interpolate(t, [0, 0.15, 0.75], [1, 1, 0], 'clamp'),
      transform: [{ translateY: interpolate(t, [0, 1], [0, -160]) }, { scale: interpolate(t, [0, 0.25, 1], [1, 2.6, 4.2]) }],
    };
  });
  return (
    <View style={[styles.layer, { bottom: bottom - BLOOM / 2 }]} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Animated.View style={[styles.full, styles.wash, wash]} />
      <Animated.View style={[styles.full, styles.ring, ring]} />
      <Animated.View style={[styles.full, styles.center, heart]}>
        <HeartIcon color="#FFE3EF" size={44} filled />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  round: { borderRadius: 999, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  layer: { position: 'absolute', alignSelf: 'center', width: BLOOM, height: BLOOM },
  full: { position: 'absolute', top: 0, left: 0, width: BLOOM, height: BLOOM, borderRadius: BLOOM / 2 },
  glow: { position: 'absolute', borderRadius: 999 },
  glowOuter: { top: 0, left: 0, width: BLOOM, height: BLOOM, backgroundColor: 'rgba(255,79,139,0.28)' },
  glowInner: { top: BLOOM * 0.2, left: BLOOM * 0.2, width: BLOOM * 0.6, height: BLOOM * 0.6, backgroundColor: 'rgba(255,126,182,0.45)' },
  wash: { backgroundColor: 'rgba(255,79,139,0.55)' },
  ring: { borderWidth: 2, borderColor: 'rgba(255,200,225,0.9)' },
});
