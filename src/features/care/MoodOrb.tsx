import { useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { color, motion } from '../../theme/tokens';
import { mix } from '../sprouts/artistLook';

/**
 * A glassy, glowing orb in a feeling's colour: a soft halo, a ball lit from
 * the top left, and a little highlight, like light on a bubble. `breathe`
 * slowly swells the halo (still with Reduce Motion); `bloom` grows it in
 * with a single ripple when it has just been picked. Purely decorative: the
 * button or text around it carries the label.
 */
export function MoodOrb({ tint, size, glow = 0.45, rings, breathe, bloom }: { tint: string; size: number; glow?: number; rings?: boolean; breathe?: boolean; bloom?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const reduce = useReducedMotion();
  const box = Math.round(size * (rings ? 1.9 : 1.6));
  const c = box / 2;
  const R = size / 2;

  const breath = useSharedValue(0);
  const grow = useSharedValue(bloom && !reduce ? 0 : 1);
  const ripple = useSharedValue(bloom && !reduce ? 0 : 1);
  useEffect(() => {
    if (reduce) return;
    if (bloom) {
      grow.set(withSpring(1, motion.bloom));
      ripple.set(withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    }
    if (breathe) breath.set(withDelay(bloom ? 600 : 0, withRepeat(withSequence(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) })), -1)));
    return () => cancelAnimation(breath);
  }, [reduce, bloom, breathe, breath, grow, ripple]);

  const halo = useAnimatedStyle(() => ({ opacity: 0.75 + 0.25 * breath.get(), transform: [{ scale: (0.6 + 0.4 * grow.get()) * (0.94 + 0.1 * breath.get()) }] }));
  const ball = useAnimatedStyle(() => ({ transform: [{ scale: 0.7 + 0.3 * grow.get() }] }));
  const ring = useAnimatedStyle(() => ({ opacity: (1 - ripple.get()) * 0.8, transform: [{ scale: 1 + ripple.get() * 0.7 }] }));

  const light = mix(tint, '#FFFFFF', 0.72);
  const deep = mix(tint, color.night, 0.62);
  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, halo]}>
        <Svg width={box} height={box}>
          <Defs>
            <RadialGradient id={`h${id}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0.45" stopColor={tint} stopOpacity={glow} />
              <Stop offset="0.7" stopColor={tint} stopOpacity={glow * 0.3} />
              <Stop offset="1" stopColor={tint} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={c} cy={c} r={c} fill={`url(#h${id})`} />
          {rings ? (
            <>
              <Circle cx={c} cy={c} r={R + 9} fill="none" stroke={tint} strokeOpacity={0.28} strokeWidth={1} />
              <Circle cx={c} cy={c} r={R + 18} fill="none" stroke={tint} strokeOpacity={0.12} strokeWidth={1} />
            </>
          ) : null}
        </Svg>
      </Animated.View>
      {bloom && !reduce ? <Animated.View style={[styles.ripple, { width: size, height: size, borderRadius: R, borderColor: tint }, ring]} /> : null}
      <Animated.View style={ball}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id={`b${id}`} cx="40%" cy="35%" r="68%" fx="38%" fy="32%">
              <Stop offset="0" stopColor={light} />
              <Stop offset="0.5" stopColor={tint} />
              <Stop offset="1" stopColor={deep} />
            </RadialGradient>
            <RadialGradient id={`s${id}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.8} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={R} cy={R} r={R} fill={`url(#b${id})`} />
          <Ellipse cx={R * 0.78} cy={R * 0.66} rx={R * 0.42} ry={R * 0.34} fill={`url(#s${id})`} />
          <Circle cx={R} cy={R} r={R - 0.5} fill="none" stroke="#FFFFFF" strokeOpacity={0.14} strokeWidth={1} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ripple: { position: 'absolute', borderWidth: 1.5 },
});
