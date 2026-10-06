import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronIcon } from '../../components/TabIcons';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type } from '../../theme/tokens';
import { usePrep } from './usePrep';
import { t } from '../../i18n';

/** On the page of a festival you're going to: how ready you are, opening the checklist. */
export function GetReadyCard({ festival }: { festival: Festival }) {
  const { progress } = usePrep(festival);
  const all = progress.done === progress.total;
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push({ pathname: '/prep/[id]', params: { id: festival.id } });
      }}
      accessibilityRole="button"
      accessibilityLabel={t('Get ready for {festival}. {done} of {total} done. Opens the checklist.', { festival: festival.name, done: progress.done, total: progress.total })}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{all ? t('You’re ready') : t('Get ready')}</Text>
        <Text style={styles.sub}>
          {t('{done} of {total} done · ticket, plan and what to pack', { done: progress.done, total: progress.total })}
        </Text>
        <View style={styles.bar}>
          <View style={[styles.fill, { width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }]} />
        </View>
      </View>
      <ChevronIcon color={color.moonFaint} size={12} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  title: { ...type.headline, color: color.moon },
  sub: { ...type.caption, color: color.moonDim, marginTop: 2 },
  bar: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: space.sm, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: color.glow },
});
