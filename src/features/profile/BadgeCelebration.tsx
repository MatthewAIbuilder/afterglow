import { useEffect, useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type } from '../../theme/tokens';
import { pinAbout, pinLook } from '../badges/badges';
import { EnamelPin } from '../badges/EnamelPin';
import type { Milestone } from './milestones';
import { Medal, medalColors } from './Milestones';

export type Unlock = { kind: 'pin'; festival: Festival } | { kind: 'milestone'; milestone: Milestone };

const RAYS = 18;
const SPARKS = 26;
/** The badge's size at the heart of the burst. */
const BADGE = 190;

/**
 * The moment you claim a badge: the screen dims, rays in its colours turn
 * slowly behind it, a ring of light bursts out with sparks, and the badge
 * springs in with a little wobble before settling into a glow. Then what it
 * is and "Add to collection". With reduced motion: the badge and words, still.
 */
export function BadgeCelebration({ unlock, onDone }: { unlock: Unlock | undefined; onDone: () => void }) {
  return (
    <Modal visible={!!unlock} transparent animationType="fade" statusBarTranslucent onRequestClose={onDone}>
      {unlock ? <Burst unlock={unlock} onDone={onDone} /> : null}
    </Modal>
  );
}

function Burst({ unlock, onDone }: { unlock: Unlock; onDone: () => void }) {
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const look = unlock.kind === 'pin' ? pinLook(unlock.festival) : undefined;
  const [c1, c2] = unlock.kind === 'pin' && look ? [look.palette.accent, look.palette.ribbon] : unlock.kind === 'milestone' ? medalColors(unlock.milestone.id) : ['#A97CFF', '#FFB86B'];
  const colors = [c1, c2, '#FFE38A', '#FFFFFF'];
  const title = unlock.kind === 'pin' ? unlock.festival.name : unlock.milestone.title;
  const about = unlock.kind === 'pin' ? pinAbout(unlock.festival, true) : unlock.milestone.about;

  const pop = useSharedValue(reduce ? 1 : 0);
  const wobble = useSharedValue(0);
  const ring = useSharedValue(0);
  const spin = useSharedValue(0);
  const glow = useSharedValue(reduce ? 1 : 0);
  const sparks = useSharedValue(0);
  useEffect(() => {
    // A double beat: the pop, then the settle.
    haptic.celebrate();
    const t = setTimeout(() => haptic.tap(), 380);
    if (reduce) return () => clearTimeout(t);
    pop.set(withDelay(120, withSpring(1, { damping: 7, stiffness: 140, mass: 0.9 })));
    wobble.set(withDelay(120, withSequence(withTiming(-14, { duration: 140 }), withSpring(0, { damping: 5, stiffness: 160 }))));
    ring.set(withDelay(200, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })));
    sparks.set(withDelay(200, withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) })));
    spin.set(withRepeat(withTiming(1, { duration: 24000, easing: Easing.linear }), -1, false));
    glow.set(withDelay(500, withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true)));
    return () => {
      clearTimeout(t);
      cancelAnimation(spin);
      cancelAnimation(glow);
    };
  }, [reduce, pop, wobble, ring, spin, glow, sparks]);

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.get() * 2),
    transform: [{ scale: 0.3 + 0.7 * pop.get() }, { rotate: `${wobble.get()}deg` }],
  }));
  const raysStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.get()) * 0.9,
    transform: [{ rotate: `${spin.get() * 360}deg` }, { scale: 0.6 + 0.4 * Math.min(1, pop.get()) }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: (1 - ring.get()) * 0.9,
    transform: [{ scale: 0.4 + 2.2 * ring.get() }],
  }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.45 + 0.35 * glow.get(), transform: [{ scale: 0.95 + 0.1 * glow.get() }] }));

  const field = Math.min(width, 420);
  return (
    <View style={styles.root} accessibilityViewIsModal>
      <Animated.View entering={reduce ? undefined : FadeIn.duration(250)} style={[StyleSheet.absoluteFill, styles.scrim]} />
      <View style={[styles.stage, { width: field, height: field }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {reduce ? null : (
          <Animated.View style={[StyleSheet.absoluteFill, raysStyle]}>
            <Rays size={field} colors={[c1, c2]} />
          </Animated.View>
        )}
        <Animated.View style={[styles.halo, { width: BADGE * 1.5, height: BADGE * 1.5, borderRadius: BADGE, backgroundColor: `${c1}40`, shadowColor: c1 }, haloStyle]} />
        {reduce ? null : <Animated.View style={[styles.ring, { width: BADGE, height: BADGE, borderRadius: BADGE / 2, borderColor: c2 }, ringStyle]} />}
        {reduce
          ? null
          : Array.from({ length: SPARKS }, (_, i) => <Spark key={i} index={i} progress={sparks} color={colors[i % colors.length]} reach={field / 2 - 10} />)}
        <Animated.View style={badgeStyle}>
          {unlock.kind === 'pin' && look ? <EnamelPin look={look} size={BADGE} /> : unlock.kind === 'milestone' ? <Medal milestone={unlock.milestone} size={BADGE * 0.8} /> : null}
        </Animated.View>
      </View>

      <Animated.View entering={reduce ? undefined : FadeInDown.delay(450).duration(420)} style={styles.words}>
        <Text style={[styles.kicker, { color: '#FFE38A' }]}>{unlock.kind === 'milestone' && unlock.milestone.quest ? 'Side quest complete' : 'Badge unlocked'}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.about}>{about}</Text>
        <Pressable
          onPress={() => {
            haptic.select();
            onDone();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Add ${title} to your collection`}
          style={({ pressed }) => [styles.button, { backgroundColor: c1 }, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.buttonText}>Add to collection</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** Thin rays in the badge's colours, fading out from the middle. */
function Rays({ size, colors }: { size: number; colors: [string, string] }) {
  const r = size / 2;
  const paths = useMemo(
    () =>
      Array.from({ length: RAYS }, (_, i) => {
        const a = (i / RAYS) * Math.PI * 2;
        const w = (Math.PI / RAYS) * 0.45;
        const p = (ang: number) => `${r + Math.cos(ang) * r} ${r + Math.sin(ang) * r}`;
        return `M ${r} ${r} L ${p(a - w)} L ${p(a + w)} Z`;
      }),
    [r],
  );
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="ray0" cx="50%" cy="50%" r="50%">
          <Stop offset="0.15" stopColor={colors[0]} stopOpacity={0.55} />
          <Stop offset="1" stopColor={colors[0]} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="ray1" cx="50%" cy="50%" r="50%">
          <Stop offset="0.15" stopColor={colors[1]} stopOpacity={0.45} />
          <Stop offset="1" stopColor={colors[1]} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <G>
        {paths.map((d, i) => (
          <Path key={i} d={d} fill={`url(#ray${i % 2})`} />
        ))}
      </G>
    </Svg>
  );
}

/** One spark flying out from the badge: angle and distance from its index, so it's the same every time. */
function Spark({ index, progress, color: c, reach }: { index: number; progress: SharedValue<number>; color: string; reach: number }) {
  const angle = (index / SPARKS) * Math.PI * 2 + (index % 3) * 0.17;
  const dist = reach * (0.55 + ((index * 37) % 45) / 100);
  const size = 4 + ((index * 13) % 5);
  const style = useAnimatedStyle(() => {
    const t = progress.get();
    return {
      opacity: t <= 0 ? 0 : Math.max(0, 1 - t * 1.05),
      transform: [{ translateX: Math.cos(angle) * dist * t }, { translateY: Math.sin(angle) * dist * t + 40 * t * t }, { scale: 1 - 0.5 * t }],
    };
  });
  return <Animated.View style={[styles.spark, { width: size, height: size, borderRadius: size / 2, backgroundColor: c, shadowColor: c }, style]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  scrim: { backgroundColor: 'rgba(6,5,16,0.94)' },
  stage: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', shadowOpacity: 1, shadowRadius: 40, shadowOffset: { width: 0, height: 0 } },
  ring: { position: 'absolute', borderWidth: 3 },
  spark: { position: 'absolute', shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  words: { alignItems: 'center', maxWidth: 420, marginTop: -space.xl },
  kicker: { ...type.label, textTransform: 'uppercase', letterSpacing: 2 },
  title: { ...type.largeTitle, fontSize: 30, lineHeight: 36, color: color.moon, textAlign: 'center', marginTop: space.xs },
  about: { ...type.body, color: color.moonDim, textAlign: 'center', marginTop: space.sm },
  button: { marginTop: space.xl, alignSelf: 'stretch', minHeight: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xxl },
  buttonText: { ...type.headline, color: color.night },
});
