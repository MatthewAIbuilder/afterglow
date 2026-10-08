import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { color, PRIDE, rainbow } from '../theme/tokens';

// Pride: every colour of the flag.
const COLORS: readonly string[] = PRIDE ? rainbow : [color.glow, '#FF7EB6', '#FFB86B', '#6FC3FF', '#7CF2C8', '#FFD36E'];
const PIECES = 24;

/** The same little scatter every time, so nothing flickers between renders. */
const rnd = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * A pop of confetti from the middle of whatever it sits in: pieces fly up and
 * out, tumble and fall away. Give it a new `key` to fire again. Never takes
 * touches; nothing with reduced motion.
 */
export function ConfettiBurst({ spread = 120 }: { spread?: number }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduced) t.set(withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) }));
  }, [t, reduced]);
  if (reduced) return null;
  return (
    <View style={styles.wrap} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: PIECES }, (_, i) => (
        <Piece key={i} i={i} t={t} spread={spread} />
      ))}
    </View>
  );
}

function Piece({ i, t, spread }: { i: number; t: SharedValue<number>; spread: number }) {
  // Mostly upwards, fanned out.
  const angle = -Math.PI / 2 + (rnd(i, 1) - 0.5) * Math.PI * 1.1;
  const speed = spread * (0.6 + rnd(i, 2) * 0.6);
  const spin = (rnd(i, 3) - 0.5) * 1080;
  const w = 5 + rnd(i, 4) * 4;
  const style = useAnimatedStyle(() => {
    const p = t.get();
    const x = Math.cos(angle) * speed * p;
    // Up first, then gravity wins.
    const y = Math.sin(angle) * speed * p + p * p * spread * 1.1;
    return {
      opacity: p <= 0 ? 0 : p < 0.7 ? 1 : (1 - p) / 0.3,
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${spin * p}deg` }, { scaleY: 0.4 + Math.abs(Math.cos(p * 9 + i)) * 0.6 }],
    };
  });
  return <Animated.View style={[styles.piece, { width: w, height: w * 1.6, backgroundColor: COLORS[i % COLORS.length] }, style]} />;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, overflow: 'visible' },
  piece: { position: 'absolute', borderRadius: 1.5 },
});
