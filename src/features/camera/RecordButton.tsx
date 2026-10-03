import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { type GestureResponderEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { motion, glowA, nightA } from '../../theme/tokens';
import { LOCK_DISTANCE, lockProgress, RECORD_MAX_SEC } from './record';

const SIZE = 100;
const STROKE = 4;
const R = (SIZE - STROKE) / 2;
const LENGTH = 2 * Math.PI * R;
/** The lock ring around the button while you hold: where a slide locks. */
const LOCK_SIZE = (LOCK_DISTANCE + SIZE / 2) * 2;
const LOCK_R = LOCK_SIZE / 2 - 2;
const LOCK_LENGTH = 2 * Math.PI * LOCK_R;
/** Festival lights: the one purple glow, with the pink, amber and blue of a stage wash around it. */
export const RECORD_COLORS = ['#A97CFF', '#FF7EB6', '#FFB86B', '#6FC3FF'] as const;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * The big record button: a see-through glass disc inside a ring of slowly
 * turning festival colours. While recording, the disc becomes a rounded
 * square, the colours turn faster and pulse, and the ring fills towards the
 * longest clip. While you hold, a faint ring further out shows how far to
 * slide (any direction) to lock filming on; past it the button calls
 * `onLock`. Press in and out are handed up: tap, hold and lock are worked out
 * by the screen (features/camera/record.ts).
 */
export function RecordButton({
  recording,
  holding,
  locked,
  disabled,
  onPressIn,
  onPressOut,
  onLock,
  label,
}: {
  recording: boolean;
  /** Filming while held: sliding away can lock it. */
  holding?: boolean;
  locked?: boolean;
  disabled?: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
  onLock?: () => void;
  label: string;
}) {
  const reduceMotion = useReducedMotion();
  const filled = useSharedValue(0);
  const inner = useSharedValue(0);
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);
  const slide = useSharedValue(0);
  const lockPop = useSharedValue(0);
  const start = useRef<{ x: number; y: number } | undefined>(undefined);

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

  // The colours turn: slowly while waiting, faster while filming. Still with reduced motion.
  useEffect(() => {
    cancelAnimation(spin);
    cancelAnimation(pulse);
    if (reduceMotion) {
      pulse.set(recording ? 1 : 0);
      return;
    }
    const from = spin.get() % 1;
    spin.set(from);
    spin.set(withRepeat(withTiming(from + 1, { duration: recording ? 2600 : 9000, easing: Easing.linear }), -1));
    pulse.set(recording ? withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.35, { duration: 700 })), -1) : withTiming(0, { duration: 300 }));
  }, [recording, reduceMotion, spin, pulse]);

  useEffect(() => {
    if (!holding) slide.set(withTiming(0, { duration: 200 }));
  }, [holding, slide]);

  useEffect(() => {
    lockPop.set(locked ? (reduceMotion ? 1 : withSequence(withTiming(1.25, { duration: 140 }), withSpring(1, motion.bloom))) : withTiming(0, { duration: 150 }));
  }, [locked, lockPop, reduceMotion]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: LENGTH * (1 - filled.get()) }));
  const lockProps = useAnimatedProps(() => ({ strokeDashoffset: LOCK_LENGTH * (1 - slide.get()) }));
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get() * 360}deg` }] }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + 0.27 * pulse.get(),
    transform: [{ rotate: `${-spin.get() * 360}deg` }, { scale: 1 + 0.08 * pulse.get() }],
  }));
  const discStyle = useAnimatedStyle(() => {
    const t = inner.get();
    const size = 74 - 38 * t;
    return { width: size, height: size, borderRadius: size / 2 - (size / 2 - 9) * t };
  });
  const lockRingStyle = useAnimatedStyle(() => ({ opacity: interpolate(slide.get(), [0, 0.05, 1], [0, 0.5, 1]) }));
  const lockBadgeStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, lockPop.get()), transform: [{ scale: lockPop.get() }] }));

  const pageXY = (e?: GestureResponderEvent) => {
    const n = e?.nativeEvent;
    return n && typeof n.pageX === 'number' && typeof n.pageY === 'number' ? { x: n.pageX, y: n.pageY } : undefined;
  };

  return (
    <View style={styles.wrap}>
      {/* How far to slide to lock: shown only while holding, filling as you slide. */}
      <Animated.View pointerEvents="none" style={[styles.lockRing, lockRingStyle]}>
        <Svg width={LOCK_SIZE} height={LOCK_SIZE}>
          <Circle cx={LOCK_SIZE / 2} cy={LOCK_SIZE / 2} r={LOCK_R} stroke="rgba(243,240,255,0.22)" strokeWidth={1.5} strokeDasharray="3 7" fill="none" />
          <AnimatedCircle
            cx={LOCK_SIZE / 2}
            cy={LOCK_SIZE / 2}
            r={LOCK_R}
            stroke="rgba(243,240,255,0.85)"
            strokeWidth={2}
            fill="none"
            strokeDasharray={LOCK_LENGTH}
            strokeLinecap="round"
            animatedProps={lockProps}
            transform={`rotate(-90 ${LOCK_SIZE / 2} ${LOCK_SIZE / 2})`}
          />
        </Svg>
      </Animated.View>

      <Pressable
        onPressIn={(e) => {
          start.current = pageXY(e);
          onPressIn();
        }}
        onPressOut={() => {
          start.current = undefined;
          onPressOut();
        }}
        // Sliding anywhere keeps the press: letting go is what ends a hold, not leaving the button.
        pressRetentionOffset={{ top: 2000, bottom: 2000, left: 2000, right: 2000 }}
        onTouchMove={(e) => {
          const from = start.current;
          const at = pageXY(e);
          if (!holding || !from || !at) return;
          const p = lockProgress(at.x - from.x, at.y - from.y);
          slide.set(p);
          if (p >= 1) onLock?.();
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={recording ? undefined : 'Tap to start and tap again to stop, or hold to film while you hold.'}
        accessibilityState={{ disabled: !!disabled, busy: recording }}
        hitSlop={12}
        style={({ pressed }) => [styles.button, pressed && !recording && { transform: [{ scale: 0.94 }] }, disabled && { opacity: 0.4 }]}
      >
        {/* A soft colour halo behind, turning the other way. */}
        <Animated.View pointerEvents="none" style={[styles.halo, haloStyle]}>
          <LinearGradient colors={[...RECORD_COLORS, RECORD_COLORS[0]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill} />
        </Animated.View>
        {/* The ring of colours, turning. */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, spinStyle]}>
          <Svg width={SIZE} height={SIZE}>
            <Defs>
              <SvgGradient id="recordRing" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={RECORD_COLORS[0]} />
                <Stop offset="0.35" stopColor={RECORD_COLORS[1]} />
                <Stop offset="0.65" stopColor={RECORD_COLORS[2]} />
                <Stop offset="1" stopColor={RECORD_COLORS[3]} />
              </SvgGradient>
            </Defs>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="url(#recordRing)" strokeOpacity={0.75} strokeWidth={STROKE} fill="rgba(255,255,255,0.04)" />
          </Svg>
        </Animated.View>
        {/* How much of the longest clip is used: a bright line over the colours. */}
        <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill} pointerEvents="none">
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke="rgba(255,255,255,0.95)"
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={LENGTH}
            strokeLinecap="round"
            animatedProps={ringProps}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        {/* The disc: glass you can see the picture through, washed with the colours. */}
        <View style={styles.center} pointerEvents="none">
          <Animated.View style={[styles.disc, discStyle]}>
            <LinearGradient
              colors={recording ? ['rgba(255,255,255,0.9)', 'rgba(255,214,236,0.8)'] : [glowA(0.5), 'rgba(255,126,182,0.4)', 'rgba(111,195,255,0.4)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fill}
            />
          </Animated.View>
        </View>
        {/* Locked: a small padlock pops in on top. */}
        <Animated.View pointerEvents="none" style={[styles.lockBadge, lockBadgeStyle]}>
          <LockGlyph />
        </Animated.View>
      </Pressable>
    </View>
  );
}

function LockGlyph() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M5.5 11h13v9.5h-13z" fill="#fff" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  button: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', top: -6, left: -6, right: -6, bottom: -6, borderRadius: SIZE / 2 + 6, overflow: 'hidden', opacity: 0.22 },
  disc: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: RECORD_COLORS[0],
    shadowOpacity: 0.8,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  lockRing: { position: 'absolute', width: LOCK_SIZE, height: LOCK_SIZE, left: (SIZE - LOCK_SIZE) / 2, top: (SIZE - LOCK_SIZE) / 2 },
  lockBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RECORD_COLORS[0],
    borderWidth: 2,
    borderColor: nightA(0.6),
  },
});
