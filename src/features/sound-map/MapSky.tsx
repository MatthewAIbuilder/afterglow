import { memo, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  type SharedValue,
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import type { Artist } from '../../data/models';
import { mixColor } from './colors';
import { heartColors, type Link, type Nebula, type Star, starfield } from './sky';
import { toeConstellation } from '../toes/toes';
import { useToes } from '../toes/useToes';

/**
 * The sky around the bubbles, drawn in the map's world (it pans and zooms
 * with them) except the stars, which sit far behind and move less, so the
 * map has depth. Everything here is decoration: hidden from screen readers
 * and never touched. Still with reduced motion.
 */

/** A nebula of a sound's colour behind its artists, slowly breathing. */
export const NebulaCloud = memo(function NebulaCloud({ nebula, index, ox, oy }: { nebula: Nebula; index: number; ox: number; oy: number }) {
  const reduceMotion = useReducedMotion();
  const appear = useSharedValue(reduceMotion ? 1 : 0);
  const breathe = useSharedValue(0.5);
  useEffect(() => {
    if (reduceMotion) {
      appear.set(1);
      return;
    }
    appear.set(withDelay(200 + index * 150, withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) })));
    breathe.set(withRepeat(withTiming(1, { duration: 5200 + index * 900, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [appear, breathe, index, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: appear.get() * (0.75 + 0.25 * breathe.get()),
    transform: [{ scale: (0.6 + 0.4 * appear.get()) * (0.95 + 0.1 * breathe.get()) }],
  }));
  const { x, y, r, color, weight } = nebula;
  const id = `neb-${nebula.tag}`;
  const strength = Math.min(0.7, 0.36 + weight * 0.8);
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: ox + x - r, top: oy + y - r, width: r * 2, height: r * 2 }, style]}>
      <Svg width={r * 2} height={r * 2}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={strength} />
            <Stop offset="0.45" stopColor={color} stopOpacity={strength * 0.45} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={r} cy={r} r={r} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
});

/**
 * Lines between artists who sound alike. They fade in once the bubbles have
 * settled (and again after a reshape); a chosen artist's lines light up and
 * the rest fall back.
 */
export const Constellation = memo(function Constellation({
  links,
  artist,
  selectedId,
  dimmed,
  ox,
  oy,
  delay,
  fadeKey,
}: {
  links: Link[];
  /** Changes when the lines move (a reshape): they fade in again. */
  fadeKey: string;
  artist: (id: string) => Artist | undefined;
  selectedId: string | null;
  dimmed: boolean;
  ox: number;
  oy: number;
  delay: number;
}) {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(reduceMotion ? 1 : 0);
  const first = useRef(true);
  useEffect(() => {
    if (reduceMotion) {
      shown.set(1);
      return;
    }
    // First after the bloom, then after a reshape's glide.
    const wait = first.current ? delay : 900;
    first.current = false;
    shown.set(0);
    shown.set(withDelay(wait, withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) })));
    // A new set of lines fades in afresh; the delay only matters for that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fadeKey, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: shown.get() }));
  if (!links.length) return null;
  const reach = Math.max(...links.flatMap((l) => [Math.abs(l.x1), Math.abs(l.x2), Math.abs(l.y1), Math.abs(l.y2)])) + 20;
  const size = reach * 2;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: ox - reach, top: oy - reach, width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          {links.map((l) => (
            <LinearGradient
              key={`${l.a}|${l.b}`}
              id={`ln-${l.a}-${l.b}`}
              gradientUnits="userSpaceOnUse"
              x1={l.x1 + reach}
              y1={l.y1 + reach}
              x2={l.x2 + reach}
              y2={l.y2 + reach}
            >
              <Stop offset="0" stopColor={mixColor(artist(l.a)?.sound ?? {})} />
              <Stop offset="1" stopColor={mixColor(artist(l.b)?.sound ?? {})} />
            </LinearGradient>
          ))}
        </Defs>
        {links.map((l) => {
          const lit = !!selectedId && (l.a === selectedId || l.b === selectedId);
          const base = 0.24 + 0.4 * (l.strength - 0.6);
          const opacity = lit ? 0.9 : selectedId || dimmed ? 0.05 : base;
          return (
            <Line
              key={`${l.a}|${l.b}`}
              x1={l.x1 + reach}
              y1={l.y1 + reach}
              x2={l.x2 + reach}
              y2={l.y2 + reach}
              stroke={`url(#ln-${l.a}-${l.b})`}
              strokeOpacity={opacity}
              strokeWidth={lit ? 2 : 1.4}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
    </Animated.View>
  );
});

/**
 * Your top match sits at the heart of the map: two rings of stardust in your
 * strongest sounds' colours turn slowly around it, in opposite directions.
 */
export const HeartHalo = memo(function HeartHalo({ skies, r, ox, oy }: { skies: Nebula[]; r: number; ox: number; oy: number }) {
  const reduceMotion = useReducedMotion();
  const spin = useSharedValue(0);
  const appear = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      appear.set(1);
      return;
    }
    appear.set(withDelay(500, withTiming(1, { duration: 1200 })));
    spin.set(withRepeat(withTiming(1, { duration: 40000, easing: Easing.linear }), -1));
    return () => cancelAnimation(spin);
  }, [appear, spin, reduceMotion]);
  const colors = heartColors(skies);
  const outer = r + 26;
  const size = outer * 2 + 8;
  const c = size / 2;
  const innerStyle = useAnimatedStyle(() => ({ opacity: appear.get(), transform: [{ rotate: `${spin.get() * 360}deg` }, { scale: 0.7 + 0.3 * appear.get() }] }));
  const outerStyle = useAnimatedStyle(() => ({ opacity: appear.get() * 0.7, transform: [{ rotate: `${-spin.get() * 360}deg` }, { scale: 0.7 + 0.3 * appear.get() }] }));
  const ring = (radius: number, dash: string, id: string, width: number) => (
    <Svg width={size} height={size}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          {colors.map((col, i) => (
            <Stop key={i} offset={colors.length === 1 ? 0 : i / (colors.length - 1)} stopColor={col} />
          ))}
        </LinearGradient>
      </Defs>
      <Circle cx={c} cy={c} r={radius} stroke={`url(#${id})`} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" fill="none" />
    </Svg>
  );
  const box = { position: 'absolute' as const, left: ox - c, top: oy - c, width: size, height: size };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[box, innerStyle]}>{ring(r + 12, '1 7', 'heart-in', 2.2)}</Animated.View>
      <Animated.View style={[box, outerStyle]}>{ring(outer, '18 10 2 10', 'heart-out', 1.2)}</Animated.View>
    </View>
  );
});

/** A ring of light that runs out from the heart of the map when your sound reshapes. */
export function ReshapeRipple({ pulse, color, ox, oy }: { pulse: unknown; color: string; ox: number; oy: number }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduceMotion) return;
    t.set(0);
    t.set(withTiming(1, { duration: 1600, easing: Easing.out(Easing.cubic) }));
  }, [pulse, t, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: (1 - t.get()) * 0.7, transform: [{ scale: 0.05 + t.get() }] }));
  const R = 420;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: ox - R, top: oy - R, width: R * 2, height: R * 2, borderRadius: R, borderWidth: 3, borderColor: color }, style]}
    />
  );
}

/**
 * Stars far behind the map: they move a third as much as the bubbles when you
 * pan and zoom, and twinkle in three groups out of step.
 */
export const Starfield = memo(function Starfield({
  width,
  height,
  tx,
  ty,
  scale,
}: {
  width: number;
  height: number;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  scale: SharedValue<number>;
}) {
  const W = width * 2.4;
  const H = height * 2.4;
  // For one person only: a footprint hides among the stars, off to one side.
  const toes = useToes();
  const stars = useMemo(() => {
    const field = starfield(W, H, Math.round(Math.min(140, (width * height) / 3600)));
    if (!toes) return field;
    const print = toeConstellation(-width * 0.62, -height * 0.34, 120);
    return [...field, ...print.toes.map((t) => ({ ...t, r: Math.max(1.3, t.r * 0.35), group: 1 as const })), ...print.sole.map((t) => ({ ...t, r: 0.9, group: 2 as const }))];
  }, [W, H, width, height, toes]);
  const depth = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() * 0.3 }, { translateY: ty.get() * 0.3 }, { scale: 1 + (scale.get() - 1) * 0.25 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: (width - W) / 2, top: (height - H) / 2, width: W, height: H }, depth]}>
      {[0, 1, 2].map((g) => (
        <StarGroup key={g} group={g} stars={stars} W={W} H={H} />
      ))}
    </Animated.View>
  );
});

function StarGroup({ group, stars, W, H }: { group: number; stars: Star[]; W: number; H: number }) {
  const reduceMotion = useReducedMotion();
  const twinkle = useSharedValue(0.7);
  useEffect(() => {
    if (reduceMotion) return;
    twinkle.set(
      withDelay(
        group * 900,
        withRepeat(withSequence(withTiming(1, { duration: 1800 + group * 700, easing: Easing.inOut(Easing.sin) }), withTiming(0.3, { duration: 2200 + group * 500, easing: Easing.inOut(Easing.sin) })), -1),
      ),
    );
  }, [group, twinkle, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: twinkle.get() }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width={W} height={H}>
        {stars
          .filter((s) => s.group === group)
          .map((s, i) => (
            <Circle key={i} cx={s.x + W / 2} cy={s.y + H / 2} r={s.r} fill="#F3F0FF" fillOpacity={s.r > 1.2 ? 0.8 : 0.45} />
          ))}
      </Svg>
    </Animated.View>
  );
}

const SPARKS = 10;

/** A burst of sparks in an artist's colour where you tapped their bubble. */
export function SparkBurst({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    t.set(withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [t, reduceMotion]);
  if (reduceMotion) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y, width: 0, height: 0 }}>
      {Array.from({ length: SPARKS }, (_, i) => (
        <Spark key={i} t={t} angle={(i / SPARKS) * Math.PI * 2 + (i % 2) * 0.3} from={r * 0.9} reach={r * 0.9 + 26 + (i % 3) * 12} color={color} size={i % 3 === 0 ? 5 : 3.5} />
      ))}
    </View>
  );
}

function Spark({ t, angle, from, reach, color, size }: { t: SharedValue<number>; angle: number; from: number; reach: number; color: string; size: number }) {
  const style = useAnimatedStyle(() => {
    const d = from + (reach - from) * t.get();
    return {
      opacity: t.get() < 0.15 ? t.get() / 0.15 : 1 - (t.get() - 0.15) / 0.85,
      transform: [{ translateX: Math.cos(angle) * d - size / 2 }, { translateY: Math.sin(angle) * d - size / 2 }, { scale: 1.2 - 0.6 * t.get() }],
    };
  });
  return (
    <Animated.View
      style={[
        { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color, shadowColor: color, shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
        style,
      ]}
    />
  );
}
