import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { SOUND_LABEL } from '../../data/models';
import { color, radius, space, type } from '../../theme/tokens';
import type { SoundShare } from './lean';

type Props = {
  shares: SoundShare[];
  /** Grow the bars in when shown (off with reduced motion). */
  animate?: boolean;
};

/**
 * A mix of sounds as ranked bars: name, bar, percentage. One colour (the glow)
 * for size only; the names say which sound is which. Bars are to scale: a full
 * track is 100%.
 */
export function SoundBreakdown({ shares, animate = true }: Props) {
  return (
    <View style={styles.list}>
      {shares.map((s, i) => (
        <Row key={s.tag} share={s} index={i} animate={animate} />
      ))}
    </View>
  );
}

function Row({ share, index, animate }: { share: SoundShare; index: number; animate: boolean }) {
  const reduceMotion = useReducedMotion();
  const still = !animate || reduceMotion;
  const grow = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) grow.value = 1;
    else grow.value = withDelay(80 * index, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [still, index, grow]);
  const fill = useAnimatedStyle(() => ({ width: `${share.share * 100 * grow.value}%` }));
  const label = SOUND_LABEL[share.tag];

  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}, ${share.percent} percent`}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, index === 0 && styles.top, fill]} />
      </View>
      <Text style={styles.percent}>{share.percent}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  label: { ...type.label, color: color.moon, width: 104 },
  track: { flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: color.glass, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: 'rgba(169,124,255,0.7)' },
  top: { backgroundColor: color.glow },
  percent: { ...type.label, color: color.moonDim, width: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
