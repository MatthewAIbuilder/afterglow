import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { haptic } from '../lib/haptics';
import { color } from '../theme/tokens';

/** Round glass button for back / close. */
export function GlassCircleButton({ onPress, label, children }: { onPress: () => void; label: string; children: ReactNode }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      style={({ pressed }) => [styles.button, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,16,38,0.4)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
});
