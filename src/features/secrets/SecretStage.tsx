import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { t } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { onSecret } from '../../state/secrets';
import { color, motion, radius, space, type } from '../../theme/tokens';
import { SECRET_GLOW, SECRETS, type SecretEffect, type SecretId } from './secrets';

/** The festival colours every moment draws from. */
const LIGHTS = [color.glow, '#FF7EB6', '#6FC3FF', '#FFB86B', '#7CF2C8'];
/** How long each moment plays. */
const LENGTH: Record<SecretEffect, number> = { lightshow: 3800, hearts: 3600, sunrise: 3400, fireworks: 3400, bassdrop: 2600, sparkle: 2400 };

/** A little pseudo-random number for item i, so every play looks the same and nothing flickers between renders. */
const rnd = (i: number, salt = 1) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

type Playing = { key: number; id: SecretId; effect: SecretEffect; first: boolean };

/**
 * Plays secrets: a moment over the whole app (lasers, hearts, fireworks, a
 * sunrise, a bass drop, sparkles) with haptics to match, and, the first
 * time, a small purple toast saying what you found. Never takes touches
 * except the toast. With reduced motion, only the toast.
 */
export function SecretStage() {
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState<Playing | undefined>();
  useEffect(
    () =>
      onSecret((id, first) => {
        const spec = SECRETS.find((s) => s.id === id);
        if (!spec) return;
        setPlaying((p) => ({ key: (p?.key ?? 0) + 1, id, effect: spec.effect, first }));
      }),
    [],
  );
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setPlaying((p) => (p?.key === playing.key ? undefined : p)), LENGTH[playing.effect] + (playing.first ? 900 : 0));
    return () => clearTimeout(t);
  }, [playing]);
  useEffect(() => {
    if (playing) return feel(playing.effect);
  }, [playing]);
  if (!playing) return null;
  const spec = SECRETS.find((s) => s.id === playing.id)!;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {!reduced ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none" testID={`secret-${playing.effect}`}>
          {playing.effect === 'lightshow' ? <LightShow key={playing.key} /> : null}
          {playing.effect === 'hearts' ? <HeartRain key={playing.key} /> : null}
          {playing.effect === 'fireworks' ? <Fireworks key={playing.key} /> : null}
          {playing.effect === 'sunrise' ? <Sunrise key={playing.key} /> : null}
          {playing.effect === 'bassdrop' ? <BassDrop key={playing.key} /> : null}
          {playing.effect === 'sparkle' ? <Sparkle key={playing.key} /> : null}
        </View>
      ) : null}
      {playing.first ? <FoundToast key={`t${playing.key}`} title={spec.title} line={spec.found} /> : null}
    </View>
  );
}

/** Haptics to match each moment. Returns a way to stop them. */
function feel(effect: SecretEffect): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const at = (ms: number, f: () => void) => timers.push(setTimeout(f, ms));
  if (effect === 'lightshow') for (let i = 0; i < 14; i++) at(i * 250, i % 4 === 0 ? haptic.tap : haptic.soft);
  if (effect === 'hearts') [0, 500, 1000].forEach((ms) => at(ms, haptic.soft));
  if (effect === 'fireworks') [200, 800, 1300, 1900, 2400].forEach((ms) => at(ms, haptic.tap));
  if (effect === 'sunrise') [0, 1200].forEach((ms) => at(ms, haptic.settle));
  if (effect === 'sparkle') at(0, haptic.celebrate);
  if (effect === 'bassdrop') {
    // The build: faster and faster, then the drop.
    [0, 400, 700, 900, 1040, 1140, 1210].forEach((ms) => at(ms, haptic.select));
    at(1300, haptic.heavy);
    at(1420, haptic.heavy);
    at(1700, haptic.tap);
  }
  return () => timers.forEach(clearTimeout);
}

function useProgress(ms: number, delay = 0, easing = Easing.out(Easing.cubic)) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withDelay(delay, withTiming(1, { duration: ms, easing })));
  }, [p, ms, delay, easing]);
  return p;
}

/** Laser beams sweeping up from the bottom corners, with strobes and a haze. */
function LightShow() {
  const { width, height } = useWindowDimensions();
  const fade = useSharedValue(0);
  useEffect(() => {
    fade.set(withSequence(withTiming(1, { duration: 260 }), withDelay(3000, withTiming(0, { duration: 500 }))));
  }, [fade]);
  const flash = useSharedValue(0);
  useEffect(() => {
    flash.set(withDelay(600, withRepeat(withSequence(withTiming(0.22, { duration: 50 }), withTiming(0, { duration: 180 })), 6, false)));
  }, [flash]);
  const wrap = useAnimatedStyle(() => ({ opacity: fade.get() }));
  const strobe = useAnimatedStyle(() => ({ opacity: flash.get() }));
  const beams = Array.from({ length: 10 }, (_, i) => i);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, wrap]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,4,14,0.45)' }]} />
      {beams.map((i) => (
        <Beam key={i} i={i} x={i % 2 ? width + 10 : -10} y={height + 10} length={Math.hypot(width, height) * 1.1} />
      ))}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }, strobe]} />
    </Animated.View>
  );
}

function Beam({ i, x, y, length }: { i: number; x: number; y: number; length: number }) {
  const left = i % 2 === 0;
  const base = left ? 20 + rnd(i) * 35 : -(20 + rnd(i) * 35);
  const swing = 18 + rnd(i, 2) * 22;
  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.set(withRepeat(withTiming(1, { duration: 700 + rnd(i, 3) * 600, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [sweep, i]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${base + (sweep.get() - 0.5) * swing * (left ? 1 : -1)}deg` }] }));
  const tint = LIGHTS[i % LIGHTS.length];
  // A box twice the beam's length, centred on the corner: the beam runs from its centre up, so it turns around the corner.
  return (
    <Animated.View style={[{ position: 'absolute', left: x - length, top: y - length, width: length * 2, height: length * 2, alignItems: 'center' }, style]}>
      <LinearGradient colors={['rgba(255,255,255,0)', tint, '#FFFFFF']} locations={[0, 0.85, 1]} style={{ width: 3, height: length, borderRadius: 2, shadowColor: tint, shadowOpacity: 1, shadowRadius: 8 }} />
    </Animated.View>
  );
}

/** Hearts falling and swaying, and the four words. */
function HeartRain() {
  const { width, height } = useWindowDimensions();
  const words = useSharedValue(0);
  useEffect(() => {
    words.set(withSequence(withSpring(1, motion.bloom), withDelay(2400, withTiming(0, { duration: 400 }))));
  }, [words]);
  const wordsStyle = useAnimatedStyle(() => ({ opacity: words.get(), transform: [{ scale: 0.8 + words.get() * 0.2 }] }));
  return (
    <View style={StyleSheet.absoluteFill}>
      {Array.from({ length: 30 }, (_, i) => (
        <FallingHeart key={i} i={i} width={width} height={height} />
      ))}
      <Animated.View style={[styles.center, wordsStyle]}>
        <Text style={styles.plur}>{t('Peace · Love · Unity · Respect')}</Text>
      </Animated.View>
    </View>
  );
}

function FallingHeart({ i, width, height }: { i: number; width: number; height: number }) {
  const p = useProgress(2400 + rnd(i, 4) * 1000, rnd(i, 5) * 900, Easing.in(Easing.quad));
  const x = rnd(i) * width;
  const size = 14 + rnd(i, 6) * 18;
  const style = useAnimatedStyle(() => {
    const t = p.get();
    return {
      opacity: t < 0.85 ? 1 : (1 - t) / 0.15,
      transform: [{ translateX: x + Math.sin(t * 6 + i) * 18 }, { translateY: -40 + t * (height + 80) }, { rotate: `${Math.sin(t * 4 + i) * 20}deg` }],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 20.3s-7.8-4.6-7.8-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.8 2.5c0 5.6-7.8 10.2-7.8 10.2z" fill={LIGHTS[i % 2 ? 1 : 0]} />
      </Svg>
    </Animated.View>
  );
}

/** Bursts of light, one after another. */
function Fireworks() {
  const { width, height } = useWindowDimensions();
  return (
    <View style={StyleSheet.absoluteFill}>
      {[0, 1, 2, 3, 4].map((b) => (
        <Burst key={b} b={b} x={width * (0.2 + rnd(b, 7) * 0.6)} y={height * (0.18 + rnd(b, 8) * 0.4)} />
      ))}
    </View>
  );
}

function Burst({ b, x, y }: { b: number; x: number; y: number }) {
  const p = useProgress(1600, 150 + b * 480);
  const tint = LIGHTS[b % LIGHTS.length];
  return (
    <>
      {Array.from({ length: 26 }, (_, i) => (
        <Particle key={i} p={p} angle={(i / 26) * Math.PI * 2 + rnd(b, 9)} reach={70 + rnd(i, b) * 80} x={x} y={y} tint={i % 3 ? tint : '#FFFFFF'} big={i % 4 === 0} />
      ))}
    </>
  );
}

function Particle({ p, angle, reach, x, y, tint, big }: { p: SharedValue<number>; angle: number; reach: number; x: number; y: number; tint: string; big?: boolean }) {
  const style = useAnimatedStyle(() => {
    const t = p.get();
    return {
      opacity: t <= 0 ? 0 : 1 - t * t,
      transform: [{ translateX: x + Math.cos(angle) * reach * Math.sqrt(t) }, { translateY: y + Math.sin(angle) * reach * Math.sqrt(t) + t * t * 60 }, { scale: 1.2 - t * 0.7 }],
    };
  });
  return <Animated.View style={[styles.particle, big && styles.particleBig, { backgroundColor: tint, shadowColor: tint }, style]} />;
}

/** The sky warms from the bottom and a sun rises. */
function Sunrise() {
  const { width, height } = useWindowDimensions();
  const p = useProgress(2600, 0, Easing.out(Easing.quad));
  const out = useSharedValue(1);
  useEffect(() => {
    out.set(withDelay(2700, withTiming(0, { duration: 600 })));
  }, [out]);
  const sky = useAnimatedStyle(() => ({ opacity: out.get() * Math.min(1, p.get() * 1.6), transform: [{ translateY: (1 - p.get()) * height * 0.5 }] }));
  const sun = useAnimatedStyle(() => ({ opacity: out.get(), transform: [{ translateY: height * 0.82 - p.get() * height * 0.3 }] }));
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, sky]}>
        <LinearGradient colors={['rgba(255,126,182,0)', 'rgba(255,126,182,0.28)', 'rgba(255,184,107,0.55)']} locations={[0.35, 0.7, 1]} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: width / 2 - 70, top: 0 }, sun]}>
        <View style={styles.sun} />
      </Animated.View>
      <View style={styles.center}>
        <Text style={styles.plur}>{t('Up for the sunrise')}</Text>
      </View>
    </View>
  );
}

/** Rings of bass rolling out from the middle after a short build. */
function BassDrop() {
  const { width, height } = useWindowDimensions();
  const build = useProgress(1250, 0, Easing.in(Easing.cubic));
  const flash = useSharedValue(0);
  useEffect(() => {
    flash.set(withDelay(1300, withSequence(withTiming(0.5, { duration: 60 }), withTiming(0, { duration: 500 }))));
  }, [flash]);
  const buildStyle = useAnimatedStyle(() => ({ opacity: build.get() * 0.6, transform: [{ scale: 0.4 + build.get() * 0.4 }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() }));
  const size = Math.max(width, height) * 1.4;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color.glowDeep }, flashStyle]} />
      <Animated.View style={[styles.center, buildStyle]}>
        <View style={[styles.core, { borderColor: color.glow }]} />
      </Animated.View>
      {[0, 1, 2, 3].map((r) => (
        <Ring key={r} delay={1300 + r * 140} size={size} tint={LIGHTS[r % LIGHTS.length]} />
      ))}
    </View>
  );
}

function Ring({ delay, size, tint }: { delay: number; size: number; tint: string }) {
  const p = useProgress(900, delay);
  const style = useAnimatedStyle(() => ({ opacity: p.get() <= 0 ? 0 : 1 - p.get(), transform: [{ scale: 0.05 + p.get() }] }));
  return (
    <View style={styles.center}>
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, borderWidth: 6, borderColor: tint }, style]} />
    </View>
  );
}

/** Stars twinkling all over. */
function Sparkle() {
  const { width, height } = useWindowDimensions();
  return (
    <View style={StyleSheet.absoluteFill}>
      {Array.from({ length: 26 }, (_, i) => (
        <Star key={i} i={i} x={rnd(i, 10) * width} y={rnd(i, 11) * height * 0.85} />
      ))}
    </View>
  );
}

function Star({ i, x, y }: { i: number; x: number; y: number }) {
  const p = useProgress(900, rnd(i, 12) * 1300, Easing.inOut(Easing.sin));
  const style = useAnimatedStyle(() => {
    const t = p.get();
    const s = Math.sin(t * Math.PI);
    return { opacity: s, transform: [{ translateX: x }, { translateY: y }, { scale: 0.4 + s }, { rotate: `${t * 90}deg` }] };
  });
  const size = 10 + rnd(i, 13) * 14;
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 1c.8 6 4.9 10.2 11 11-6.1.8-10.2 5-11 11-.8-6-4.9-10.2-11-11 6.1-.8 10.2-5 11-11z" fill={LIGHTS[i % LIGHTS.length]} />
      </Svg>
    </Animated.View>
  );
}

/** "Secret found": the first time only. Opens your secrets. */
function FoundToast({ title, line }: { title: string; line: string }) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const y = useSharedValue(reduced ? 0 : 160);
  useEffect(() => {
    if (reduced) return;
    y.set(withDelay(500, withSequence(withSpring(0, motion.snappy), withDelay(2800, withTiming(200, { duration: 300 })))));
  }, [y, reduced]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <Animated.View style={[styles.toastWrap, { bottom: insets.bottom + 96 }, style]} pointerEvents="box-none">
      <Pressable
        onPress={() => {
          haptic.select();
          router.push('/secrets');
        }}
        accessibilityRole="button"
        accessibilityLiveRegion="polite"
        accessibilityLabel={t('Secret found: {title}. Plus {glow} glow. Opens your secrets.', { title, glow: SECRET_GLOW })}
        style={styles.toast}
        testID="secret-toast"
      >
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>{t('Secret found')}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.line} numberOfLines={2}>
            {line}
          </Text>
        </View>
        <Text style={styles.glow}>+{SECRET_GLOW}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  plur: { ...type.title, color: color.moon, textAlign: 'center', textShadowColor: color.glow, textShadowRadius: 18, paddingHorizontal: space.xl },
  particle: { position: 'absolute', left: 0, top: 0, width: 7, height: 7, borderRadius: 3.5, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  particleBig: { width: 10, height: 10, borderRadius: 5 },
  sun: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FFC27A',
    shadowColor: '#FFB86B',
    shadowOpacity: 0.9,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: 0 },
  },
  core: { width: 120, height: 120, borderRadius: 60, borderWidth: 3 },
  toastWrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(40,20,80,0.55)',
    borderWidth: 1,
    borderColor: color.glow,
  },
  kicker: { ...type.caption, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: color.glow },
  title: { ...type.headline, color: color.moon },
  line: { ...type.caption, color: color.moonDim },
  glow: { ...type.headline, color: color.glow },
});
