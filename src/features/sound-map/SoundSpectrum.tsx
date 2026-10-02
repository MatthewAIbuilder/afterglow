import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { SOUND_LABEL } from '../../data/models';
import { haptic } from '../../lib/haptics';
import type { SoundShare } from '../taste/lean';
import { SOUND_COLOR } from './colors';

/**
 * A sound mix as one glowing line of colour: each sound its own light,
 * as wide as its share. Grows in from the left, and glides when the mix
 * changes (still with reduced motion). Read out as the percentages.
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
  const spoken = `${label}: ${shares.map((s) => `${SOUND_LABEL[s.tag]} ${s.percent} percent`).join(', ')}`;
  const bar = (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      {shares.map((s, i) => (
        <Segment key={s.tag} share={s.share} color={SOUND_COLOR[s.tag]} index={i} last={i === shares.length - 1} />
      ))}
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
      accessibilityHint="Opens the breakdown"
      hitSlop={{ top: 12, bottom: 12 }}
      style={({ pressed }) => pressed && { opacity: 0.8 }}
    >
      {bar}
    </Pressable>
  );
}

function Segment({ share, color, index, last }: { share: number; color: string; index: number; last: boolean }) {
  const reduceMotion = useReducedMotion();
  const grow = useSharedValue(reduceMotion ? share : 0);
  useEffect(() => {
    grow.set(reduceMotion ? share : withDelay(60 * index, withTiming(share, { duration: 800, easing: Easing.out(Easing.cubic) })));
  }, [share, index, grow, reduceMotion]);
  const style = useAnimatedStyle(() => ({ width: `${grow.get() * 100}%` }));
  return (
    <Animated.View
      style={[
        styles.segment,
        { backgroundColor: color, shadowColor: color, marginRight: last ? 0 : 2 },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', overflow: 'visible', backgroundColor: 'rgba(255,255,255,0.05)' },
  // flexShrink lets the 2 pt gaps come out of the segments, so the line never runs past its track.
  segment: { height: '100%', flexShrink: 1, borderRadius: 3, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
});
