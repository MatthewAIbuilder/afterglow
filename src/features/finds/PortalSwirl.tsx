import { useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';

/** One turn of the outer swirl; the inner one turns the other way, faster. */
const TURN_MS = 9000;
const ARMS = 7;

const arm = (base: number, from: number, to: number, twist: number) =>
  Array.from({ length: 28 }, (_, i) => {
    const t = i / 27;
    const r = from + (to - from) * t;
    const a = base + t * twist;
    return `${i ? 'L' : 'M'}${(50 + Math.cos(a) * r).toFixed(1)} ${(50 + Math.sin(a) * r).toFixed(1)}`;
  }).join(' ');

/**
 * A portal opening behind something: a swirl of light that bursts open
 * (when `open` turns true), then keeps turning slowly. Drawn `size` wide,
 * centred on whatever it sits behind. Still with reduced motion. Used
 * behind the Portal potty when it's found and on the totem.
 */
export function PortalSwirl({ size, colors, open = true }: { size: number; colors: { glow: string; accent: string; light: string; deep: string }; open?: boolean }) {
  const reduce = useReducedMotion();
  // Big portals keep fine lines (strokes are drawn in a 100-wide box).
  const w = Math.min(1, Math.sqrt(300 / size));
  const well = `portal-well-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const turn = useSharedValue(0);
  const scale = useSharedValue(reduce || open ? 1 : 0.35);
  const flash = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    turn.set(withRepeat(withTiming(1, { duration: TURN_MS, easing: Easing.linear }), -1, false));
  }, [reduce, turn]);
  useEffect(() => {
    if (reduce) {
      scale.set(1);
      return;
    }
    if (open) {
      scale.set(withSpring(1, { damping: 10, stiffness: 90 }));
      flash.set(1);
      flash.set(withDelay(120, withTiming(0, { duration: 900, easing: Easing.out(Easing.quad) })));
    } else scale.set(withTiming(0.35, { duration: 400 }));
  }, [open, reduce, scale, flash]);
  const outer = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }, { rotate: `${turn.get() * 360}deg` }], opacity: open ? 1 : 0.35 }));
  const inner = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() * 0.62 }, { rotate: `${-turn.get() * 720}deg` }] }));
  const burst = useAnimatedStyle(() => ({ opacity: flash.get(), transform: [{ scale: 0.6 + (1 - flash.get()) * 0.8 }] }));
  const box = { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 };
  return (
    <View style={styles.wrap} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.layer, box, outer]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id={well} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.deep} stopOpacity={0.9} />
              <Stop offset="0.45" stopColor={colors.accent} stopOpacity={0.35} />
              <Stop offset="0.8" stopColor={colors.glow} stopOpacity={0.18} />
              <Stop offset="1" stopColor={colors.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={50} cy={50} r={50} fill={`url(#${well})`} />
          <G opacity={0.75}>
            {Array.from({ length: ARMS }, (_, i) => (
              <Path key={i} d={arm((i * 2 * Math.PI) / ARMS, 6, 46, 3.6)} stroke={i % 2 ? colors.light : colors.accent} strokeWidth={(i % 2 ? 0.7 : 1.3) * w} strokeLinecap="round" fill="none" opacity={0.55 + (i % 2) * 0.2} />
            ))}
          </G>
          {/* Motes caught in it. */}
          {Array.from({ length: 10 }, (_, i) => {
            const a = i * 2.4;
            const r = 14 + ((i * 7) % 30);
            return <Circle key={`m${i}`} cx={50 + Math.cos(a) * r} cy={50 + Math.sin(a) * r} r={(0.9 + (i % 3) * 0.4) * w} fill={colors.light} opacity={0.8} />;
          })}
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, box, inner]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {Array.from({ length: 3 }, (_, i) => (
            <Path key={i} d={arm((i * 2 * Math.PI) / 3, 4, 44, 4.4)} stroke={colors.accent} strokeWidth={1.2 * w} strokeLinecap="round" fill="none" opacity={0.45} />
          ))}
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, box, burst]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Circle cx={50} cy={50} r={44} stroke={colors.light} strokeWidth={2 * w} fill="none" />
          <Circle cx={50} cy={50} r={30} fill={colors.accent} opacity={0.4} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'visible' },
  layer: { position: 'absolute', left: '50%', top: '50%' },
});
