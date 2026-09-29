import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckIcon } from '../components/TabIcons';
import type { Festival } from '../data/types';
import { lineupDays } from '../features/festivals/days';
import { groupFestivals } from '../features/festivals/going';
import { countdown } from '../features/festivals/when';
import { EVERYONE } from '../features/sound-map/scope';
import { haptic } from '../lib/haptics';
import { useToday } from '../lib/useToday';
import { useCatalog } from '../state/catalog';
import { useGoing } from '../state/going';
import { color, radius, space, type } from '../theme/tokens';

/**
 * Which lineup My Sound shows: everyone, or one festival (the ones you're
 * going to first). A sheet over My Sound.
 */
export default function SoundScopeScreen() {
  const { current } = useLocalSearchParams<{ current?: string }>();
  const { festivals } = useCatalog();
  const { going } = useGoing();
  const today = useToday();
  const insets = useSafeAreaInsets();
  const groups = groupFestivals(festivals, going, today);

  const pick = (id: string) => {
    haptic.select();
    router.dismissTo({ pathname: '/sound', params: { festival: id } });
  };

  const row = (key: string, title: string, detail: string, selected: boolean, a11y: string) => (
    <Pressable
      key={key}
      onPress={() => pick(key)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.row, selected && styles.selected, pressed && styles.pressed]}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {selected ? <CheckIcon color={color.glow} size={18} /> : null}
    </Pressable>
  );
  const festivalRow = (f: Festival) => {
    const days = lineupDays(f);
    const when = countdown(f, today) ?? f.dates;
    return row(
      f.id,
      f.name,
      `${f.lineup.length} artists · ${when}${days.length ? ' · by day' : ''}`,
      current === f.id,
      `Your sound at ${f.name}`,
    );
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}>
      <Text style={styles.title}>Show my sound for</Text>
      <View style={styles.list}>
        {row(EVERYONE, 'Everyone', 'Every artist the app knows', !current, 'Your sound across every artist')}
      </View>
      {groups.going.length > 0 && (
        <>
          <Text style={styles.section}>Going</Text>
          <View style={styles.list}>{groups.going.map(festivalRow)}</View>
        </>
      )}
      {groups.others.length > 0 && (
        <>
          <Text style={styles.section}>{groups.going.length ? 'More festivals' : 'Festivals'}</Text>
          <View style={styles.list}>{groups.others.map(festivalRow)}</View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.nightRaised },
  content: { paddingHorizontal: space.xl, paddingTop: space.xxl },
  title: { ...type.title, color: color.moon },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.xl },
  list: { gap: space.sm, marginTop: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  selected: { backgroundColor: 'rgba(169,124,255,0.16)', borderColor: 'rgba(169,124,255,0.45)' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  rowText: { flex: 1 },
  rowTitle: { ...type.headline, color: color.moon },
  detail: { ...type.caption, color: color.moonDim, marginTop: 2, fontVariant: ['tabular-nums'] },
});
