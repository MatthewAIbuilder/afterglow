import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { haptic } from '../lib/haptics';
import { color, glowA, raisedA } from '../theme/tokens';

/** Round glass button for back / close. */
export function GlassCircleButton({
  onPress,
  onLongPress,
  longPressLabel,
  label,
  hint,
  selected,
  children,
}: {
  onPress: () => void;
  /** Held: something else (with `longPressLabel` as its screen-reader action). */
  onLongPress?: () => void;
  longPressLabel?: string;
  label: string;
  hint?: string;
  /** A toggle that's on: it glows, and screen readers hear it as selected. */
  selected?: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      onLongPress={onLongPress}
      delayLongPress={450}
      accessibilityActions={onLongPress && longPressLabel ? [{ name: 'longpress', label: longPressLabel }] : undefined}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'longpress') onLongPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={selected === undefined ? undefined : { selected }}
      hitSlop={10}
      style={({ pressed }) => [styles.button, selected && styles.on, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      {/* Its own layer, so the blur (positioned) never paints over the icon in a browser. */}
      <View style={styles.content} pointerEvents="none">
        {children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  on: { backgroundColor: glowA(0.32), borderColor: glowA(0.8), borderWidth: 1, shadowColor: color.glow, shadowOpacity: 0.6, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  content: { alignItems: 'center', justifyContent: 'center' },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: raisedA(0.4),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
});
