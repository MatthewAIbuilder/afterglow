import { useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { SOUND_LABEL } from '../../data/models';
import { haptic } from '../../lib/haptics';
import type { SoundShare } from '../taste/lean';
import { SOUND_COLOR } from './colors';
import { t } from '../../i18n';

/**
 * A sound mix as one glowing band of colour: each sound's light flowing
 * into the next, each as wide as its share. Grows in from the left (still
 * with reduced motion). Read out as the percentages.
 */
export function SoundSpectrum({
  shares,
  height = 6,
  onPress,
  label,
}: {
  shares: SoundShare[];
  height?: number;
  onPress?: () => void;
  /** What a screen reader says before the percentages, like "Your sound". */
  label: string;
}) {
  const spoken = `${label}: ${shares.map((s) => t('{sound} {pct} percent', { sound: SOUND_LABEL[s.tag], pct: s.percent })).join(', ')}`;
  // One band of light: each sound's colour at the middle of its share, flowing into the next (no hard segments: this is a glow, not a chart).
  const stops = blend(shares);
  const bar = (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <Grow>
        <LinearGradient colors={stops.colors} locations={stops.at} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[StyleSheet.absoluteFill, { borderRadius: height / 2 }]} />
        <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: height / 2, bottom: height / 2 }]} />
      </Grow>
    </View>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={spoken}>
        {bar}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint={t('Opens the breakdown')}
      hitSlop={{ top: 12, bottom: 12 }}
      style={({ pressed }) => pressed && { opacity: 0.8 }}
    >
      {bar}
    </Pressable>
  );
}

/** Colour stops for a mix: each sound at the middle of its share. */
export function blend(shares: readonly Pick<SoundShare, 'tag' | 'share'>[]): { colors: [string, string, ...string[]]; at: [number, number, ...number[]] } {
  if (!shares.length) return { colors: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.08)'], at: [0, 1] };
  const total = shares.reduce((a, s) => a + s.share, 0) || 1;
  let from = 0;
  const colors: string[] = [];
  const at: number[] = [];
  for (const s of shares) {
    const w = s.share / total;
    colors.push(SOUND_COLOR[s.tag]);
    at.push(Math.min(1, from + w / 2));
    from += w;
  }
  if (colors.length === 1) return { colors: [colors[0], colors[0]], at: [0, 1] };
  at[0] = 0;
  at[at.length - 1] = 1;
  return { colors: colors as [string, string, ...string[]], at: at as [number, number, ...number[]] };
}

/** The band grows in from the left (still with reduced motion). */
function Grow({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const grow = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) grow.set(withDelay(60, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })));
  }, [grow, reduceMotion]);
  const style = useAnimatedStyle(() => ({ width: `${grow.get() * 100}%` }));
  return <Animated.View style={[styles.grow, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' },
  grow: { height: '100%', overflow: 'hidden' },
});
