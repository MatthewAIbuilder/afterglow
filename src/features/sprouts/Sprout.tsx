import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { kindOf, type SproutKind, type Stage } from './sprouts';

const LEAF = '#3BC46E';
const LEAF_DEEP = '#1E8F4A';
const STEM = '#2FB060';

/**
 * A little sprout friend: a round green bean with a face, and leaves that
 * grow with its stage (a seed, a sprout, leafy, then in bloom with its
 * kind's mark on top: a heart, a star, a flower…). Sways gently unless
 * motion is reduced or `still`. Hidden from screen readers (the label
 * around it says what it is).
 */
export function Sprout({ kind = 'seedling', stage = 3, size = 80, still, locked }: { kind?: SproutKind; stage?: Stage; size?: number; still?: boolean; locked?: boolean }) {
  const k = kindOf(kind);
  const reduce = useReducedMotion();
  const sway = useSharedValue(0);
  useEffect(() => {
    if (reduce || still) return;
    // Each sprout sways at its own pace so a garden never moves in step.
    const ms = 1700 + ((kind.length * 137 + stage * 211) % 900);
    sway.set(withRepeat(withSequence(withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }), withTiming(-1, { duration: ms, easing: Easing.inOut(Easing.sin) })), -1, true));
    return () => cancelAnimation(sway);
  }, [reduce, still, kind, stage, sway]);
  const top = useAnimatedStyle(() => ({ transform: [{ rotate: `${sway.get() * 5}deg` }] }));
  const body = useAnimatedStyle(() => ({ transform: [{ scaleY: 1 + sway.get() * 0.015 }] }));

  const grey = locked;
  const [b1, b2] = grey ? ['#5A5870', '#3A3850'] : k.body;
  const leaf = grey ? '#6A6880' : LEAF;
  const leafDeep = grey ? '#4A4860' : LEAF_DEEP;
  const accent = grey ? '#7A7890' : k.accent;
  const bodyR = stage === 0 ? 0.85 : 1;
  const id = `${kind}-${stage}-${grey ? 'g' : 'c'}`;
  // The stem's top, in the drawing's 100 × 100 box.
  const stemTop = [47, 38, 32, 30][stage];
  const s = [0, 0.8, 1, 1.1][stage];

  return (
    <View style={{ width: size, height: size }} accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
        <Ellipse cx={50} cy={93} rx={20 * bodyR} ry={3.5} fill="rgba(0,0,0,0.35)" />
      </Svg>
      {/* Stem, leaves and bloom, swaying from the top of the body. */}
      <Animated.View style={[{ position: 'absolute', width: size, height: size, transformOrigin: [size / 2, size * 0.55, 0] }, top]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id={`leaf-${id}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={grey ? '#7A7890' : '#7CF0A6'} />
              <Stop offset="1" stopColor={leafDeep} />
            </LinearGradient>
          </Defs>
          <Path d={`M50 54 Q${stage === 0 ? 50 : 48} ${(54 + stemTop) / 2} 50 ${stemTop}`} stroke={grey ? leaf : STEM} strokeWidth={3.2} strokeLinecap="round" fill="none" />
          {stage >= 1 ? (
            <G>
              <Path d={leafPath(50, stemTop + 2, -1, s)} fill={`url(#leaf-${id})`} />
              <Path d={leafPath(50, stemTop + 2, 1, s)} fill={`url(#leaf-${id})`} />
              <Path d={veinPath(50, stemTop + 2, -1, s)} stroke={leafDeep} strokeWidth={0.9} opacity={0.6} fill="none" />
              <Path d={veinPath(50, stemTop + 2, 1, s)} stroke={leafDeep} strokeWidth={0.9} opacity={0.6} fill="none" />
            </G>
          ) : null}
          {stage >= 2 ? <Path d={leafPath(49, stemTop + 12, -1, s * 0.55)} fill={`url(#leaf-${id})`} /> : null}
          {stage === 3 && kind !== 'seedling' ? (
            <G transform={`translate(50 ${stemTop - 4}) scale(1.45) translate(-50 ${-(stemTop - 4)})`}>
              <Bloom kind={kind} x={50} y={stemTop - 4} color={accent} />
            </G>
          ) : null}
        </Svg>
      </Animated.View>
      {/* The body with its face. */}
      <Animated.View style={[{ position: 'absolute', width: size, height: size, transformOrigin: [size / 2, size * 0.92, 0] }, body]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id={`body-${id}`} cx="40%" cy="35%" r="70%">
              <Stop offset="0" stopColor={b1} />
              <Stop offset="1" stopColor={b2} />
            </RadialGradient>
          </Defs>
          <Path d={beanPath(50, 72, 21 * bodyR, 20 * bodyR)} fill={`url(#body-${id})`} />
          <Ellipse cx={43} cy={63} rx={6 * bodyR} ry={3.5 * bodyR} fill="#FFFFFF" opacity={0.28} />
          <Circle cx={43.5} cy={72} r={2.4} fill="#0E2A1A" />
          <Circle cx={56.5} cy={72} r={2.4} fill="#0E2A1A" />
          <Circle cx={44.2} cy={71.2} r={0.8} fill="#FFFFFF" />
          <Circle cx={57.2} cy={71.2} r={0.8} fill="#FFFFFF" />
          <Path d="M46.5 77 Q50 80 53.5 77" stroke="#0E2A1A" strokeWidth={1.6} strokeLinecap="round" fill="none" />
          {grey ? null : (
            <>
              <Ellipse cx={39} cy={77} rx={3} ry={1.8} fill="#FF7EB6" opacity={0.45} />
              <Ellipse cx={61} cy={77} rx={3} ry={1.8} fill="#FF7EB6" opacity={0.45} />
            </>
          )}
        </Svg>
      </Animated.View>
    </View>
  );
}

/** A rounded bean, a little flatter at the bottom. */
function beanPath(cx: number, cy: number, rx: number, ry: number) {
  return `M${cx - rx} ${cy} C${cx - rx} ${cy - ry * 1.2} ${cx + rx} ${cy - ry * 1.2} ${cx + rx} ${cy} C${cx + rx} ${cy + ry * 0.9} ${cx - rx} ${cy + ry * 0.9} ${cx - rx} ${cy} Z`;
}

/** A leaf from the stem (x, y) out to one side (`dir` -1 left, 1 right). */
function leafPath(x: number, y: number, dir: number, s: number) {
  const tx = x + dir * 22 * s;
  const ty = y - 9 * s;
  return `M${x} ${y} C${x + dir * 6 * s} ${y - 13 * s} ${tx - dir * 2 * s} ${ty - 6 * s} ${tx} ${ty} C${tx - dir * 5 * s} ${ty + 8 * s} ${x + dir * 8 * s} ${y + 5 * s} ${x} ${y} Z`;
}
function veinPath(x: number, y: number, dir: number, s: number) {
  return `M${x + dir * 2 * s} ${y - 1 * s} Q${x + dir * 11 * s} ${y - 6 * s} ${x + dir * 19 * s} ${y - 8.5 * s}`;
}

/** The mark a bloomed sprout wears on top. */
function Bloom({ kind, x, y, color }: { kind: SproutKind; x: number; y: number; color: string }) {
  switch (kind) {
    case 'plur':
      return <Path d={`M${x} ${y + 6} C${x - 11} ${y - 2} ${x - 7} ${y - 12} ${x} ${y - 6} C${x + 7} ${y - 12} ${x + 11} ${y - 2} ${x} ${y + 6} Z`} fill={color} />;
    case 'wanderer':
      return <Path d={starPath(x, y - 3, 8, 3.6)} fill={color} />;
    case 'melody':
      return (
        <G>
          {[0, 72, 144, 216, 288].map((a) => (
            <Circle key={a} cx={x + Math.sin((a * Math.PI) / 180) * 5.5} cy={y - 3 - Math.cos((a * Math.PI) / 180) * 5.5} r={4} fill={color} opacity={0.95} />
          ))}
          <Circle cx={x} cy={y - 3} r={3} fill="#FFE9A8" />
        </G>
      );
    case 'bass':
      return (
        <G>
          <Circle cx={x} cy={y - 3} r={6} fill={color} />
          <Path d={`M${x - 4} ${y - 3} q2 -4 4 0 q2 4 4 0`} stroke="#FFFFFF" strokeWidth={1.4} fill="none" strokeLinecap="round" />
          <Path d={`M${x - 10} ${y - 8} q-3 5 0 10 M${x + 10} ${y - 8} q3 5 0 10`} stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.8} />
        </G>
      );
    case 'groove':
      return (
        <G>
          <Circle cx={x} cy={y - 3} r={6.5} fill={color} />
          <Path d={`M${x} ${y - 3} m0 -1.2 a1.2 1.2 0 1 1 -1.2 1.2 a2.6 2.6 0 1 1 2.6 2.6 a4 4 0 1 1 -4 -4`} stroke="#0E3A30" strokeWidth={1.1} fill="none" strokeLinecap="round" />
        </G>
      );
    case 'spotlight':
      return (
        <G>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <Path
              key={a}
              d={`M${x + Math.sin((a * Math.PI) / 180) * 7.5} ${y - 3 - Math.cos((a * Math.PI) / 180) * 7.5} L${x + Math.sin((a * Math.PI) / 180) * 10.5} ${y - 3 - Math.cos((a * Math.PI) / 180) * 10.5}`}
              stroke={color}
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          ))}
          <Circle cx={x} cy={y - 3} r={5.5} fill={color} />
        </G>
      );
    case 'sunrise':
      return (
        <G>
          <Path d={`M${x - 8} ${y} A8 8 0 0 1 ${x + 8} ${y} Z`} fill={color} />
          {[-60, -30, 0, 30, 60].map((a) => (
            <Path
              key={a}
              d={`M${x + Math.sin((a * Math.PI) / 180) * 10} ${y - Math.cos((a * Math.PI) / 180) * 10} L${x + Math.sin((a * Math.PI) / 180) * 13} ${y - Math.cos((a * Math.PI) / 180) * 13}`}
              stroke={color}
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          ))}
        </G>
      );
    default:
      return null;
  }
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
