import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { t } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { LABEL_MAX } from './care';
import { GUIDE, rangeText } from './guide';

/**
 * Starting a stopwatch: pick from the timing guide (so it can say when to
 * expect things), or name it your own way. Closed, it's one button.
 */
export function StartStopwatch({ onStart }: { onStart: (label: string, guide?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  if (!open)
    return (
      <Pressable
        onPress={() => {
          haptic.select();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('Start a stopwatch')}
        style={({ pressed }) => [styles.start, pressed && styles.pressed]}
      >
        <Text style={styles.startText}>{t('+ Start a stopwatch')}</Text>
      </Pressable>
    );

  const go = (name: string, guide?: string) => {
    haptic.tap();
    onStart(name, guide);
    setLabel('');
    setOpen(false);
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{t('What did you take?')}</Text>
      <Text style={styles.sub}>{t('Picking one lets the stopwatch say when it usually starts and wears off. It stays on this phone.')}</Text>
      <View style={styles.grid}>
        {GUIDE.map((g) => (
          <Pressable
            key={g.id}
            onPress={() => go(g.name, g.id)}
            accessibilityRole="button"
            accessibilityLabel={t('{name}. Usually starts in {range}', { name: g.name, range: rangeText(g.onset) })}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <Text style={styles.chipText}>{g.name}</Text>
            <Text style={styles.chipSub}>{t('Starts {range}', { range: rangeText(g.onset) })}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.own}>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder={t('Something else, in your words')}
          placeholderTextColor={color.moonFaint}
          accessibilityLabel={t('Name it your own way')}
          maxLength={LABEL_MAX}
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={() => go(label)}
        />
        <Pressable onPress={() => go(label)} accessibilityRole="button" accessibilityLabel={t('Start a stopwatch with your own name')} style={({ pressed }) => [styles.go, pressed && styles.pressed]}>
          <Text style={styles.goText}>{t('Start')}</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => setOpen(false)} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.cancel}>{t('Cancel')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  start: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: glowA(0.55) },
  startText: { ...type.headline, color: color.glow },
  panel: { padding: space.lg, gap: space.sm, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.45) },
  title: { ...type.headline, color: color.moon },
  sub: { ...type.caption, color: color.moonDim },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  chip: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, minWidth: '47%', flexGrow: 1 },
  chipText: { ...type.label, color: color.moon },
  chipSub: { ...type.caption, fontSize: 11, color: color.moonFaint, marginTop: 1 },
  own: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  input: { flex: 1, ...type.body, color: color.moon, minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  go: { minHeight: 44, paddingHorizontal: space.xl, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glowDeep },
  goText: { ...type.label, color: color.moon },
  cancel: { ...type.label, color: color.moonFaint, textAlign: 'center', marginTop: space.xs },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
