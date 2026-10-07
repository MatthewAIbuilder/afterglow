import { type ReactNode, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { motion } from '../../theme/tokens';

/** How far a card leans at its edges, in degrees. */
const LEAN = 11;

/**
 * Hold a card and it tilts towards your finger, the light on its foil
 * following (on the website the mouse does it, no click needed). Springs
 * back flat when you let go. A shiny one catches the light in colours.
 * Still with reduced motion.
 */
export function HoloTilt({ width, height, shiny, children }: { width: number; height: number; shiny?: boolean; children: ReactNode }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const reduce = useReducedMotion();
  const x = useSharedValue(0.5);
  const y = useSharedValue(0.5);
  const lit = useSharedValue(0);
  const glare = Math.round(width * 1.3);

  const to = (px: number, py: number) => {
    'worklet';
    x.set(Math.min(1, Math.max(0, px / width)));
    y.set(Math.min(1, Math.max(0, py / height)));
  };
  const rest = () => {
    'worklet';
    x.set(withSpring(0.5, motion.gentle));
    y.set(withSpring(0.5, motion.gentle));
    lit.set(withTiming(0, { duration: 450 }));
  };
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      to(e.x, e.y);
      lit.set(withTiming(1, { duration: 160 }));
    })
    .onUpdate((e) => to(e.x, e.y))
    .onFinalize(rest);
  const hover = Gesture.Hover()
    .onBegin((e) => {
      to(e.x, e.y);
      lit.set(withTiming(1, { duration: 200 }));
    })
    .onUpdate((e) => to(e.x, e.y))
    .onFinalize(rest);

  const tilt = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${(x.get() - 0.5) * 2 * LEAN}deg` }, { rotateX: `${(0.5 - y.get()) * 2 * LEAN}deg` }, { scale: 1 + lit.get() * 0.02 }],
  }));
  const light = useAnimatedStyle(() => ({
    opacity: lit.get(),
    transform: [{ translateX: x.get() * width - glare / 2 }, { translateY: y.get() * height - glare / 2 }],
  }));

  if (reduce) return <View style={{ width, height }}>{children}</View>;
  return (
    <GestureDetector gesture={Gesture.Simultaneous(pan, hover)}>
      <Animated.View style={[{ width, height }, tilt]}>
        {children}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: width * 0.08, overflow: 'hidden' }]}>
          <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: glare, height: glare }, light]}>
            <Svg width={glare} height={glare}>
              <Defs>
                {shiny ? (
                  <RadialGradient id={`${uid}l`} cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.42} />
                    <Stop offset="0.3" stopColor="#FF8AD8" stopOpacity={0.16} />
                    <Stop offset="0.55" stopColor="#8AB8FF" stopOpacity={0.1} />
                    <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                  </RadialGradient>
                ) : (
                  <RadialGradient id={`${uid}l`} cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.32} />
                    <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                  </RadialGradient>
                )}
              </Defs>
              <Circle cx={glare / 2} cy={glare / 2} r={glare / 2} fill={`url(#${uid}l)`} />
            </Svg>
          </Animated.View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
