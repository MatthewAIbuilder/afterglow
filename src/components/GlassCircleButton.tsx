import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { haptic } from '../lib/haptics';
import { GlassFill } from './LiquidGlass';

/** Round Liquid Glass button for back / close. */
export function GlassCircleButton({
  onPress,
  onLongPress,
  longPressLabel,
  label,
  hint,
  selected,
  size = 40,
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
  /** Across, in points (40; Discover's header uses a smaller one). */
  size?: number;
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
      style={({ pressed }) => [styles.button, size !== 40 && { width: size, height: size, borderRadius: size / 2 }, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      <GlassFill radius={size / 2} lit={selected} />
      {/* Its own layer, so the glass (positioned) never paints over the icon in a browser. */}
      <View style={styles.content} pointerEvents="none">
        {children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', justifyContent: 'center' },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
