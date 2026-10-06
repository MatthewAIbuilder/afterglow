import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { haptic } from '../../../lib/haptics';
import { color, radius, space, type, glowA } from '../../../theme/tokens';

/**
 * The organizer studio's small parts: cards, labelled fields, chips and
 * buttons, all in the app's night glass. The studio is in English, like
 * Afterglow HQ (docs/translations.md).
 */

export function Card({ title, sub, children }: { title?: string; sub?: string; children: ReactNode }) {
  return (
    <View style={s.card}>
      {title ? <Text style={s.h3}>{title}</Text> : null}
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
      {children}
    </View>
  );
}

export function Field({ label, hint, ...input }: { label: string; hint?: string } & TextInputProps) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={color.moonFaint} accessibilityLabel={label} {...input} style={[s.input, input.multiline && s.multi, input.style]} />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Chip({ label, on, onPress, a11y }: { label: string; on?: boolean; onPress: () => void; a11y?: string }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      accessibilityLabel={a11y ?? label}
      style={({ pressed }) => [s.chip, on && s.chipOn, pressed && s.pressed]}
    >
      <Text style={[s.chipText, on && { color: color.moon }]}>{label}</Text>
    </Pressable>
  );
}

export function Button({ label, onPress, kind = 'primary', busy, a11y }: { label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'danger'; busy?: boolean; a11y?: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ busy: !!busy }}
      style={({ pressed }) => [kind === 'primary' ? s.primary : kind === 'danger' ? s.danger : s.secondary, busy && { opacity: 0.6 }, pressed && s.pressed]}
    >
      <Text style={kind === 'primary' ? s.primaryText : kind === 'danger' ? s.dangerText : s.secondaryText}>{busy ? 'One moment…' : label}</Text>
    </Pressable>
  );
}

/** A link-like action in a row. */
export function Action({ label, onPress, danger, a11y }: { label: string; onPress: () => void; danger?: boolean; a11y?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y ?? label} hitSlop={8}>
      <Text style={danger ? s.actionDanger : s.action}>{label}</Text>
    </Pressable>
  );
}

/** A big number with what it counts. */
export function Tile({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <View style={s.tile} accessible accessibilityLabel={`${label}: ${value}${sub ? `. ${sub}` : ''}`}>
      <Text style={s.tileValue}>{value}</Text>
      <Text style={s.tileLabel}>{label}</Text>
      {sub ? <Text style={s.tileSub}>{sub}</Text> : null}
    </View>
  );
}

/** Day-by-day bars, today last. */
export function Bars({ days }: { days: { day: string; n: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.n));
  return (
    <View style={s.bars} accessible accessibilityLabel={`Day by day: ${days.map((d) => d.n).join(', ')}`}>
      {days.map((d) => (
        <View key={d.day} style={s.barSlot}>
          <View style={[s.bar, { height: `${Math.max(3, (d.n / max) * 100)}%`, opacity: d.n ? 1 : 0.25 }]} />
        </View>
      ))}
    </View>
  );
}

export const studio = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, gap: space.md },
  lead: { ...type.body, color: color.moonDim },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: color.glass },
  rowTitle: { ...type.label, color: color.moon },
  rowSub: { ...type.caption, color: color.moonDim },
  actions: { alignItems: 'flex-end', gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  h3: { ...type.headline, color: color.moon },
  muted: { ...type.caption, color: color.moonDim },
  status: { ...type.caption, color: color.moonDim, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, overflow: 'hidden' },
  live: { color: '#5BE3B5', borderColor: 'rgba(91,227,181,0.45)' },
});

const s = StyleSheet.create({
  card: { padding: space.lg, gap: space.sm, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  h3: { ...type.headline, color: color.moon },
  sub: { ...type.caption, color: color.moonDim },
  field: { gap: 4 },
  label: { ...type.label, color: color.moonDim, marginTop: space.xs },
  hint: { ...type.caption, color: color.moonFaint },
  input: { ...type.body, color: color.moon, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  multi: { minHeight: 84, textAlignVertical: 'top' },
  chip: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  chipOn: { borderColor: color.glow, backgroundColor: glowA(0.18) },
  chipText: { ...type.label, color: color.moonDim },
  primary: { alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glow, marginTop: space.xs },
  primaryText: { ...type.headline, color: color.night },
  secondary: { alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  secondaryText: { ...type.headline, color: color.moon },
  danger: { alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.pill },
  dangerText: { ...type.label, color: color.coral },
  action: { ...type.label, color: color.glow },
  actionDanger: { ...type.caption, color: color.coral },
  tile: { flexGrow: 1, flexBasis: '45%', padding: space.md, gap: 2, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  tileValue: { ...type.title, color: color.moon },
  tileLabel: { ...type.label, color: color.moonDim },
  tileSub: { ...type.caption, color: color.moonFaint },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 2 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderRadius: 2, backgroundColor: color.glow },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
