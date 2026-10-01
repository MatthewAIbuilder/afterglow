import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { color, motion } from '../../theme/tokens';
import { RECORD_MAX_SEC } from './record';

const SIZE = 86;
const STROKE = 4;
const R = (SIZE - STROKE) / 2;
const LENGTH = 2 * Math.PI * R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * The big record button: a glowing disc in a ring. While recording the disc
 * becomes a small rounded square and the ring fills towards the longest
 * clip. Press in and out are handed up: tap and hold are worked out by the
 * screen (features/camera/record.ts).
 */
export function RecordButton({
  recording,
  disabled,
  onPressIn,
  onPressOut,
  label,
}: {
  recording: boolean;
  disabled?: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
  label: string;
}) {
  const reduceMotion = useReducedMotion();
  const filled = useSharedValue(0);
  const inner = useSharedValue(0);

  useEffect(() => {
    if (recording) {
      filled.set(0);
      filled.set(withTiming(1, { duration: RECORD_MAX_SEC * 1000, easing: Easing.linear }));
    } else {
      cancelAnimation(filled);
      filled.set(withTiming(0, { duration: 200 }));
    }
    inner.set(reduceMotion ? (recording ? 1 : 0) : withSpring(recording ? 1 : 0, motion.bloom));
  }, [recording, filled, inner, reduceMotion]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: LENGTH * (1 - filled.get()) }));
  const discStyle = useAnimatedStyle(() => {
    const t = inner.get();
    const size = 66 - 36 * t;
    return { width: size, height: size, borderRadius: size / 2 - (size / 2 - 8) * t };
  });

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: recording }}
      hitSlop={12}
      style={({ pressed }) => [styles.button, pressed && !recording && { transform: [{ scale: 0.94 }] }, disabled && { opacity: 0.4 }]}
    >
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="rgba(243,240,255,0.85)" strokeWidth={STROKE} fill="none" />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={color.glow}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={LENGTH}
          strokeLinecap="round"
          animatedProps={ringProps}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Animated.View style={[styles.disc, recording && styles.discRecording, discStyle]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  disc: {
    backgroundColor: color.glow,
    shadowColor: color.glow,
    shadowOpacity: 0.7,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  discRecording: { backgroundColor: color.moon },
});
