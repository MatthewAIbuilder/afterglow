import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { haptic } from '../../lib/haptics';
import { useToes } from './useToes';

/** A little bare foot seen from above: five toes, big to little, over a soft sole. */
export function ToeGlyph({ size = 18, color = '#F3F0FF', opacity = 1 }: { size?: number; color?: string; opacity?: number }) {
  return (
    <Svg width={size} height={size * (28 / 24)} viewBox="0 0 24 28" opacity={opacity}>
      <Path
        d="M7.2 9.6c-1.6 1.6-2.2 4.4-1.9 7.2.3 2.6 1.1 4.6 1.3 6.6.2 2 1.6 3.6 3.6 3.6s3.4-1.4 3.6-3.4c.2-1.8.8-3.2 2-4.8 1.6-2.2 2.8-4.4 2.4-6.6-.4-2.2-2.4-3.4-5-3.6-2.4-.2-4.6.2-6 1z"
        fill={color}
        fillOpacity={0.85}
      />
      <Ellipse cx={6.4} cy={5.4} rx={2.3} ry={2.6} fill={color} />
      <Ellipse cx={10.6} cy={3.6} rx={1.6} ry={1.9} fill={color} />
      <Ellipse cx={14} cy={3.7} rx={1.4} ry={1.6} fill={color} />
      <Ellipse cx={17} cy={5} rx={1.2} ry={1.4} fill={color} />
      <Ellipse cx={19.3} cy={7.2} rx={1} ry={1.15} fill={color} />
    </Svg>
  );
}

type Props = {
  size?: number;
  color?: string;
  opacity?: number;
  /** Degrees, so it sits as if it wandered there. */
  turn?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * A toe hiding in the interface, only on the toe friend's phone (nothing at
 * all for anyone else). Tap it and it wiggles. Hidden from screen readers:
 * it's a secret.
 */
export function HiddenToe({ size = 14, color, opacity = 0.32, turn = 0, style }: Props) {
  const toes = useToes();
  const reduce = useReducedMotion();
  const wiggle = useSharedValue(0);
  const pop = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn + wiggle.get()}deg` }, { scale: pop.get() }],
  }));
  if (!toes) return null;
  return (
    <Pressable
      onPress={() => {
        haptic.soft();
        if (reduce) return;
        wiggle.set(withSequence(withTiming(-18, { duration: 70 }), withTiming(16, { duration: 90 }), withTiming(-10, { duration: 80 }), withSpring(0, { damping: 6 })));
        pop.set(withSequence(withTiming(1.5, { duration: 110 }), withSpring(1, { damping: 7 })));
      }}
      hitSlop={10}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ position: 'absolute' }, style]}
      testID="hidden-toe"
    >
      <Animated.View style={anim}>
        <ToeGlyph size={size} color={color} opacity={opacity} />
      </Animated.View>
    </Pressable>
  );
}
