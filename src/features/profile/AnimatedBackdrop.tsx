import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useId, useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, Line, Path, RadialGradient, Rect, Stop, LinearGradient as SvgGradient } from 'react-native-svg';
import type { BackdropId } from './backdrops';

/**
 * The animated backgrounds behind the top of a profile. Every style is built
 * from a few looping pieces driven by one clock (0 to 1, repeating), and every
 * movement turns a whole number of times per loop, so it never jumps. Still
 * with reduced motion, or when `still` (small previews). Never takes touches,
 * hidden from screen readers.
 */

const TAU = Math.PI * 2;
/** Where the clock rests when nothing moves: a pleasing in-between frame. */
const REST = 0.3;

type Size = { w: number; h: number };

/** How long one loop of each style lasts. */
const PERIOD: Record<BackdropId, number> = {
  aurora: 18_000,
  starfield: 24_000,
  nebula: 30_000,
  lasers: 8_000,
  synthwave: 6_000,
  equalizer: 4_000,
  waves: 10_000,
  fireflies: 16_000,
  bass: 3_200,
  lava: 26_000,
  prism: 9_000,
  vortex: 40_000,
  panda: 20_000,
  frog: 16_000,
  toes: 14_000,
  daisy: 24_000,
};

export function AnimatedBackdrop({ id, width, height, still }: { id: BackdropId; width: number; height: number; still?: boolean }) {
  const reduce = useReducedMotion();
  const quiet = still || reduce;
  const t = useSharedValue(REST);
  useEffect(() => {
    if (quiet) {
      cancelAnimation(t);
      t.set(REST);
      return;
    }
    t.set(0);
    t.set(withRepeat(withTiming(1, { duration: PERIOD[id], easing: Easing.linear }), -1, false));
    return () => cancelAnimation(t);
  }, [id, quiet, t]);

  if (!width || !height) return null;
  const Scene = SCENES[id];
  return (
    <View style={[styles.root, { width, height }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Scene t={t} w={width} h={height} />
    </View>
  );
}

type SceneProps = Size & { t: SharedValue<number> };

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

const frac = (x: number) => {
  'worklet';
  return x - Math.floor(x);
};

/** A seeded random sequence, so every profile draws the same scene. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** A wave: amplitude, whole turns per loop, and where in the turn it starts. */
type Wave = [amp: number, k: number, phase: number];
const wave = (t: number, [a, k, p]: Wave) => {
  'worklet';
  return a * Math.sin(TAU * (k * t + p));
};

type OscProps = {
  t: SharedValue<number>;
  /** Where it sits (top left) and how big it is. */
  at: ViewStyle;
  x?: Wave;
  y?: Wave;
  scale?: Wave;
  /** Opacity: a base plus a wave. */
  opacity?: number;
  flicker?: Wave;
  /** Degrees. */
  rotate?: Wave;
  /** Whole turns per loop, as well as or instead of `rotate`. */
  spin?: number;
  children?: React.ReactNode;
};

/** Something that drifts, breathes, sways or spins on the clock. */
function Osc({ t, at, x, y, scale, opacity = 1, flicker, rotate, spin = 0, children }: OscProps) {
  const style = useAnimatedStyle(() => {
    const p = t.get();
    return {
      opacity: Math.max(0, Math.min(1, opacity + (flicker ? wave(p, flicker) : 0))),
      transform: [
        { translateX: x ? wave(p, x) : 0 },
        { translateY: y ? wave(p, y) : 0 },
        { rotate: `${(rotate ? wave(p, rotate) : 0) + spin * p * 360}deg` },
        { scale: 1 + (scale ? wave(p, scale) : 0) },
      ],
    };
  });
  return <Animated.View style={[styles.abs, at, style]}>{children}</Animated.View>;
}

type TravelProps = {
  t: SharedValue<number>;
  at: ViewStyle;
  /** From where to where (relative to `at`), how many trips per loop, where it starts. */
  dx: number;
  dy: number;
  k: number;
  phase: number;
  /** Side to side as it goes. */
  sway?: Wave;
  /** Turns as it goes (degrees per trip). */
  turn?: number;
  /** Only part of each trip is seen (a shooting star): 1 = all of it. */
  window?: number;
  peak?: number;
  children?: React.ReactNode;
};

/** Something that travels and comes round again (rising lights, falling petals, shooting stars), fading in and out. */
function Travel({ t, at, dx, dy, k, phase, sway, turn = 0, window = 1, peak = 1, children }: TravelProps) {
  const style = useAnimatedStyle(() => {
    const raw = frac(k * t.get() + phase);
    const f = Math.min(1, raw / window);
    const seen = raw <= window;
    return {
      opacity: seen ? peak * Math.sin(Math.PI * f) : 0,
      transform: [{ translateX: dx * f + (sway ? wave(t.get(), sway) : 0) }, { translateY: dy * f }, { rotate: `${turn * f}deg` }],
    };
  });
  return <Animated.View style={[styles.abs, at, style]}>{children}</Animated.View>;
}

/** Something that grows from nothing and fades as it goes (rings, ripples). */
function Grow({ t, at, k, phase, peak = 1, children }: { t: SharedValue<number>; at: ViewStyle; k: number; phase: number; peak?: number; children?: React.ReactNode }) {
  const style = useAnimatedStyle(() => {
    const f = frac(k * t.get() + phase);
    return { opacity: peak * Math.pow(1 - f, 1.4) * Math.min(1, f * 8), transform: [{ scale: 0.05 + f * 0.95 }] };
  });
  return <Animated.View style={[styles.abs, at, style]}>{children}</Animated.View>;
}

/** A soft round light. */
function Glow({ size, color, opacity = 1, squash = 1 }: { size: number; color: string; opacity?: number; squash?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg width={size} height={size * squash}>
      <Defs>
        <RadialGradient id={`g${id}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.85 * opacity} />
          <Stop offset="0.45" stopColor={color} stopOpacity={0.32 * opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={size / 2} cy={(size * squash) / 2} rx={size / 2} ry={(size * squash) / 2} fill={`url(#g${id})`} />
    </Svg>
  );
}

/** A dot of light with a halo. */
function Spark({ size, color }: { size: number; color: string }) {
  return (
    <View style={{ width: size * 4, height: size * 4, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: size * 2, backgroundColor: color, opacity: 0.18 }]} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, shadowColor: color, shadowOpacity: 1, shadowRadius: size * 2, shadowOffset: { width: 0, height: 0 } }} />
    </View>
  );
}

function Sky({ colors, locations }: { colors: readonly [string, string, ...string[]]; locations?: readonly [number, number, ...number[]] }) {
  return <LinearGradient colors={colors} locations={locations} style={StyleSheet.absoluteFill} />;
}

/** A sprinkle of faint, twinkling stars. */
function Stars({ t, w, h, n, seed, color = '#F3F0FF', top = 1 }: SceneProps & { n: number; seed: number; color?: string; top?: number }) {
  const stars = useMemo(() => {
    const r = seeded(seed);
    return Array.from({ length: n }, () => ({ x: r() * w, y: r() * h * top, s: 1 + r() * 1.8, k: 1 + Math.floor(r() * 3), p: r(), o: 0.3 + r() * 0.5 }));
  }, [n, seed, w, h, top]);
  return (
    <>
      {stars.map((s, i) => (
        <Osc key={i} t={t} at={{ left: s.x, top: s.y }} opacity={s.o} flicker={[s.o * 0.7, s.k, s.p]}>
          <View style={{ width: s.s, height: s.s, borderRadius: s.s, backgroundColor: color }} />
        </Osc>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The scenes                                                          */
/* ------------------------------------------------------------------ */

function Aurora({ t, w, h }: SceneProps) {
  const curtains = [
    { c: '#38F2B0', x: -0.05, k: 1, p: 0 },
    { c: '#3FA9FF', x: 0.2, k: 2, p: 0.3 },
    { c: '#5BFFD6', x: 0.38, k: 1, p: 0.8 },
    { c: '#A97CFF', x: 0.58, k: 1, p: 0.6 },
    { c: '#38F2B0', x: 0.78, k: 2, p: 0.45 },
  ];
  const cw = w * 0.32;
  return (
    <>
      <Sky colors={['#020a18', '#06192b', '#0A0918']} />
      <Stars t={t} w={w} h={h} n={30} seed={11} top={0.7} />
      {curtains.map((c, i) => (
        <Osc
          key={i}
          t={t}
          at={{ left: w * c.x, top: -h * 0.15, width: cw, height: h * 1.05 }}
          x={[w * 0.12, c.k, c.p]}
          scale={[0.08, c.k, c.p + 0.25]}
          rotate={[12, 1, c.p]}
          opacity={0.7}
          flicker={[0.3, c.k + 1, c.p]}
        >
          <Glow size={cw} color={c.c} squash={(h * 1.05) / cw} />
        </Osc>
      ))}
    </>
  );
}

function Starfield({ t, w, h }: SceneProps) {
  const streak = Math.max(90, w * 0.3);
  return (
    <>
      <Sky colors={['#04030f', '#0b0a24', '#0A0918']} />
      <Osc t={t} at={{ left: -w * 0.2, top: h * 0.05, width: w * 1.4 }} rotate={[3, 1, 0]} opacity={0.5}>
        <Glow size={w * 1.4} color="#4A3A9A" squash={0.35} />
      </Osc>
      <Stars t={t} w={w} h={h} n={70} seed={7} />
      {[
        { x: w * 0.85, y: h * 0.05, p: 0.1 },
        { x: w * 0.55, y: h * 0.02, p: 0.6 },
      ].map((s, i) => (
        <Travel key={i} t={t} at={{ left: s.x, top: s.y }} dx={-w * 0.55} dy={h * 0.32} k={2} phase={s.p} window={0.12}>
          <View style={{ width: streak, height: 2, transform: [{ rotate: '-28deg' }] }}>
            <LinearGradient colors={['#FFFFFF', 'rgba(169,124,255,0.4)', 'rgba(169,124,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1, borderRadius: 1 }} />
          </View>
        </Travel>
      ))}
    </>
  );
}

function Nebula({ t, w, h }: SceneProps) {
  const clouds = [
    { c: '#A97CFF', x: 0.0, y: -0.2, s: 1.0, p: 0 },
    { c: '#FF7EB6', x: 0.45, y: 0.0, s: 0.9, p: 0.25 },
    { c: '#3F6BFF', x: -0.25, y: 0.25, s: 1.1, p: 0.5 },
    { c: '#2FD3C0', x: 0.6, y: -0.3, s: 0.7, p: 0.7 },
    { c: '#FFB86B', x: 0.25, y: 0.35, s: 0.55, p: 0.9 },
  ];
  const base = Math.max(w, h);
  return (
    <>
      <Sky colors={['#07041a', '#120a2c', '#0A0918']} />
      {clouds.map((c, i) => (
        <Osc
          key={i}
          t={t}
          at={{ left: w * c.x, top: h * c.y }}
          x={[w * 0.1, 1, c.p]}
          y={[h * 0.12, 2, c.p + 0.2]}
          scale={[0.18, 1, c.p + 0.5]}
          opacity={0.55}
          flicker={[0.2, 2, c.p]}
        >
          <Glow size={base * c.s} color={c.c} />
        </Osc>
      ))}
      <Stars t={t} w={w} h={h} n={40} seed={23} />
    </>
  );
}

const STAGE = ['#A97CFF', '#FF7EB6', '#6FC3FF', '#FFB86B', '#7CFFB2'];

/** A beam from a point, sweeping: a square twice its length, centred on the point, turns about it. */
function Beam({ t, ox, oy, len, base, sweep, k, phase, color: c, flick }: { t: SharedValue<number>; ox: number; oy: number; len: number; base: number; sweep: number; k: number; phase: number; color: string; flick: Wave }) {
  const box: ViewStyle = { left: ox - len, top: oy - len, width: len * 2, height: len * 2 };
  return (
    <View style={[styles.abs, box, { transform: [{ rotate: `${base}deg` }] }]}>
      <Osc t={t} at={{ left: 0, top: 0, width: len * 2, height: len * 2 }} rotate={[sweep, k, phase]} opacity={0.75} flicker={flick}>
        <View style={{ position: 'absolute', left: len - 10, top: 0, width: 20, height: len }}>
          <LinearGradient colors={[`${c}00`, `${c}33`, `${c}88`]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 10 }} />
          <LinearGradient colors={[`${c}00`, `${c}AA`, '#FFFFFFEE']} style={{ position: 'absolute', left: 9, width: 2, top: 0, bottom: 0 }} />
        </View>
      </Osc>
    </View>
  );
}

function Lasers({ t, w, h }: SceneProps) {
  const len = Math.hypot(w, h) * 1.1;
  const beams = Array.from({ length: 10 }, (_, i) => {
    const left = i < 5;
    const j = i % 5;
    return { left, base: (left ? 1 : -1) * (14 + j * 13), sweep: 16, k: 1 + (j % 2), p: j * 0.13 + (left ? 0 : 0.5), c: STAGE[j] };
  });
  return (
    <>
      <Sky colors={['#05040e', '#0c0820', '#140a26']} />
      <Osc t={t} at={{ left: -w * 0.3, top: h * 0.45 }} opacity={0.5} flicker={[0.2, 4, 0]}>
        <Glow size={w * 0.9} color="#A97CFF" />
      </Osc>
      <Osc t={t} at={{ left: w * 0.4, top: h * 0.45 }} opacity={0.5} flicker={[0.2, 4, 0.5]}>
        <Glow size={w * 0.9} color="#FF7EB6" />
      </Osc>
      {beams.map((b, i) => (
        <Beam key={i} t={t} ox={b.left ? 0 : w} oy={h} len={len} base={b.base} sweep={b.sweep} k={b.k} phase={b.p} color={b.c} flick={[0.25, 8, b.p]} />
      ))}
      <Stars t={t} w={w} h={h} n={18} seed={5} top={0.5} />
    </>
  );
}

function Synthwave({ t, w, h }: SceneProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const horizon = h * 0.6;
  const sun = Math.min(w * 0.55, h * 0.62);
  const ground = h - horizon;
  const lines = 9;
  const fan = Array.from({ length: 17 }, (_, i) => -2 + (i * 4) / 16);
  return (
    <>
      <Sky colors={['#0d0526', '#30104f', '#8a2266', '#ff7a59']} locations={[0, 0.35, 0.5, 0.6]} />
      <Stars t={t} w={w} h={horizon * 0.6} n={24} seed={3} />
      <Osc t={t} at={{ left: (w - sun) / 2, top: horizon - sun * 0.62 }} y={[3, 1, 0]}>
        <Svg width={sun} height={sun * 0.62}>
          <Defs>
            <SvgGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFE38A" />
              <Stop offset="0.6" stopColor="#FF8A5B" />
              <Stop offset="1" stopColor="#FF4FA0" />
            </SvgGradient>
          </Defs>
          <Circle cx={sun / 2} cy={sun / 2} r={sun / 2} fill={`url(#s${id})`} />
          {[0.36, 0.44, 0.51, 0.57].map((y, i) => (
            <Rect key={i} x={0} y={sun * y} width={sun} height={2 + i * 1.5} fill="#30104f" />
          ))}
        </Svg>
      </Osc>
      <View style={[styles.abs, { left: 0, right: 0, top: horizon, height: ground, overflow: 'hidden', backgroundColor: '#12061f' }]}>
        <Svg width={w} height={ground} style={StyleSheet.absoluteFill}>
          {fan.map((f, i) => (
            <Line key={i} x1={w / 2} y1={0} x2={w / 2 + f * w} y2={ground} stroke="#FF4FA0" strokeOpacity={0.55} strokeWidth={1} />
          ))}
        </Svg>
        {Array.from({ length: lines }, (_, i) => (
          <GridLine key={i} t={t} i={i} n={lines} w={w} ground={ground} />
        ))}
        <LinearGradient colors={['rgba(255,79,160,0.35)', 'rgba(18,6,31,0)']} style={[styles.abs, { left: 0, right: 0, top: 0, height: ground * 0.4 }]} />
      </View>
    </>
  );
}

/** A grid line rolling from the horizon towards you, faster as it nears. */
function GridLine({ t, i, n, w, ground }: { t: SharedValue<number>; i: number; n: number; w: number; ground: number }) {
  const style = useAnimatedStyle(() => {
    const f = (i + t.get()) / n;
    return { opacity: 0.25 + 0.7 * f, transform: [{ translateY: ground * f * f }] };
  });
  return <Animated.View style={[styles.abs, { left: 0, width: w, top: 0, height: 1.5, backgroundColor: '#FF4FA0' }, style]} />;
}

/** Colours across a row, from the glow purple through pink and amber to blue. */
function across(f: number) {
  const stops = ['#A97CFF', '#FF7EB6', '#FFB86B', '#6FC3FF'];
  return stops[Math.min(stops.length - 1, Math.floor(f * stops.length))];
}

function EqBar({ t, x, width, max, i, n }: { t: SharedValue<number>; x: number; width: number; max: number; i: number; n: number }) {
  const c = across(i / n);
  const style = useAnimatedStyle(() => {
    const p = t.get();
    const v = 0.5 + 0.28 * Math.sin(TAU * (2 * p + i * 0.07)) + 0.18 * Math.sin(TAU * (5 * p + i * 0.19)) + 0.12 * Math.sin(TAU * (8 * p + i * 0.37));
    return { height: Math.max(4, max * Math.min(1, Math.max(0.06, v))) };
  });
  return (
    <Animated.View style={[styles.abs, { left: x, bottom: 0, width, borderTopLeftRadius: width / 2, borderTopRightRadius: width / 2, overflow: 'hidden' }, style]}>
      <LinearGradient colors={['#FFFFFF', c, `${c}22`]} locations={[0, 0.08, 1]} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

function Equalizer({ t, w, h }: SceneProps) {
  const n = Math.max(18, Math.round(w / 14));
  const gap = 3;
  const bw = (w - gap * (n - 1)) / n;
  return (
    <>
      <Sky colors={['#07051a', '#110a2e', '#1a0d33']} />
      <Osc t={t} at={{ left: -w * 0.1, top: h * 0.3, width: w * 1.2 }} opacity={0.5} flicker={[0.25, 4, 0]} scale={[0.06, 4, 0]}>
        <Glow size={w * 1.2} color="#A97CFF" squash={0.6} />
      </Osc>
      {Array.from({ length: n }, (_, i) => (
        <EqBar key={i} t={t} x={i * (bw + gap)} width={bw} max={h * 0.72} i={i} n={n} />
      ))}
      <Stars t={t} w={w} h={h} n={14} seed={9} top={0.4} />
    </>
  );
}

function wavePath(width: number, wl: number, amp: number, height: number) {
  let d = `M 0 ${height} L 0 ${amp}`;
  for (let x = 0; x <= width; x += 8) d += ` L ${x} ${amp + amp * Math.sin((TAU * x) / wl)}`;
  return `${d} L ${width} ${height} Z`;
}

function Waves({ t, w, h }: SceneProps) {
  const wl = w / 1.5;
  const layers = [
    { top: 0.5, amp: 7, c: '#1d3f8a', o: 0.55, k: 1 },
    { top: 0.6, amp: 9, c: '#1b5fa8', o: 0.6, k: -2 },
    { top: 0.7, amp: 11, c: '#2a86c8', o: 0.55, k: 1 },
    { top: 0.8, amp: 13, c: '#3fb7e0', o: 0.45, k: -1 },
  ];
  return (
    <>
      <Sky colors={['#03081a', '#0a1838', '#0A0918']} />
      <Stars t={t} w={w} h={h * 0.5} n={30} seed={17} />
      <Osc t={t} at={{ left: w * 0.62, top: h * 0.02 }} opacity={0.9} scale={[0.04, 1, 0]}>
        <Glow size={h * 0.55} color="#D6E8FF" />
      </Osc>
      {layers.map((l, i) => (
        <WaveLayer key={i} t={t} w={w} h={h} wl={wl} {...l} />
      ))}
    </>
  );
}

function WaveLayer({ t, w, h, wl, top, amp, c, o, k }: { t: SharedValue<number>; w: number; h: number; wl: number; top: number; amp: number; c: string; o: number; k: number }) {
  const width = w + wl * 2;
  const height = h * (1 - top) + amp * 2;
  const d = useMemo(() => wavePath(width, wl, amp, height), [width, wl, amp, height]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: Math.sign(k) * frac(Math.abs(k) * t.get()) * wl }] }));
  return (
    <Animated.View style={[styles.abs, { left: -wl, top: h * top - amp, opacity: o }, style]}>
      <Svg width={width} height={height}>
        <Path d={d} fill={c} />
      </Svg>
    </Animated.View>
  );
}

function Fireflies({ t, w, h }: SceneProps) {
  const flies = useMemo(() => {
    const r = seeded(31);
    return Array.from({ length: 30 }, () => ({ x: r() * w, s: 2 + r() * 2.5, k: 1 + Math.floor(r() * 2), p: r(), sway: 8 + r() * 18, c: r() > 0.3 ? '#FFD36B' : '#FF9F5B' }));
  }, [w]);
  return (
    <>
      <Sky colors={['#06050f', '#0e0c1f', '#14102a']} />
      <Osc t={t} at={{ left: -w * 0.2, top: h * 0.5, width: w * 1.4 }} opacity={0.35}>
        <Glow size={w * 1.4} color="#FFB86B" squash={0.4} />
      </Osc>
      {flies.map((f, i) => (
        <Travel key={i} t={t} at={{ left: f.x, top: h + 10 }} dx={0} dy={-h - 30} k={f.k} phase={f.p} sway={[f.sway, 3, f.p]} peak={0.95}>
          <Spark size={f.s} color={f.c} />
        </Travel>
      ))}
    </>
  );
}

/** A neon daisy: petals round a gold heart, with a soft glow. */
function DaisyFlower({ size, petal, heart }: { size: number; petal: string; heart: string }) {
  const n = 12;
  const c = size / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={c} cy={c} r={size * 0.48} fill={petal} opacity={0.08} />
      {Array.from({ length: n }, (_, i) => (
        <Ellipse key={i} cx={c} cy={c - size * 0.24} rx={size * 0.075} ry={size * 0.2} fill={petal} opacity={0.9} transform={`rotate(${(i * 360) / n} ${c} ${c})`} />
      ))}
      <Circle cx={c} cy={c} r={size * 0.12} fill={heart} />
      <Circle cx={c - size * 0.03} cy={c - size * 0.03} r={size * 0.04} fill="#FFFFFF" opacity={0.55} />
    </Svg>
  );
}

/** Neon daisy (a gift): giant daisies turning slowly, a string of carnival bulbs, petals drifting down. */
function Daisy({ t, w, h }: SceneProps) {
  const big = Math.min(w, h * 1.6) * 0.62;
  const bulbs = useMemo(() => {
    const n = Math.max(10, Math.round(w / 26));
    return Array.from({ length: n }, (_, i) => ({ x: (i + 0.5) * (w / n), i }));
  }, [w]);
  const petals = useMemo(() => {
    const r = seeded(77);
    return Array.from({ length: 14 }, () => ({ x: r() * w, s: 5 + r() * 6, k: 1 + Math.floor(r() * 2), p: r(), sway: 10 + r() * 20, c: r() > 0.5 ? '#FF6AD5' : '#FFFFFF' }));
  }, [w]);
  return (
    <>
      <Sky colors={['#12062a', '#2a0b4a', '#0e0620']} />
      <Osc t={t} at={{ left: -w * 0.3, top: -h * 0.2, width: w }} opacity={0.5} scale={[0.08, 1, 0]}>
        <Glow size={w} color="#FF6AD5" squash={0.8} />
      </Osc>
      <Osc t={t} at={{ left: w * 0.45, top: h * 0.2, width: w }} opacity={0.4} scale={[0.1, 1, 0.5]}>
        <Glow size={w} color="#3D6BFF" squash={0.8} />
      </Osc>
      <Stars t={t} w={w} h={h} n={18} seed={23} />
      <Osc t={t} at={{ left: w * 0.62 - big / 2, top: h * 0.62 - big / 2 }} spin={1} scale={[0.04, 2, 0]}>
        <DaisyFlower size={big} petal="#FF6AD5" heart="#FFE14D" />
      </Osc>
      <Osc t={t} at={{ left: w * 0.12 - big * 0.3, top: h * 0.78 - big * 0.3 }} spin={-1} scale={[0.05, 3, 0.4]}>
        <DaisyFlower size={big * 0.6} petal="#FFFFFF" heart="#FFB13D" />
      </Osc>
      <Osc t={t} at={{ left: w * 0.3 - big * 0.18, top: h * 0.2 - big * 0.18 }} spin={2} scale={[0.06, 2, 0.7]} opacity={0.85}>
        <DaisyFlower size={big * 0.36} petal="#7CE8FF" heart="#FFE14D" />
      </Osc>
      {/* Carnival bulbs on a wire, chasing. */}
      <Svg width={w} height={30} style={[styles.abs, { left: 0, top: 4 }]}>
        <Path d={`M 0 6 Q ${w / 2} 26 ${w} 6`} stroke="#FFE14D" strokeOpacity={0.35} strokeWidth={1} fill="none" />
      </Svg>
      {bulbs.map((b) => {
        const u = b.x / w;
        const y = 4 + 6 + 20 * 4 * u * (1 - u) * 0.5;
        return (
          <Osc key={b.i} t={t} at={{ left: b.x - 6, top: y - 6 }} opacity={0.55} flicker={[0.45, 12, b.i / bulbs.length]}>
            <Spark size={3} color={b.i % 3 === 0 ? '#FF6AD5' : b.i % 3 === 1 ? '#FFE14D' : '#7CE8FF'} />
          </Osc>
        );
      })}
      {petals.map((p, i) => (
        <Travel key={i} t={t} at={{ left: p.x, top: -20 }} dx={0} dy={h + 40} k={p.k} phase={p.p} sway={[p.sway, 2, p.p]} turn={240} peak={0.8}>
          <View style={{ width: p.s, height: p.s * 2.2, borderRadius: p.s, backgroundColor: p.c, opacity: 0.85 }} />
        </Travel>
      ))}
    </>
  );
}

function Bass({ t, w, h }: SceneProps) {
  const d = Math.max(w, h) * 1.5;
  const cx = w / 2;
  const cy = h * 0.42;
  const rings = [0, 0.2, 0.4, 0.6, 0.8];
  return (
    <>
      <Sky colors={['#08051a', '#140a30', '#0A0918']} />
      {rings.map((p, i) => (
        <Grow key={i} t={t} at={{ left: cx - d / 2, top: cy - d / 2, width: d, height: d }} k={1} phase={p} peak={0.85}>
          <View style={{ flex: 1, borderRadius: d / 2, borderWidth: 3, borderColor: STAGE[i % STAGE.length] }} />
        </Grow>
      ))}
      <Osc t={t} at={{ left: cx - h * 0.45, top: cy - h * 0.45 }} scale={[0.18, 5, 0]} opacity={0.7} flicker={[0.25, 5, 0]}>
        <Glow size={h * 0.9} color="#A97CFF" />
      </Osc>
      <Stars t={t} w={w} h={h} n={20} seed={41} />
    </>
  );
}

function Lava({ t, w, h }: SceneProps) {
  const blobs = [
    { c: '#FF6A3D', x: 0.0, s: 0.75, k: 1, p: 0 },
    { c: '#FF3D7F', x: 0.35, s: 0.95, k: 1, p: 0.35 },
    { c: '#FFB86B', x: 0.65, s: 0.6, k: 2, p: 0.7 },
    { c: '#C13DFF', x: -0.15, s: 0.8, k: 1, p: 0.55 },
    { c: '#FF8A5B', x: 0.5, s: 0.5, k: 2, p: 0.15 },
    { c: '#FF4FA0', x: 0.15, s: 0.55, k: 2, p: 0.85 },
  ];
  const base = Math.max(w * 0.8, h);
  return (
    <>
      <Sky colors={['#1a0614', '#2a0a26', '#120818']} />
      {blobs.map((b, i) => (
        <Osc key={i} t={t} at={{ left: w * b.x, top: h * 0.5 - (base * b.s) / 2 }} y={[h * 0.45, b.k, b.p]} x={[w * 0.06, 1, b.p + 0.3]} scale={[0.15, b.k, b.p + 0.5]} opacity={0.75}>
          <Glow size={base * b.s} color={b.c} />
        </Osc>
      ))}
    </>
  );
}

function Prism({ t, w, h }: SceneProps) {
  const span = w * 1.1;
  const rainbow = ['#FF7EB6', '#FFB86B', '#FFF07A', '#7CFFB2', '#6FC3FF', '#A97CFF'] as const;
  const colours = [...rainbow, ...rainbow, rainbow[0]] as unknown as readonly [string, string, ...string[]];
  const band = useAnimatedStyle(() => ({ transform: [{ translateX: -frac(t.get()) * span }, { rotate: '-18deg' }] }));
  const sheen = useAnimatedStyle(() => ({ transform: [{ translateX: -w + frac(2 * t.get()) * w * 3 }, { rotate: '-18deg' }] }));
  return (
    <>
      <Sky colors={['#0b0a1d', '#141130', '#0A0918']} />
      <Animated.View style={[styles.abs, { left: -w * 0.3, top: -h * 0.6, width: span * 2 + w, height: h * 2.2, opacity: 0.5 }, band]}>
        <LinearGradient colors={colours} start={{ x: 0, y: 0.5 }} end={{ x: (span * 2) / (span * 2 + w), y: 0.5 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[styles.abs, { left: 0, top: -h * 0.6, width: w * 0.35, height: h * 2.2, opacity: 0.22 }, sheen]}>
        <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,1)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Stars t={t} w={w} h={h} n={26} seed={13} color="#FFFFFF" />
    </>
  );
}

function Vortex({ t, w, h }: SceneProps) {
  const cx = w / 2;
  const cy = h * 0.45;
  const rings = Array.from({ length: 8 }, (_, i) => ({ r: 30 + i * Math.max(w, h) * 0.085, c: STAGE[i % STAGE.length], spin: (i % 2 ? -1 : 1) * (1 + (i % 3)), dash: `${4 + i * 3} ${8 + i * 4}` }));
  return (
    <>
      <Sky colors={['#05041a', '#0e0a2c', '#0A0918']} />
      <Osc t={t} at={{ left: cx - h * 0.5, top: cy - h * 0.5 }} scale={[0.1, 2, 0]} opacity={0.8}>
        <Glow size={h} color="#6B3FE0" />
      </Osc>
      {rings.map((r, i) => (
        <View key={i} style={[styles.abs, { left: cx - r.r, top: cy - r.r, width: r.r * 2, height: r.r * 2, transform: [{ scaleY: 0.55 }] }]}>
          <Osc t={t} at={{ left: 0, top: 0, width: r.r * 2, height: r.r * 2 }} spin={r.spin} opacity={0.75 - i * 0.05}>
            <Svg width={r.r * 2} height={r.r * 2}>
              <Circle cx={r.r} cy={r.r} r={r.r - 2} stroke={r.c} strokeWidth={2} strokeDasharray={r.dash} strokeLinecap="round" fill="none" />
            </Svg>
          </Osc>
        </View>
      ))}
      <Stars t={t} w={w} h={h} n={24} seed={29} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Made for one person each                                            */
/* ------------------------------------------------------------------ */

/** A bamboo stalk with a few leaves, rooted at the bottom of its box. */
function Bamboo({ height: ht, tone = '#5FAE6E' }: { height: number; tone?: string }) {
  const seg = 34;
  const n = Math.ceil(ht / seg);
  return (
    <Svg width={60} height={ht}>
      {Array.from({ length: n }, (_, i) => {
        const y = ht - (i + 1) * seg;
        return (
          <G key={i}>
            <Rect x={24} y={y + 2} width={11} height={seg - 3} rx={4} fill={tone} />
            <Rect x={23} y={y} width={13} height={3} rx={1.5} fill="#2F6B3A" />
            {i % 2 === 1 ? <Path d={`M 35 ${y + 4} q 18 -6 24 -16 q -16 2 -24 12 Z`} fill="#7BC77F" /> : null}
            {i % 3 === 2 ? <Path d={`M 24 ${y + 6} q -16 -4 -22 -14 q 14 0 22 10 Z`} fill="#6CB872" /> : null}
          </G>
        );
      })}
    </Svg>
  );
}

/** A round panda face: ears, eye patches, a little nose and rosy cheeks. */
function PandaFace({ size }: { size: number }) {
  const s = size / 100;
  return (
    <Svg width={size} height={size * 0.95}>
      <Circle cx={20 * s} cy={20 * s} r={15 * s} fill="#1B1824" />
      <Circle cx={80 * s} cy={20 * s} r={15 * s} fill="#1B1824" />
      <Circle cx={20 * s} cy={21 * s} r={7 * s} fill="#3B3346" />
      <Circle cx={80 * s} cy={21 * s} r={7 * s} fill="#3B3346" />
      <Ellipse cx={50 * s} cy={52 * s} rx={44 * s} ry={40 * s} fill="#FBF8FF" />
      <Ellipse cx={33 * s} cy={50 * s} rx={11 * s} ry={14 * s} fill="#1B1824" transform={`rotate(-25 ${33 * s} ${50 * s})`} />
      <Ellipse cx={67 * s} cy={50 * s} rx={11 * s} ry={14 * s} fill="#1B1824" transform={`rotate(25 ${67 * s} ${50 * s})`} />
      <Circle cx={35 * s} cy={48 * s} r={4.2 * s} fill="#FFFFFF" />
      <Circle cx={65 * s} cy={48 * s} r={4.2 * s} fill="#FFFFFF" />
      <Circle cx={36 * s} cy={47 * s} r={1.6 * s} fill="#1B1824" />
      <Circle cx={66 * s} cy={47 * s} r={1.6 * s} fill="#1B1824" />
      <Ellipse cx={50 * s} cy={64 * s} rx={6 * s} ry={4.2 * s} fill="#1B1824" />
      <Path d={`M ${44 * s} ${71 * s} q ${6 * s} ${6 * s} ${12 * s} 0`} stroke="#1B1824" strokeWidth={2 * s} fill="none" strokeLinecap="round" />
      <Ellipse cx={24 * s} cy={66 * s} rx={7 * s} ry={4.5 * s} fill="#FF9EC7" opacity={0.75} />
      <Ellipse cx={76 * s} cy={66 * s} rx={7 * s} ry={4.5 * s} fill="#FF9EC7" opacity={0.75} />
    </Svg>
  );
}

/** A panda's sitting body: a round white tummy, black arms hugging a bamboo shoot, black feet. */
function PandaBody({ size }: { size: number }) {
  const s = size / 100;
  return (
    <Svg width={size} height={size * 0.75}>
      <Ellipse cx={50 * s} cy={36 * s} rx={40 * s} ry={34 * s} fill="#F4F0FA" />
      <Ellipse cx={22 * s} cy={66 * s} rx={16 * s} ry={9 * s} fill="#1B1824" />
      <Ellipse cx={78 * s} cy={66 * s} rx={16 * s} ry={9 * s} fill="#1B1824" />
      <Ellipse cx={22 * s} cy={66 * s} rx={6 * s} ry={4 * s} fill="#FF9EC7" opacity={0.6} />
      <Ellipse cx={78 * s} cy={66 * s} rx={6 * s} ry={4 * s} fill="#FF9EC7" opacity={0.6} />
      <Rect x={60 * s} y={-6 * s} width={7 * s} height={60 * s} rx={3 * s} fill="#6CB872" />
      <Path d={`M ${67 * s} ${2 * s} q ${14 * s} ${-6 * s} ${18 * s} ${-14 * s} q ${-12 * s} ${2 * s} ${-18 * s} ${10 * s} Z`} fill="#8AD48C" />
      <Ellipse cx={24 * s} cy={22 * s} rx={13 * s} ry={20 * s} fill="#1B1824" transform={`rotate(-35 ${24 * s} ${22 * s})`} />
      <Ellipse cx={68 * s} cy={24 * s} rx={14 * s} ry={10 * s} fill="#1B1824" />
    </Svg>
  );
}

function Blossom({ size }: { size: number }) {
  const r = size / 2;
  return (
    <Svg width={size} height={size}>
      {[0, 72, 144, 216, 288].map((a) => (
        <Ellipse key={a} cx={r} cy={r * 0.5} rx={r * 0.32} ry={r * 0.48} fill="#FFC2DD" transform={`rotate(${a} ${r} ${r})`} />
      ))}
      <Circle cx={r} cy={r} r={r * 0.2} fill="#FF7EB6" />
    </Svg>
  );
}

function Panda({ t, w, h }: SceneProps) {
  const petals = useMemo(() => {
    const r = seeded(88);
    return Array.from({ length: 16 }, () => ({ x: r() * w, s: 9 + r() * 8, k: 1 + Math.floor(r() * 2), p: r(), sway: 14 + r() * 22, turn: 180 + r() * 360 }));
  }, [w]);
  const big = Math.min(84, h * 0.3);
  const small = big * 0.66;
  return (
    <>
      <Sky colors={['#1d1036', '#2c1840', '#22122f', '#0A0918']} locations={[0, 0.4, 0.75, 1]} />
      <Stars t={t} w={w} h={h * 0.6} n={26} seed={52} color="#FFE7F3" />
      <Osc t={t} at={{ left: w * 0.6, top: -h * 0.1 }} scale={[0.04, 1, 0]} opacity={0.85}>
        <Glow size={h * 0.7} color="#FFC2DD" />
      </Osc>
      <Osc t={t} at={{ left: -w * 0.15, top: h * 0.35, width: w * 1.3 }} opacity={0.4}>
        <Glow size={w * 1.3} color="#7BC77F" squash={0.35} />
      </Osc>
      {/* Bamboo at both edges, swaying from the root. */}
      {[
        { x: -18, ht: h * 1.05, p: 0, tone: '#5FAE6E' },
        { x: 18, ht: h * 0.85, p: 0.3, tone: '#4E9A5D' },
        { x: w - 44, ht: h * 1.0, p: 0.6, tone: '#5FAE6E' },
        { x: w - 76, ht: h * 0.78, p: 0.15, tone: '#4E9A5D' },
      ].map((b, i) => (
        <Osc key={i} t={t} at={{ left: b.x, top: h - b.ht, height: b.ht * 2, width: 60 }} rotate={[2.2, 1, b.p]}>
          <View style={{ position: 'absolute', bottom: b.ht, left: 0 }}>
            <Bamboo height={b.ht} tone={b.tone} />
          </View>
        </Osc>
      ))}
      {/* A panda peeking up on the left, bobbing, and a small one hanging on the right. */}
      <Osc t={t} at={{ left: w * 0.06 + 10, top: h * 0.32 }} y={[4, 2, 0]} rotate={[3, 1, 0.2]}>
        <View style={{ alignItems: 'center' }}>
          <PandaFace size={big} />
          <View style={{ marginTop: -big * 0.14 }}>
            <PandaBody size={big * 0.95} />
          </View>
        </View>
      </Osc>
      {/* A small one peeking out by the bamboo on the right. */}
      <Osc t={t} at={{ left: w - 58 - small * 0.6, top: h * 0.3 }} x={[6, 1, 0.5]} rotate={[8, 1, 0.5]}>
        <PandaFace size={small} />
      </Osc>
      {petals.map((f, i) => (
        <Travel key={i} t={t} at={{ left: f.x, top: -20 }} dx={w * 0.08} dy={h + 30} k={f.k} phase={f.p} sway={[f.sway, 2, f.p]} turn={f.turn} peak={0.9}>
          <Blossom size={f.s} />
        </Travel>
      ))}
      {/* Little hearts rising now and then. */}
      {[0.22, 0.78].map((x, i) => (
        <Travel key={`h${i}`} t={t} at={{ left: w * x, top: h * 0.7 }} dx={0} dy={-h * 0.5} k={2} phase={i * 0.5} window={0.3} peak={0.8} sway={[6, 4, i * 0.3]}>
          <Svg width={14} height={13}>
            <Path d="M7 12.5 C 7 12.5 0 8 0 3.8 C 0 1.6 1.7 0 3.7 0 C 5.1 0 6.3 0.8 7 2 C 7.7 0.8 8.9 0 10.3 0 C 12.3 0 14 1.6 14 3.8 C 14 8 7 12.5 7 12.5 Z" fill="#FF9EC7" />
          </Svg>
        </Travel>
      ))}
    </>
  );
}

function LilyPad({ size }: { size: number }) {
  const rx = size / 2;
  const ry = size / 4;
  const cut = (15 * Math.PI) / 180;
  const ax = rx + rx * Math.cos(-cut);
  const ay = ry + ry * Math.sin(-cut);
  const by = ry + ry * Math.sin(cut);
  return (
    <Svg width={size} height={size * 0.5}>
      <Path d={`M ${rx} ${ry} L ${ax} ${ay} A ${rx} ${ry} 0 1 0 ${ax} ${by} Z`} fill="#2F8A4A" />
      <Ellipse cx={rx * 0.8} cy={ry * 0.85} rx={rx * 0.55} ry={ry * 0.45} fill="#4DB36A" opacity={0.55} />
      <Path d={`M ${rx} ${ry} L ${rx * 0.25} ${ry * 0.6} M ${rx} ${ry} L ${rx * 0.4} ${ry * 1.6} M ${rx} ${ry} L ${rx * 1.3} ${ry * 1.85}`} stroke="#5FC47A" strokeWidth={1} opacity={0.7} />
    </Svg>
  );
}

/** A cheerful frog sitting down. */
function Frog({ size }: { size: number }) {
  const s = size / 100;
  return (
    <Svg width={size} height={size * 0.8}>
      <Ellipse cx={50 * s} cy={58 * s} rx={40 * s} ry={22 * s} fill="#4CC76A" />
      <Ellipse cx={50 * s} cy={64 * s} rx={26 * s} ry={13 * s} fill="#B9F2A8" />
      <Ellipse cx={18 * s} cy={74 * s} rx={14 * s} ry={6 * s} fill="#3FAE5C" />
      <Ellipse cx={82 * s} cy={74 * s} rx={14 * s} ry={6 * s} fill="#3FAE5C" />
      <Circle cx={30 * s} cy={30 * s} r={15 * s} fill="#4CC76A" />
      <Circle cx={70 * s} cy={30 * s} r={15 * s} fill="#4CC76A" />
      <Circle cx={30 * s} cy={29 * s} r={10 * s} fill="#FFFFFF" />
      <Circle cx={70 * s} cy={29 * s} r={10 * s} fill="#FFFFFF" />
      <Circle cx={32 * s} cy={30 * s} r={5 * s} fill="#122016" />
      <Circle cx={68 * s} cy={30 * s} r={5 * s} fill="#122016" />
      <Circle cx={34 * s} cy={28 * s} r={1.8 * s} fill="#FFFFFF" />
      <Circle cx={70 * s} cy={28 * s} r={1.8 * s} fill="#FFFFFF" />
      <Path d={`M ${34 * s} ${50 * s} q ${16 * s} ${12 * s} ${32 * s} 0`} stroke="#1E5A2E" strokeWidth={2.5 * s} fill="none" strokeLinecap="round" />
      <Ellipse cx={26 * s} cy={48 * s} rx={6 * s} ry={3.5 * s} fill="#FF9EC7" opacity={0.7} />
      <Ellipse cx={74 * s} cy={48 * s} rx={6 * s} ry={3.5 * s} fill="#FF9EC7" opacity={0.7} />
    </Svg>
  );
}

/** A frog that sits, then hops up and lands again once a loop. */
function HoppingFrog({ t, at, size, phase }: { t: SharedValue<number>; at: ViewStyle; size: number; phase: number }) {
  const style = useAnimatedStyle(() => {
    const f = frac(t.get() + phase);
    const hop = f < 0.12 ? Math.sin((Math.PI * f) / 0.12) : 0;
    const squash = f < 0.02 || (f > 0.12 && f < 0.15) ? 0.9 : 1;
    return { transform: [{ translateY: -hop * size * 0.7 }, { scaleY: squash }, { scaleX: 2 - squash }, { rotate: `${hop * -8}deg` }] };
  });
  return <Animated.View style={[styles.abs, at, style]}><Frog size={size} /></Animated.View>;
}

function Cattail({ height: ht }: { height: number }) {
  return (
    <Svg width={30} height={ht}>
      <Path d={`M 15 ${ht} L 15 18`} stroke="#2E6B3F" strokeWidth={2.5} />
      <Rect x={11} y={18} width={8} height={30} rx={4} fill="#7A4A2A" />
      <Path d={`M 15 ${ht} q -14 -${ht * 0.4} -12 -${ht * 0.75}`} stroke="#3F8A50" strokeWidth={3} fill="none" />
      <Path d={`M 15 ${ht} q 12 -${ht * 0.35} 13 -${ht * 0.6}`} stroke="#357A46" strokeWidth={3} fill="none" />
    </Svg>
  );
}

function FrogPond({ t, w, h }: SceneProps) {
  const flies = useMemo(() => {
    const r = seeded(64);
    return Array.from({ length: 22 }, () => ({ x: r() * w, s: 2 + r() * 2, k: 1 + Math.floor(r() * 2), p: r(), sway: 10 + r() * 20 }));
  }, [w]);
  const water = h * 0.55;
  const frog = Math.min(78, h * 0.28);
  return (
    <>
      <Sky colors={['#03140e', '#082a1b', '#0d3a26', '#0A0918']} locations={[0, 0.45, 0.62, 1]} />
      <Stars t={t} w={w} h={h * 0.45} n={22} seed={71} color="#E6FFE0" />
      <Osc t={t} at={{ left: w * 0.55, top: -h * 0.12 }} scale={[0.05, 1, 0]} opacity={0.75}>
        <Glow size={h * 0.7} color="#B6FF8A" />
      </Osc>
      <View style={[styles.abs, { left: 0, right: 0, top: water - h * 0.08, bottom: 0 }]}>
        <LinearGradient colors={['rgba(46,150,90,0)', 'rgba(46,150,90,0.3)', 'rgba(10,9,24,0)']} locations={[0, 0.2, 1]} style={StyleSheet.absoluteFill} />
      </View>
      {[0.3, 0.7].map((x, i) => (
        <Grow key={`r${i}`} t={t} at={{ left: w * x - 70, top: water + 4, width: 140, height: 40 }} k={2} phase={i * 0.5} peak={0.6}>
          <View style={{ flex: 1, borderRadius: 70, borderWidth: 1.5, borderColor: '#9CF5B4' }} />
        </Grow>
      ))}
      {[
        { x: -10, ht: h * 0.75, p: 0 },
        { x: 14, ht: h * 0.6, p: 0.4 },
        { x: w - 36, ht: h * 0.7, p: 0.2 },
        { x: w - 58, ht: h * 0.55, p: 0.65 },
      ].map((c, i) => (
        <Osc key={i} t={t} at={{ left: c.x, top: h - c.ht, width: 30, height: c.ht * 2 }} rotate={[3, 1, c.p]}>
          <View style={{ position: 'absolute', bottom: c.ht, left: 0 }}>
            <Cattail height={c.ht} />
          </View>
        </Osc>
      ))}
      <Osc t={t} at={{ left: w * 0.06 + 30, top: water - frog * 0.1 }} y={[2, 2, 0]} rotate={[2, 1, 0]}>
        <LilyPad size={frog * 1.5} />
      </Osc>
      <HoppingFrog t={t} at={{ left: w * 0.06 + 30 + frog * 0.25, top: water - frog * 0.62 }} size={frog} phase={0.4} />
      <Osc t={t} at={{ left: w - 70 - frog * 1.1, top: water + h * 0.08 }} y={[2, 2, 0.5]} rotate={[2, 1, 0.5]}>
        <LilyPad size={frog * 1.2} />
      </Osc>
      <HoppingFrog t={t} at={{ left: w - 70 - frog * 0.95, top: water + h * 0.08 - frog * 0.5 }} size={frog * 0.75} phase={0.9} />
      {flies.map((f, i) => (
        <Travel key={i} t={t} at={{ left: f.x, top: h }} dx={0} dy={-h} k={f.k} phase={f.p} sway={[f.sway, 3, f.p]} peak={0.9}>
          <Spark size={f.s} color="#D9FF6B" />
        </Travel>
      ))}
    </>
  );
}

/** The sole of a foot (the hidden toes' own outline), without its toes. */
const SOLE =
  'M7.2 9.6c-1.6 1.6-2.2 4.4-1.9 7.2.3 2.6 1.1 4.6 1.3 6.6.2 2 1.6 3.6 3.6 3.6s3.4-1.4 3.6-3.4c.2-1.8.8-3.2 2-4.8 1.6-2.2 2.8-4.4 2.4-6.6-.4-2.2-2.4-3.4-5-3.6-2.4-.2-4.6.2-6 1z';
/** Each toe on the 24 × 28 foot: centre and size, big toe first. */
const TOES = [
  { x: 6.4, y: 5.4, rx: 2.3, ry: 2.6 },
  { x: 10.6, y: 3.6, rx: 1.6, ry: 1.9 },
  { x: 14, y: 3.7, rx: 1.4, ry: 1.6 },
  { x: 17, y: 5, rx: 1.2, ry: 1.4 },
  { x: 19.3, y: 7.2, rx: 1, ry: 1.15 },
];

/** A footprint pressed into the sand: darker sand with a soft lit edge. */
function Print({ size, flip }: { size: number; flip?: boolean }) {
  return (
    <View style={{ transform: [{ scaleX: flip ? -1 : 1 }] }}>
      <Svg width={size} height={size * (28 / 24)} viewBox="0 0 24 28">
        <Path d={SOLE} fill="#9C5A4A" fillOpacity={0.55} stroke="#FFD9B8" strokeOpacity={0.35} strokeWidth={0.6} />
        {TOES.map((o, i) => (
          <Ellipse key={i} cx={o.x} cy={o.y} rx={o.rx} ry={o.ry} fill="#9C5A4A" fillOpacity={0.55} stroke="#FFD9B8" strokeOpacity={0.35} strokeWidth={0.5} />
        ))}
      </Svg>
    </View>
  );
}

/** Footprints appear one after another along the sand, stay a while, then the tide smooths them away. */
function Step({ t, at, i, n, size, flip }: { t: SharedValue<number>; at: ViewStyle; i: number; n: number; size: number; flip: boolean }) {
  const style = useAnimatedStyle(() => {
    const p = t.get();
    const start = (i / n) * 0.62;
    const appear = Math.min(1, Math.max(0, (p - start) / 0.04));
    const wash = p > 0.82 ? Math.max(0, 1 - (p - 0.82) / 0.12) : 1;
    return { opacity: appear * wash, transform: [{ scale: 0.85 + 0.15 * appear }] };
  });
  return (
    <Animated.View style={[styles.abs, at, style]}>
      <Print size={size} flip={flip} />
    </Animated.View>
  );
}

/** A happy foot with each toe wiggling on its own beat, toenails painted. */
function WigglyFoot({ t, size }: { t: SharedValue<number>; size: number }) {
  const s = size / 24;
  return (
    <View style={{ width: size, height: size * (28 / 24) }}>
      <Svg width={size} height={size * (28 / 24)} viewBox="0 0 24 28" style={StyleSheet.absoluteFill}>
        <Path d={SOLE} fill="#FFC9A8" />
        <Ellipse cx={11} cy={17} rx={3.4} ry={5.2} fill="#FFDCC4" opacity={0.7} />
        <Ellipse cx={8.2} cy={19} rx={1.6} ry={1} fill="#FF9EC7" opacity={0.55} />
      </Svg>
      {TOES.map((o, i) => (
        <Osc key={i} t={t} at={{ left: (o.x - o.rx) * s, top: (o.y - o.ry) * s }} rotate={[14, 4, i * 0.12]} y={[size * 0.025, 4, i * 0.12 + 0.25]}>
          <Svg width={o.rx * 2 * s} height={o.ry * 2 * s} viewBox={`0 0 ${o.rx * 2} ${o.ry * 2}`}>
            <Ellipse cx={o.rx} cy={o.ry} rx={o.rx} ry={o.ry} fill="#FFC9A8" />
            <Ellipse cx={o.rx} cy={o.ry * 0.62} rx={o.rx * 0.55} ry={o.ry * 0.38} fill={['#FF7EB6', '#A97CFF', '#6FC3FF', '#FFB86B', '#7CFFB2'][i]} />
            <Ellipse cx={o.rx * 0.82} cy={o.ry * 0.5} rx={o.rx * 0.16} ry={o.ry * 0.12} fill="#FFFFFF" opacity={0.75} />
          </Svg>
        </Osc>
      ))}
    </View>
  );
}

function ToeBeach({ t, w, h }: SceneProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const sea = h * 0.46;
  const sand = h * 0.6;
  const steps = useMemo(() => {
    const n = 9;
    return Array.from({ length: n }, (_, i) => {
      const f = i / (n - 1);
      return { x: w * (0.08 + 0.8 * f), y: sand + h * (0.04 + 0.1 * Math.sin(f * Math.PI)) + (i % 2 ? h * 0.05 : 0), flip: i % 2 === 1 };
    });
  }, [w, h, sand]);
  const constellation = useMemo(() => {
    const u = Math.min(9, h * 0.035);
    const raw = [
      { x: -1.9, y: -4.2, r: 0.62 },
      { x: -0.5, y: -4.6, r: 0.46 },
      { x: 0.75, y: -4.35, r: 0.4 },
      { x: 1.8, y: -3.75, r: 0.34 },
      { x: 2.6, y: -2.9, r: 0.28 },
      ...[[-2.2, -2.4], [-0.6, -2.9], [1.0, -2.6], [2.3, -1.6], [2.4, 0.2], [1.9, 2.0], [1.6, 3.6], [0.5, 4.7], [-0.9, 4.6], [-1.7, 3.4], [-1.6, 1.6], [-2.0, 0]].map(([x, y]) => ({ x, y, r: 0.12 })),
    ];
    return raw.map((p) => ({ x: w * 0.16 + p.x * u, y: h * 0.2 + p.y * u, r: Math.max(1, p.r * u * 0.45) }));
  }, [w, h]);
  const sun = Math.min(w * 0.42, h * 0.5);
  return (
    <>
      <Sky colors={['#1b0d3a', '#4a1650', '#b8406a', '#ff9a6b']} locations={[0, 0.25, 0.38, 0.46]} />
      <Stars t={t} w={w} h={h * 0.3} n={22} seed={95} color="#FFE7F3" />
      {/* A footprint drawn in stars. */}
      {constellation.map((c, i) => (
        <Osc key={`c${i}`} t={t} at={{ left: c.x - c.r, top: c.y - c.r }} opacity={0.75} flicker={[0.25, 2 + (i % 3), i * 0.07]}>
          <View style={{ width: c.r * 2, height: c.r * 2, borderRadius: c.r, backgroundColor: '#FFF2D9', shadowColor: '#FFD9B8', shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }} />
        </Osc>
      ))}
      {/* The sun, half sunk into the sea. */}
      <Osc t={t} at={{ left: w * 0.62 - sun / 2, top: sea - sun * 0.55 }} y={[2, 1, 0]} scale={[0.02, 1, 0.2]}>
        <View style={{ width: sun, height: sun * 0.55, overflow: 'hidden' }}>
          <Svg width={sun} height={sun}>
            <Defs>
              <SvgGradient id={`sun${id}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FFE9A8" />
                <Stop offset="0.6" stopColor="#FF9A6B" />
              </SvgGradient>
            </Defs>
            <Circle cx={sun / 2} cy={sun / 2} r={sun / 2} fill={`url(#sun${id})`} />
          </Svg>
        </View>
      </Osc>
      <Osc t={t} at={{ left: w * 0.62 - sun, top: sea - sun * 0.8 }} opacity={0.6} flicker={[0.12, 1, 0]}>
        <Glow size={sun * 2} color="#FFB86B" squash={0.8} />
      </Osc>
      {/* The sea, with the sun's light shimmering on it. */}
      <View style={[styles.abs, { left: 0, right: 0, top: sea, height: sand - sea + h * 0.04 }]}>
        <LinearGradient colors={['#6a2a6e', '#3a2a7a', '#2a4f8f']} style={StyleSheet.absoluteFill} />
      </View>
      {[0, 1, 2, 3, 4].map((i) => (
        <Osc key={`g${i}`} t={t} at={{ left: w * 0.62 - 30 + (i % 2 ? 14 : -10) * i * 0.4, top: sea + 4 + i * ((sand - sea) / 5.5), width: 60 - i * 6, height: 2 }} x={[6, 2, i * 0.2]} opacity={0.55} flicker={[0.35, 3, i * 0.15]}>
          <View style={{ flex: 1, borderRadius: 1, backgroundColor: '#FFE1B0' }} />
        </Osc>
      ))}
      {/* Sand, and the tide lapping at it. */}
      <View style={[styles.abs, { left: 0, right: 0, top: sand, bottom: 0 }]}>
        <LinearGradient colors={['#e8a77e', '#c97a62', '#5a2e48']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      </View>
      <Osc t={t} at={{ left: -w * 0.1, top: sand - 8, width: w * 1.2, height: 18 }} y={[4, 1, 0]} x={[w * 0.03, 1, 0.25]} opacity={0.8}>
        <Svg width={w * 1.2} height={18}>
          <Path d={wavePath(w * 1.2, w / 3, 6, 18)} fill="#FFF1E6" fillOpacity={0.3} />
        </Svg>
      </Osc>
      {steps.map((st, i) => (
        <Step key={`s${i}`} t={t} at={{ left: st.x, top: st.y }} i={i} n={steps.length} size={Math.min(18, h * 0.065)} flip={st.flip} />
      ))}
      {/* A happy foot peeking in at the bottom left, toes wiggling. */}
      <Osc t={t} at={{ left: -w * 0.03, top: h * 0.6 }} rotate={[3, 1, 0]} y={[3, 2, 0.3]}>
        <View style={{ transform: [{ rotate: '28deg' }] }}>
          <WigglyFoot t={t} size={Math.min(82, h * 0.3)} />
        </View>
      </Osc>
      {/* Little toe prints of light drifting up now and then. */}
      {[0.3, 0.7, 0.85].map((x, i) => (
        <Travel key={`l${i}`} t={t} at={{ left: w * x, top: h * 0.7 }} dx={0} dy={-h * 0.5} k={2} phase={i * 0.33} window={0.35} peak={0.75} sway={[8, 3, i * 0.2]}>
          <Svg width={12} height={14} viewBox="0 0 24 28">
            <Path d={SOLE} fill="#FFE1F0" />
            {TOES.map((o, j) => (
              <Ellipse key={j} cx={o.x} cy={o.y} rx={o.rx} ry={o.ry} fill="#FFE1F0" />
            ))}
          </Svg>
        </Travel>
      ))}
    </>
  );
}

const SCENES: Record<BackdropId, (p: SceneProps) => React.ReactElement> = {
  aurora: Aurora,
  starfield: Starfield,
  nebula: Nebula,
  lasers: Lasers,
  synthwave: Synthwave,
  equalizer: Equalizer,
  waves: Waves,
  fireflies: Fireflies,
  bass: Bass,
  lava: Lava,
  prism: Prism,
  vortex: Vortex,
  panda: Panda,
  frog: FrogPond,
  toes: ToeBeach,
  daisy: Daisy,
};

const styles = StyleSheet.create({
  root: { overflow: 'hidden', backgroundColor: '#0A0918' },
  abs: { position: 'absolute' },
});
