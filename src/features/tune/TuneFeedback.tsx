import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { color, motion, radius, space, type, glowA } from '../../theme/tokens';
import type { Rating } from '../taste/ratings';
import { t } from '../../i18n';

/** Every this many answers, a little celebration. */
export const TUNE_MILESTONE = 10;

/** What pops up as you answer, and its colour. */
export function answerPop(answer: Rating | 'unsure'): { text: string; tint: string } {
  switch (answer) {
    case 'love':
      return { text: `♥ ${t('Love')}`, tint: '#FF7EB6' };
    case 'like':
      return { text: `♡ ${t('Like')}`, tint: color.glow };
    case 'ok':
      return { text: t('OK'), tint: color.moonDim };
    case 'meh':
      return { text: t('Not really'), tint: color.moonFaint };
    case 'pass':
      return { text: t('Not for you'), tint: color.moonFaint };
    default:
      return { text: t('Skipped'), tint: color.moonFaint };
  }
}

/** "10 rated · your plan just got sharper" at each milestone. */
export const milestoneLine = (n: number) => (n === TUNE_MILESTONE ? t('{n} rated · your plan just got sharper', { n }) : t('{n} rated · you’re on a roll', { n }));

/** The answer you just gave, floating up and away from the card. Keyed by step, so each answer pops once. */
export function AnswerPop({ answer }: { answer: Rating | 'unsure' }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduced) t.set(withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [t, reduced]);
  const style = useAnimatedStyle(() => ({
    opacity: t.get() < 0.6 ? 1 : 1 - (t.get() - 0.6) / 0.4,
    transform: [{ translateY: -t.get() * 56 }, { scale: 0.8 + Math.min(1, t.get() * 4) * 0.25 }],
  }));
  if (reduced) return null;
  const { text, tint } = answerPop(answer);
  return (
    <Animated.View style={[styles.pop, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={[styles.popText, { color: tint, textShadowColor: tint }]}>{text}</Text>
    </Animated.View>
  );
}

/** A glowing pill that springs in at each milestone, with sparks. */
export function MilestonePill({ count }: { count: number }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(reduced ? 1 : 0);
  const sparks = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    s.set(withSequence(withSpring(1, motion.bloom), withDelay(1600, withTiming(0, { duration: 300 }))));
    sparks.set(withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [s, sparks, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, s.get()), transform: [{ scale: 0.6 + s.get() * 0.4 }] }));
  return (
    <Animated.View style={[styles.milestone, style]} accessibilityLiveRegion="polite" accessibilityLabel={milestoneLine(count)}>
      {Array.from({ length: 12 }, (_, i) => (
        <Spark key={i} i={i} t={sparks} />
      ))}
      <Text style={styles.milestoneText}>{milestoneLine(count)}</Text>
    </Animated.View>
  );
}

function Spark({ i, t }: { i: number; t: { get: () => number } }) {
  const a = (i / 12) * Math.PI * 2;
  const style = useAnimatedStyle(() => ({
    opacity: t.get() > 0 ? 1 - t.get() : 0,
    transform: [{ translateX: Math.cos(a) * 90 * t.get() }, { translateY: Math.sin(a) * 34 * t.get() }],
  }));
  return <Animated.View style={[styles.spark, { backgroundColor: i % 2 ? color.glow : '#FF7EB6' }, style]} />;
}

const styles = StyleSheet.create({
  pop: { position: 'absolute', alignSelf: 'center', top: '18%', zIndex: 5 },
  popText: { ...type.title, fontWeight: '800', textShadowRadius: 14 },
  milestone: {
    position: 'absolute',
    alignSelf: 'center',
    top: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: glowA(0.22),
    borderWidth: 1,
    borderColor: color.glow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneText: { ...type.label, color: color.moon },
  spark: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5 },
});


/** Little hearts bursting out around the finished card's heart. */
export function DoneBurst() {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduced) t.set(withDelay(150, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) })));
  }, [t, reduced]);
  if (reduced) return null;
  return (
    <Animated.View style={doneStyles.wrap} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: 14 }, (_, i) => (
        <BurstHeart key={i} i={i} t={t} />
      ))}
    </Animated.View>
  );
}

function BurstHeart({ i, t }: { i: number; t: { get: () => number } }) {
  const a = (i / 14) * Math.PI * 2 - Math.PI / 2;
  const reach = 70 + (i % 3) * 18;
  const style = useAnimatedStyle(() => {
    const p = t.get();
    return {
      opacity: p > 0 ? 1 - p * p : 0,
      transform: [{ translateX: Math.cos(a) * reach * p }, { translateY: Math.sin(a) * reach * p - p * 10 }, { scale: 0.5 + p * 0.7 }],
    };
  });
  return (
    <Animated.Text style={[doneStyles.heart, { color: i % 2 ? color.glow : '#FF7EB6' }, style]}>♥</Animated.Text>
  );
}

const doneStyles = StyleSheet.create({
  wrap: { position: 'absolute', alignSelf: 'center', top: '30%', width: 1, height: 1, alignItems: 'center', justifyContent: 'center' },
  heart: { position: 'absolute', fontSize: 16 },
});
