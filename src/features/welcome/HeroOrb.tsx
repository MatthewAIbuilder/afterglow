import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { SOUND_COLOR } from '../sound-map/colors';

/** Bubbles on the orbit, like the app icon and My Sound: [sound colour, size, place round the ring (turns)]. */
const BUBBLES: [string, number, number][] = [
  [SOUND_COLOR.dubstep, 22, 0.08],
  [SOUND_COLOR.riddim, 14, 0.36],
  [SOUND_COLOR.house, 18, 0.58],
  [SOUND_COLOR.pop, 12, 0.82],
];

/**
 * The welcome's opening picture: a glowing sphere (violet into pink into
 * amber, like the icon) breathing slowly, with little sound bubbles drifting
 * round a faint orbit. Decorative, hidden from screen readers, still with
 * reduced motion.
 */
export function HeroOrb({ size = 220 }: { size?: number }) {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);
  const breath = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    turn.set(withRepeat(withTiming(1, { duration: 28000, easing: Easing.linear }), -1, false));
    breath.set(
      withRepeat(
        withSequence(
          withTiming(1.04, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [reduceMotion, turn, breath]);

  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 360}deg` }] }));
  const sphere = useAnimatedStyle(() => ({ transform: [{ scale: breath.get() }] }));

  const core = size * 0.46;
  const orbit = size * 0.43;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="welcome-orb">
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FF7EB6" stopOpacity={0.35} />
            <Stop offset="0.55" stopColor="#A97CFF" stopOpacity={0.14} />
            <Stop offset="1" stopColor="#A97CFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#halo)" />
        <Ellipse cx={size / 2} cy={size / 2} rx={orbit} ry={orbit} fill="none" stroke="rgba(243,240,255,0.12)" strokeWidth={1} />
      </Svg>
      <Animated.View style={[styles.center, sphere]}>
        <Svg width={core} height={core}>
          <Defs>
            <RadialGradient id="sphere" cx="38%" cy="32%" r="75%">
              <Stop offset="0" stopColor="#FFD7A8" />
              <Stop offset="0.35" stopColor="#FF7EB6" />
              <Stop offset="0.75" stopColor="#8A5CFF" />
              <Stop offset="1" stopColor="#3A1E8C" />
            </RadialGradient>
          </Defs>
          <Circle cx={core / 2} cy={core / 2} r={core / 2 - 1} fill="url(#sphere)" />
          <Circle cx={core / 2} cy={core / 2} r={core / 2 - 1.5} fill="none" stroke="rgba(255,214,250,0.7)" strokeWidth={1.5} />
          <Ellipse cx={core * 0.38} cy={core * 0.3} rx={core * 0.16} ry={core * 0.09} fill="rgba(255,255,255,0.35)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, ring]}>
        {BUBBLES.map(([c, d, at]) => {
          const a = at * Math.PI * 2;
          return (
            <View
              key={at}
              style={[
                styles.bubble,
                {
                  width: d,
                  height: d,
                  borderRadius: d / 2,
                  left: size / 2 + Math.sin(a) * orbit - d / 2,
                  top: size / 2 - Math.cos(a) * orbit - d / 2,
                  backgroundColor: c,
                  shadowColor: c,
                },
              ]}
            />
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  bubble: { position: 'absolute', opacity: 0.9, shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
});
