import { useEffect, useId } from 'react';
import { Platform, StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Defs, G, LinearGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { color } from '../theme/tokens';

/** Festival light: the colours the glow runs through, corner to corner. */
export const GLOW_COLORS = ['#A97CFF', '#FF7EB6', '#FFB86B', '#6FC3FF', '#A97CFF'] as const;

const FONT = Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: '"Helvetica Neue", Arial, sans-serif' });

type Props = {
  width: number;
  height: number;
  /** How round the corners are. */
  radius: number;
  /** Where the line sits: this far inside the box (negative: outside it). */
  inset?: number;
  /** "AFTERGLOW" in a small gap on the right edge (videos filmed with the app). */
  label?: boolean;
  /** Breathes slowly while true (the video is playing); still otherwise and with reduced motion. */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A soft neon edge around a video, in festival light: a thin bright line
 * with a wider haze around it, running purple, pink, amber and blue, and on
 * videos filmed with the app the word AFTERGLOW, small and spaced, in a gap
 * on the right. It never takes touches and is hidden from screen readers.
 */
export function EdgeGlow({ width, height, radius, inset = 0, label, active = true, style }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const reduce = useReducedMotion();
  const breath = useSharedValue(1);
  useEffect(() => {
    if (!active || reduce) {
      cancelAnimation(breath);
      breath.set(withTiming(1, { duration: 300 }));
      return;
    }
    breath.set(withRepeat(withTiming(0.62, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(breath);
  }, [active, reduce, breath]);
  const fade = useAnimatedStyle(() => ({ opacity: breath.get() }));

  if (width <= 0 || height <= 0) return null;
  // Room around the line for the haze.
  const pad = 10;
  const w = width - inset * 2;
  const h = height - inset * 2;
  const r = Math.max(0, radius - inset);
  const left = inset - pad;
  // The word sits on the right edge, a third of the way down.
  const word = 'AFTERGLOW';
  const size = 9;
  const textLen = word.length * (size * 0.72 + 3.2);
  const gapTop = pad + h * 0.34;
  const x = pad + w;

  return (
    <View
      testID={label ? 'edge-glow-label' : 'edge-glow'}
      style={[styles.root, { left, top: left, width: w + pad * 2, height: h + pad * 2 }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[StyleSheet.absoluteFill, fade]}>
        <Svg width={w + pad * 2} height={h + pad * 2}>
          <Defs>
            <LinearGradient id={`edge${id}`} x1="0" y1="0" x2="1" y2="1">
              {GLOW_COLORS.map((c, i) => (
                <Stop key={i} offset={i / (GLOW_COLORS.length - 1)} stopColor={c} />
              ))}
            </LinearGradient>
          </Defs>
          <G>
            <Rect x={pad} y={pad} width={w} height={h} rx={r} fill="none" stroke={`url(#edge${id})`} strokeWidth={12} opacity={0.12} />
            <Rect x={pad} y={pad} width={w} height={h} rx={r} fill="none" stroke={`url(#edge${id})`} strokeWidth={5} opacity={0.32} />
            <Rect x={pad} y={pad} width={w} height={h} rx={r} fill="none" stroke={`url(#edge${id})`} strokeWidth={1.6} opacity={0.95} />
          </G>
          {label ? (
            <G>
              {/* A small banner over the line, so the word reads like it's set into the light. */}
              <Rect x={x - 7.5} y={gapTop - 6} width={15} height={textLen + 12} rx={7.5} fill={color.night} opacity={0.78} />
              <SvgText
                x={x}
                y={gapTop}
                fontSize={size}
                fontFamily={FONT}
                fontWeight="600"
                letterSpacing={3.2}
                fill="#F3F0FF"
                opacity={0.82}
                textAnchor="start"
                transform={`rotate(90 ${x} ${gapTop})`}
                dy={size * 0.35}
              >
                {word}
              </SvgText>
            </G>
          ) : null}
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute' },
});
