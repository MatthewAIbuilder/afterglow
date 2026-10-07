import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t, tn } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type } from '../../theme/tokens';
import type { CharmId, PatternId } from './kandi';
import { KandiBracelet } from './KandiBracelet';

/** At most this many bracelets on the arm (the rest are counted). */
const SHOWN = 5;
/** Each bracelet's drawing, and how far down the arm the next one sits. */
const SIZE = 118;
const STEP = 26;

export type StackKandi = { word: string; beads: PatternId; charm?: CharmId; from?: string };

/**
 * Kandi on a profile, the way it's worn: bracelets stacked up an arm, each
 * tilted a little, with how many and who made them alongside. Tapping it
 * opens the garden they hang in. Nothing without kandi.
 */
export function KandiStack({ items, own, onOpen }: { items: readonly StackKandi[]; own?: boolean; onOpen: () => void }) {
  if (!items.length) return null;
  const shown = items.slice(0, SHOWN);
  const height = SIZE + STEP * (shown.length - 1);
  const makers = [...new Set(items.flatMap((k) => (k.from ? [`@${k.from}`] : [])))];
  const who = !makers.length ? '' : makers.length <= 2 ? makers.join(t(' and ')) : t('{names} and {n} more', { names: makers.slice(0, 2).join(', '), n: makers.length - 2 });
  const count = tn(items.length, '{n} bracelet', '{n} bracelets');
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onOpen();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${own ? t('Your kandi') : t('Their kandi')}: ${count}${who ? `, ${t('made by {who}', { who })}` : ''}. ${own ? t('Opens your garden.') : t('Opens their garden.')}`}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <View style={[styles.arm, { height: height - 10 }]}>
        <LinearGradient colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </View>
      <View style={{ width: SIZE, height }}>
        {shown.map((k, i) => (
          <View key={i} style={[styles.bracelet, { top: i * STEP - 14, transform: [{ rotate: `${i % 2 ? 4 : -5}deg` }] }]}>
            <KandiBracelet word={k.word} beads={k.beads} charm={i === shown.length - 1 ? k.charm : undefined} size={SIZE} />
          </View>
        ))}
      </View>
      <View style={styles.words}>
        <Text style={styles.title}>{own ? t('Your kandi') : t('Their kandi')}</Text>
        <Text style={styles.count}>{count}</Text>
        {who ? <Text style={styles.who}>{t('made by {who}', { who })}</Text> : null}
        <Text style={styles.link}>{own ? t('See your garden ›') : t('Visit their garden ›')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginHorizontal: space.xl, marginTop: space.lg, padding: space.md, borderRadius: radius.lg, backgroundColor: 'rgba(255,138,216,0.05)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,138,216,0.3)' },
  pressed: { opacity: 0.85 },
  arm: { position: 'absolute', left: space.md + SIZE / 2 - 24, top: space.md + 6, width: 48, borderRadius: 24, overflow: 'hidden' },
  bracelet: { position: 'absolute', left: 0 },
  words: { flex: 1, gap: 2 },
  title: { ...type.headline, color: color.moon },
  count: { ...type.body, color: '#FF9AD5' },
  who: { ...type.caption, color: color.moonDim },
  link: { ...type.label, color: color.glow, marginTop: space.sm },
});
