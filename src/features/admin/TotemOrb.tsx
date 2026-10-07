import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, RadialGradient, Stop } from 'react-native-svg';

/** The moons: angle on the ring (degrees), size, rim colour. */
const MOONS: readonly (readonly [number, number, string])[] = [
  [-130, 0.1, '#FF7EB6'],
  [-40, 0.2, '#FFA24A'],
  [10, 0.055, '#FFA24A'],
  [48, 0.13, '#9A8CFF'],
];

/**
 * Afterglow's mark, alive, for the totem: the big glowing planet from the
 * app's icon breathing slowly, its moons going round it on their ring.
 * Still with reduced motion. `size` wide and tall.
 */
export function TotemOrb({ size }: { size: number }) {
  const reduce = useReducedMotion();
  const orbit = useSharedValue(0);
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    orbit.set(withRepeat(withTiming(1, { duration: 60_000, easing: Easing.linear }), -1, false));
    breath.set(withRepeat(withSequence(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 3200, easing: Easing.inOut(Easing.sin) })), -1, false));
    return () => {
      cancelAnimation(orbit);
      cancelAnimation(breath);
    };
  }, [reduce, orbit, breath]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${orbit.get() * 360}deg` }] }));
  const glow = useAnimatedStyle(() => ({ opacity: 0.55 + breath.get() * 0.35, transform: [{ scale: 0.96 + breath.get() * 0.08 }] }));
  const c = size / 2;
  const ring = size * 0.41;
  const planet = size * 0.27;
  const fill = { position: 'absolute' as const, left: 0, top: 0, width: size, height: size };
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* Its glow, breathing. */}
      <Animated.View style={[fill, glow]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="orb-halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0.3" stopColor="#FF6AB0" stopOpacity={0.55} />
              <Stop offset="0.6" stopColor="#7A4CFF" stopOpacity={0.22} />
              <Stop offset="1" stopColor="#7A4CFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={c} cy={c} r={size / 2} fill="url(#orb-halo)" />
        </Svg>
      </Animated.View>
      {/* The ring and its moons, going round. */}
      <Animated.View style={[fill, spin]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="orb-moon" cx="38%" cy="32%" r="70%">
              <Stop offset="0" stopColor="#B9A8FF" />
              <Stop offset="1" stopColor="#5A2FD0" />
            </RadialGradient>
          </Defs>
          <Circle cx={c} cy={c} r={ring} fill="none" stroke="#8A6AE0" strokeWidth={size * 0.003} opacity={0.6} />
          {MOONS.map(([deg, r, rim], i) => {
            const a = (deg * Math.PI) / 180;
            const x = c + Math.cos(a) * ring;
            const y = c + Math.sin(a) * ring;
            return (
              <Moon key={i} x={x} y={y} r={r * size * 0.5} rim={rim} />
            );
          })}
        </Svg>
      </Animated.View>
      {/* The planet. */}
      <View style={fill}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="orb-planet" x1="0" y1="0.2" x2="1" y2="0.8">
              <Stop offset="0" stopColor="#4A2FD8" />
              <Stop offset="0.55" stopColor="#9A2FA0" />
              <Stop offset="1" stopColor="#FF7A3A" />
            </LinearGradient>
            <LinearGradient id="orb-rim" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#7A5CFF" />
              <Stop offset="0.6" stopColor="#FF4FA0" />
              <Stop offset="1" stopColor="#FFC24A" />
            </LinearGradient>
          </Defs>
          <Circle cx={c - size * 0.06} cy={c + size * 0.02} r={planet} fill="url(#orb-planet)" />
          <Circle cx={c - size * 0.06} cy={c + size * 0.02} r={planet} fill="none" stroke="url(#orb-rim)" strokeWidth={size * 0.008} />
          <Ellipse cx={c - size * 0.1} cy={c - size * 0.1} rx={planet * 0.62} ry={planet * 0.3} fill="#FFFFFF" opacity={0.22} />
        </Svg>
      </View>
    </View>
  );
}

/** A moon: a glossy little planet with a glowing rim. */
function Moon({ x, y, r, rim }: { x: number; y: number; r: number; rim: string }) {
  return (
    <>
      <Circle cx={x} cy={y} r={r * 1.5} fill={rim} opacity={0.18} />
      <Circle cx={x} cy={y} r={r} fill="url(#orb-moon)" stroke={rim} strokeWidth={Math.max(1, r * 0.12)} />
      <Ellipse cx={x - r * 0.2} cy={y - r * 0.45} rx={r * 0.55} ry={r * 0.28} fill="#FFFFFF" opacity={0.3} />
    </>
  );
}
