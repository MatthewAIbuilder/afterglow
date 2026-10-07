import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckIcon } from '../components/TabIcons';
import type { Festival } from '../data/types';
import { lineupDays } from '../features/festivals/days';
import { useState } from 'react';
import { SearchField } from '../components/SearchField';
import { groupFestivals } from '../features/festivals/going';
import { festivalShelf, isMany, pickerList } from '../features/festivals/shelves';
import { useLoves } from '../state/useLoves';
import { countdown } from '../features/festivals/when';
import { EVERYONE } from '../features/sound-map/scope';
import { haptic } from '../lib/haptics';
import { useToday } from '../lib/useToday';
import { useCatalog } from '../state/catalog';
import { useGoing } from '../state/going';
import { color, radius, space, type, glowA, pageColumn } from '../theme/tokens';
import { SheetClose } from '../components/SheetClose';
import { datesLine } from '../features/festivals/format';
import { t } from '../i18n';
import { SHEET_BACKGROUND } from '../components/LiquidGlass';

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
  // Many festivals: a search, and otherwise the short shelf (plus the one being shown).
  const loves = useLoves();
  const many = isMany(festivals);
  const [query, setQuery] = useState('');
  const shelf = many ? festivalShelf(festivals, going, loves, today).festivals : [];
  const others = many
    ? pickerList(festivals, current ? [current] : [], query, shelf).filter((f) => query.trim() || !going.includes(f.id))
    : groups.others;

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
    const when = countdown(f, today) ?? datesLine(f);
    return row(
      f.id,
      f.name,
      days.length
        ? t('{n} artists · {when} · by day', { n: f.lineup.length, when })
        : t('{n} artists · {when}', { n: f.lineup.length, when }),
      current === f.id,
      t('Your sound at {festival}', { festival: f.name }),
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.root}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[pageColumn, styles.content, { paddingBottom: insets.bottom + space.xl }]}>
        <Text style={styles.title}>{t('Show my sound for')}</Text>
        <View style={styles.list}>
          {row(EVERYONE, t('Everyone'), t('Every artist the app knows'), !current, t('Your sound across every artist'))}
        </View>
        {groups.going.length > 0 && (
          <>
            <Text style={styles.section}>{t('Going')}</Text>
            <View style={styles.list}>{groups.going.map(festivalRow)}</View>
          </>
        )}
        {many && (
          <View style={styles.search}>
            <SearchField value={query} onChange={setQuery} placeholder={t('Find a festival')} label={t('Find a festival')} />
          </View>
        )}
        {others.length > 0 ? (
          <>
            <Text style={styles.section}>{query.trim() ? t('Matches') : groups.going.length ? t('More festivals') : t('Festivals')}</Text>
            <View style={styles.list}>{others.map(festivalRow)}</View>
          </>
        ) : query.trim() ? (
          <Text style={styles.none}>{t('No festival matches “{query}”.', { query: query.trim() })}</Text>
        ) : null}
      </ScrollView>
      <SheetClose />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SHEET_BACKGROUND },
  content: { paddingHorizontal: space.xl, paddingTop: space.xxl },
  title: { ...type.title, color: color.moon },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.xl },
  list: { gap: space.sm, marginTop: space.md },
  search: { marginTop: space.xl },
  none: { ...type.body, color: color.moonDim, marginTop: space.lg },
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
    borderTopColor: color.rim,
  },
  selected: { backgroundColor: glowA(0.16), borderColor: glowA(0.45) },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  rowText: { flex: 1 },
  rowTitle: { ...type.headline, color: color.moon },
  detail: { ...type.caption, color: color.moonDim, marginTop: 2, fontVariant: ['tabular-nums'] },
});
