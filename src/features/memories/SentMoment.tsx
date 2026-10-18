import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { ConfettiBurst } from '../../components/ConfettiBurst';
import { haptic } from '../../lib/haptics';
import { color, motion, nightA, space, type } from '../../theme/tokens';
import { t } from '../../i18n';
import { onSent, type Sent } from './sent';

/** How long the moment stays (a tap closes it sooner). */
const SHOW_MS = 2800;
const ORB = 120;

/**
 * The little moment after a video goes to Discover or your crew: one of three
 * looks (rings of light, a burst of sparks, a drop of water), "Shared to
 * Discover" and a line about looking after yourself. Lives in the root
 * layout, over wherever you land; never blocks for long (a tap closes it).
 * Reduced motion: it just fades in and out.
 */
export function SentMoment() {
  const [shown, setShown] = useState<(Sent & { key: number }) | undefined>();
  const keys = useRef(0);
  useEffect(
    () =>
      onSent((s) => {
        haptic.celebrate();
        setShown({ ...s, key: ++keys.current });
      }),
    [],
  );
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(undefined), SHOW_MS);
    return () => clearTimeout(timer);
  }, [shown]);
  if (!shown) return null;
  return <Moment key={shown.key} sent={shown} onClose={() => setShown(undefined)} />;
}

function Moment({ sent, onClose }: { sent: Sent; onClose: () => void }) {
  const reduced = useReducedMotion();
  const veil = useSharedValue(0);
  const words = useSharedValue(0);
  const pop = useSharedValue(reduced ? 1 : 0.3);
  const rings = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  useEffect(() => {
    veil.set(withSequence(withTiming(1, { duration: 220 }), withDelay(SHOW_MS - 620, withTiming(0, { duration: 400 }))));
    words.set(withDelay(reduced ? 0 : 260, withSpring(1, motion.gentle)));
    if (!reduced) {
      pop.set(withSpring(1, motion.bloom));
      rings.forEach((r, i) => r.set(withDelay(120 + i * 260, withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }))));
    }
    // Shared values are stable; this runs once per moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.get() }));
  const wordsStyle = useAnimatedStyle(() => ({ opacity: words.get(), transform: [{ translateY: (1 - words.get()) * 14 }] }));
  const orbStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.veil, veilStyle]} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('{title}. {line} Tap to close.', { title: sent.title, line: sent.line })}>
        <View style={styles.center}>
          <View style={styles.stage}>
            {!reduced && sent.look === 'rings' ? rings.map((r, i) => <Ring key={i} at={r} />) : null}
            {!reduced && sent.look === 'drop' ? <Ring at={rings[1]} tint={DROP} /> : null}
            {sent.look === 'sparks' ? <ConfettiBurst spread={150} /> : null}
            <Animated.View style={[styles.orb, sent.look === 'drop' && styles.dropOrb, orbStyle]}>
              {sent.look === 'drop' ? <View style={styles.drop} /> : <Text style={styles.check}>✓</Text>}
            </Animated.View>
          </View>
          <Animated.View style={[styles.words, wordsStyle]}>
            <Text style={styles.title}>{sent.title}</Text>
            <Text style={styles.line}>{sent.line}</Text>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const DROP = '#7CC8FF';

/** A ring of light spreading out from the middle and fading. */
function Ring({ at, tint = color.glow }: { at: SharedValue<number>; tint?: string }) {
  const style = useAnimatedStyle(() => ({ opacity: 0.85 * (1 - at.get()), transform: [{ scale: 0.6 + 1.6 * at.get() }] }));
  return <Animated.View style={[styles.ring, { borderColor: tint }, style]} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  veil: { backgroundColor: nightA(0.72), zIndex: 1000 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xxl },
  stage: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: ORB, height: ORB, borderRadius: ORB / 2, borderWidth: 2 },
  orb: {
    width: ORB * 0.66,
    height: ORB * 0.66,
    borderRadius: ORB,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glow,
    shadowColor: color.glow,
    shadowOpacity: 0.9,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
  },
  dropOrb: { backgroundColor: 'rgba(124,200,255,0.18)', shadowColor: DROP },
  // A drop of water: a rounded square turned so one corner points up.
  drop: { width: 34, height: 34, backgroundColor: DROP, borderTopLeftRadius: 2, borderTopRightRadius: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, transform: [{ rotate: '-45deg' }], marginTop: 8 },
  check: { fontSize: 34, lineHeight: 40, color: color.night, fontWeight: '700' },
  words: { alignItems: 'center', marginTop: space.lg, maxWidth: 320 },
  title: { ...type.title, color: color.moon, textAlign: 'center' },
  line: { ...type.body, color: color.moonDim, textAlign: 'center', marginTop: space.sm },
});
