import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { color, radius, space, type, glowA, nightA } from '../../theme/tokens';
import { upNextA11y, upNextLabel } from './autoplay';

/** "Next clip in 3 · Stay": shown under a clip you've watched to the end, before the feed moves on. Tap to stay. */
export function UpNextPill({ left, onStay }: { left: number; onStay: () => void }) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(220)} exiting={reduceMotion ? undefined : FadeOut.duration(160)} style={styles.wrap}>
      <Pressable
        onPress={onStay}
        accessibilityRole="button"
        accessibilityLabel={upNextA11y(left)}
        accessibilityLiveRegion="polite"
        hitSlop={8}
        style={({ pressed }) => [styles.pill, pressed && { opacity: 0.75 }]}
      >
        <Text style={styles.text}>
          {upNextLabel(left)}
          <Text style={styles.stay}>{'   Stay'}</Text>
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', marginBottom: space.md },
  pill: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: nightA(0.55),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.45),
  },
  text: { ...type.label, color: color.moon, fontVariant: ['tabular-nums'] },
  stay: { color: color.glow, fontWeight: '600' },
});
