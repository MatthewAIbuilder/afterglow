import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { haptic } from '../lib/haptics';
import { color, radius, space, type, glowA } from '../theme/tokens';

export type Chip = { key: string | undefined; label: string; count?: number; accessibilityLabel: string };

/**
 * A horizontal row of filter chips; the first is usually "All". Tapping the
 * chosen chip again goes back to the first.
 */
export function FilterChips({
  chips,
  value,
  onChange,
  inset = space.xl,
}: {
  chips: Chip[];
  value: string | undefined;
  onChange: (key: string | undefined) => void;
  /** Side padding, so the row lines up with the page. */
  inset?: number;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.chips, { paddingHorizontal: inset }]}
      style={styles.wrap}
      keyboardShouldPersistTaps="handled"
    >
      {chips.map((c) => {
        const on = c.key === value;
        return (
          <Pressable
            key={c.key ?? 'all'}
            onPress={() => {
              haptic.select();
              onChange(on ? chips[0]?.key : c.key);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={c.accessibilityLabel}
            style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.75 }]}
          >
            <Text style={[styles.text, on && { color: color.moon }]}>{c.label}</Text>
            {c.count !== undefined ? <Text style={styles.count}>{c.count}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 0 },
  chips: { gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  chipOn: { backgroundColor: glowA(0.22), borderColor: glowA(0.45) },
  text: { ...type.caption, color: color.moonDim },
  count: { ...type.caption, color: color.moonFaint, fontVariant: ['tabular-nums'] },
});
