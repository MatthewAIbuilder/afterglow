import { type ReactNode, useEffect, useId } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { MOVES_FROM } from './Collectible';
import { blinkOf, CLOCK_MS, paceOf, sine } from './motion';
import type { Driven } from './Sprout';
import type { Stage } from './sprouts';

/**
 * The gnome hat, as it grows: a little red hat sitting in the soil, then a
 * face peeking out from under it, then a little gnome, then a grown gnome
 * with a long beard, a blue coat and a gold star on its hat (who hops about
 * the garden: GardenScene does the hopping). Its hat sways and it blinks on
 * the garden's clock (or its own), still with reduced motion or `still`.
 * Hidden from screen readers (the label around it says what it is).
 */
type Colors = { hat: string; hatDeep: string; face: string; nose: string; cheek: string; beard: string; beardLine: string; coat: string; boot: string; star: string; eye: string };
const COLORS: Colors = { hat: '#E8463A', hatDeep: '#9E2A22', face: '#FFD9C2', nose: '#FFB49A', cheek: '#FF8A80', beard: '#F6F2EA', beardLine: '#D9D2C4', coat: '#3D6FD0', boot: '#4A2E1E', star: '#FFC95A', eye: '#2A1A14' };
const GREYS: Colors = { hat: '#7C7A92', hatDeep: '#4A4860', face: '#9A98B0', nose: '#8A88A0', cheek: '#8A88A0', beard: '#A8A6BC', beardLine: '#8A88A0', coat: '#5A5870', boot: '#3A3850', star: '#9A98B0', eye: '#3A3850' };

/** Where each stage stands in the 100 × 100 drawing: the hat's base (centre, width, height of the cone) and the face. */
const SHAPE = [
  { hatY: 87, hatW: 30, hatH: 34, faceY: 0, faceRx: 0, faceRy: 0 },
  { hatY: 73, hatW: 30, hatH: 34, faceY: 80, faceRx: 13, faceRy: 9 },
  { hatY: 58, hatW: 28, hatH: 32, faceY: 63, faceRx: 12, faceRy: 9 },
  { hatY: 45, hatW: 32, hatH: 38, faceY: 52, faceRx: 14, faceRy: 10.5 },
] as const;

/** A pointed hat on a base centred at (x, y), its tip flopping over to the right. */
function hatPath(x: number, y: number, w: number, h: number) {
  const l = x - w / 2;
  const r = x + w / 2;
  const tipX = x + w * 0.2;
  const tipY = y - h;
  return `M${l} ${y} Q${l + w * 0.12} ${y - h * 0.62} ${tipX} ${tipY} Q${tipX + w * 0.2} ${tipY - h * 0.08} ${tipX + w * 0.2} ${tipY + h * 0.12} Q${r - w * 0.12} ${y - h * 0.5} ${r} ${y} Q${x} ${y + h * 0.12} ${l} ${y} Z`;
}

function starPath(cx: number, cy: number, r: number, inner: number) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? inner : r;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)} `;
  }
  return `${d}Z`;
}

export function GnomeHat({ stage = 3, size = 80, still = size < MOVES_FROM, locked, scene, driven }: { stage?: Stage; size?: number; still?: boolean; locked?: boolean; scene?: boolean; driven?: Driven }) {
  const reduce = useReducedMotion();
  const moving = !reduce && !still;
  const ownClock = useSharedValue(0);
  const clock = driven?.clock ?? ownClock;
  const hasClock = !!driven;
  const running = moving && (driven ? driven.running : true);
  const pace = driven?.pace ?? paceOf('gnome');
  const { phase, sway: swayC, blink: blinkC } = pace;
  useEffect(() => {
    if (!moving || hasClock) return;
    ownClock.set(withRepeat(withTiming(1, { duration: CLOCK_MS, easing: Easing.linear }), -1, false));
    return () => {
      cancelAnimation(ownClock);
      ownClock.set(0);
    };
  }, [moving, hasClock, ownClock]);
  const hatStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${(running ? sine(clock.get(), swayC, phase) : 0) * 6}deg` }] }));
  const bodyStyle = useAnimatedStyle(() => {
    const s = running ? sine(clock.get(), swayC, phase) : 0;
    return { transform: [{ scaleY: 1 + s * 0.02 }, { scaleX: 1 - s * 0.01 }] };
  });
  const eyeStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: running ? blinkOf(clock.get(), blinkC, phase) : 1 }] }));

  const c = locked ? GREYS : COLORS;
  const id = `gn-${stage}-${locked ? 'g' : 'c'}-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const grown = stage === 3 && !locked;
  const sh = SHAPE[stage];
  const inSoil = stage <= 1;
  const eyeY = stage === 1 ? sh.faceY - 2 : sh.faceY - 2;
  const eyeDx = stage === 3 ? 5.4 : 4.6;

  const defs = (
    <Defs>
      <RadialGradient id={`aura-${id}`} cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor={COLORS.hat} stopOpacity={0.4} />
        <Stop offset="0.6" stopColor={COLORS.star} stopOpacity={0.1} />
        <Stop offset="1" stopColor={COLORS.star} stopOpacity={0} />
      </RadialGradient>
      <LinearGradient id={`hat-${id}`} x1="0.1" y1="0" x2="0.8" y2="1">
        <Stop offset="0" stopColor={c.hat} />
        <Stop offset="1" stopColor={c.hatDeep} />
      </LinearGradient>
      <LinearGradient id={`soil-${id}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={locked ? '#5A5870' : '#7A5640'} />
        <Stop offset="1" stopColor={locked ? '#3A3850' : '#3A271C'} />
      </LinearGradient>
    </Defs>
  );

  const back = (
    <G>
      {grown ? <Circle cx={50} cy={54} r={46} fill={`url(#aura-${id})`} /> : null}
      {scene ? null : <Ellipse cx={50} cy={inSoil ? 93 : 95.5} rx={inSoil ? 24 : 19} ry={3.4} fill="rgba(0,0,0,0.35)" />}
    </G>
  );

  const mound = (
    <G>
      <Path d="M20 94 Q24 84 36 85 Q50 82 64 85 Q76 84 80 94 Z" fill={`url(#soil-${id})`} />
      <Path d="M30 86.5 Q50 83 70 86.5" stroke="#8A6A52" strokeWidth={0.8} opacity={0.6} fill="none" strokeLinecap="round" />
      <Circle cx={33} cy={89} r={1.2} fill="#8A6A52" />
      <Circle cx={68} cy={90.5} r={1.3} fill="#2C1E15" />
    </G>
  );

  const face = sh.faceRx ? (
    <G>
      <Ellipse cx={50} cy={sh.faceY} rx={sh.faceRx} ry={sh.faceRy} fill={c.face} />
      {!locked ? <Ellipse cx={50 - sh.faceRx * 0.62} cy={sh.faceY + sh.faceRy * 0.3} rx={3} ry={1.8} fill={c.cheek} opacity={0.55} /> : null}
      {!locked ? <Ellipse cx={50 + sh.faceRx * 0.62} cy={sh.faceY + sh.faceRy * 0.3} rx={3} ry={1.8} fill={c.cheek} opacity={0.55} /> : null}
    </G>
  ) : null;

  // The body under the face: a coat and boots once it's out of the soil, and a beard that grows with it.
  let body: ReactNode = null;
  if (stage === 2) {
    body = (
      <G>
        <Ellipse cx={43} cy={92} rx={5.4} ry={2.8} fill={c.boot} />
        <Ellipse cx={57} cy={92} rx={5.4} ry={2.8} fill={c.boot} />
        <Path d="M37 91 Q36 72 50 69 Q64 72 63 91 Z" fill={c.coat} />
        <Path d="M38.5 63 Q38 79 50 82 Q62 79 61.5 63 Q56 68 50 67.5 Q44 68 38.5 63 Z" fill={c.beard} />
        <Path d="M46 72 q1 3 0 6 M54 72 q-1 3 0 6" stroke={c.beardLine} strokeWidth={0.9} fill="none" strokeLinecap="round" />
      </G>
    );
  } else if (stage === 3) {
    body = (
      <G>
        <Ellipse cx={41} cy={91} rx={7} ry={3.6} fill={c.boot} />
        <Ellipse cx={59} cy={91} rx={7} ry={3.6} fill={c.boot} />
        <Path d="M31 90 Q29 67 50 62 Q71 67 69 90 Z" fill={c.coat} />
        <Path d="M32 81 L68 81" stroke={c.boot} strokeWidth={3} />
        <Path d="M47.4 79 L52.6 79 L52.6 83 L47.4 83Z" fill={c.star} />
        <Path d="M35.6 52 Q34 77 50 84 Q66 77 64.4 52 Q58 60 50 59 Q42 60 35.6 52 Z" fill={c.beard} />
        <Path d="M43 66 q2 5 0 10 M57 66 q-2 5 0 10 M50 69 q1 4 0 8" stroke={c.beardLine} strokeWidth={1.1} fill="none" strokeLinecap="round" />
      </G>
    );
  }
  const noseY = sh.faceY + sh.faceRy * 0.35;
  const nose = stage >= 2 ? <Ellipse cx={50} cy={noseY} rx={stage === 3 ? 4.4 : 3.6} ry={stage === 3 ? 4 : 3.3} fill={c.nose} /> : null;

  const hat = (
    <G>
      <Path d={hatPath(50, sh.hatY, sh.hatW, sh.hatH)} fill={`url(#hat-${id})`} />
      <Path d={`M${50 - sh.hatW * 0.32} ${sh.hatY - sh.hatH * 0.2} Q${50 - sh.hatW * 0.2} ${sh.hatY - sh.hatH * 0.6} ${50 + sh.hatW * 0.05} ${sh.hatY - sh.hatH * 0.85}`} stroke="#FFFFFF" strokeWidth={2} opacity={0.25} fill="none" strokeLinecap="round" />
      {stage === 3 ? <Path d={starPath(52, sh.hatY - sh.hatH * 0.45, 3.4, 1.4)} fill={c.star} /> : null}
      {stage === 0 && !locked ? <Path d={starPath(66, 70, 2.2, 0.9)} fill="#FFFFFF" opacity={0.8} /> : null}
    </G>
  );

  const eyes = sh.faceRx ? (
    <G>
      <Circle cx={50 - eyeDx} cy={eyeY} r={stage === 3 ? 2.2 : 1.9} fill={c.eye} />
      <Circle cx={50 + eyeDx} cy={eyeY} r={stage === 3 ? 2.2 : 1.9} fill={c.eye} />
      {!locked ? <Circle cx={50 - eyeDx - 0.6} cy={eyeY - 0.7} r={0.6} fill="#FFFFFF" /> : null}
      {!locked ? <Circle cx={50 + eyeDx - 0.6} cy={eyeY - 0.7} r={0.6} fill="#FFFFFF" /> : null}
    </G>
  ) : null;

  const box = { width: size, height: size };
  const layer = (node: ReactNode) => (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {defs}
      {node}
    </Svg>
  );
  const fill = { position: 'absolute' as const, width: size, height: size };
  const at = (v: number) => (v / 100) * size;
  // Peeking out: the face comes up out of the soil, so the mound goes over it.
  const ground = inSoil ? mound : null;
  if (!moving) {
    return (
      <View style={box} accessible={false} importantForAccessibility="no-hide-descendants">
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {defs}
          {back}
          {body}
          {face}
          {nose}
          {eyes}
          {ground}
          {hat}
        </Svg>
      </View>
    );
  }
  return (
    <View style={box} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={fill}>{layer(back)}</View>
      <Animated.View style={[fill, { transformOrigin: [size / 2, size * 0.92, 0] }, bodyStyle]}>
        {layer(
          <G>
            {body}
            {face}
            {nose}
          </G>,
        )}
      </Animated.View>
      {eyes ? <Animated.View style={[fill, { transformOrigin: [size / 2, at(eyeY), 0] }, eyeStyle]}>{layer(eyes)}</Animated.View> : null}
      {ground ? <View style={fill}>{layer(ground)}</View> : null}
      <Animated.View style={[fill, { transformOrigin: [size / 2, at(sh.hatY), 0] }, hatStyle]}>{layer(hat)}</Animated.View>
    </View>
  );
}
