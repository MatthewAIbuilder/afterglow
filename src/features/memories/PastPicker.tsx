import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SearchField } from '../../components/SearchField';
import { CheckIcon } from '../../components/TabIcons';
import { color, radius, space, type } from '../../theme/tokens';
import { useCatalog } from '../../state/catalog';
import { useMemories } from '../../state/memories';
import { EnamelPin } from '../badges/EnamelPin';
import { throwbackLook } from '../badges/badges';
import { t } from '../../i18n';
import { type PastChoice, type PastEvent, cleanPastName, pastChoices, pastEventsOf, pastLabel, pastYears } from './past';

/**
 * Finding a past festival for a video from your camera roll: the year (from
 * when it was filmed), then a search over festivals you added before,
 * earlier years of festivals on Afterglow and well-known ones, or the name as
 * you type it. Once chosen, a card shows it with the throwback badge it earns.
 */
export function PastPicker({
  capturedAt,
  city,
  value,
  searching,
  onSearch,
  onChange,
}: {
  capturedAt: string;
  /** Where the video was filmed, for a festival typed in by hand. */
  city?: string;
  value?: PastEvent;
  searching: boolean;
  onSearch: () => void;
  onChange: (p: PastEvent | undefined) => void;
}) {
  const catalog = useCatalog();
  const { memories } = useMemories();
  const [query, setQuery] = useState('');
  const years = useMemo(() => pastYears(capturedAt, new Date()), [capturedAt]);
  const [year, setYear] = useState(value?.year ?? years[0]);
  const mine = useMemo(() => pastEventsOf(memories), [memories]);
  const results = useMemo(() => pastChoices(query, { festivals: catalog.festivals, mine }), [query, catalog.festivals, mine]);
  const typed = cleanPastName(query);
  const exact = results.some((r) => r.name.toLowerCase() === typed.toLowerCase());

  const choose = (c: Pick<PastChoice, 'name' | 'city' | 'seriesId'>) => {
    setQuery('');
    onChange({ name: c.name, year, ...(c.city ?? city ? { city: c.city ?? city } : {}), ...(c.seriesId ? { seriesId: c.seriesId } : {}) });
  };

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{t('Year')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.years}>
        {years.map((y) => (
          <Pressable
            key={y}
            onPress={() => {
              setYear(y);
              if (value) onChange({ ...value, year: y });
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: y === year }}
            accessibilityLabel={`${y}`}
            style={({ pressed }) => [styles.year, y === year && styles.yearOn, pressed && styles.pressed]}
          >
            <Text style={[styles.yearText, y === year && styles.yearTextOn]}>{y}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {value && !searching ? (
        <View style={styles.card} testID="past-chosen">
          <EnamelPin look={throwbackLook(value)} size={64} />
          <View style={styles.cardText}>
            <Text style={styles.cardKicker}>{t('THROWBACK')}</Text>
            <Text style={styles.cardName} numberOfLines={2}>
              {pastLabel(value)}
            </Text>
            <Text style={styles.cardSub} numberOfLines={2}>
              {value.city ? t('{city} · It’s a throwback on your profile, with a rose gold badge.', { city: value.city }) : t('It’s a throwback on your profile, with a rose gold badge.')}
            </Text>
            <View style={styles.cardLinks}>
              <Pressable onPress={onSearch} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Change the festival')}>
                <Text style={styles.link}>{t('Change')}</Text>
              </Pressable>
              <Pressable onPress={() => onChange(undefined)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Not a past festival')}>
                <Text style={styles.linkQuiet}>{t('Remove')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.label}>{t('Which festival was it?')}</Text>
          <SearchField value={query} onChange={setQuery} placeholder={t('Search, like EDC Las Vegas')} label={t('Search for the festival')} />
          <View style={styles.rows}>
            {results.map((r) => (
              <Pressable
                key={`${r.from}:${r.name}`}
                onPress={() => choose(r)}
                accessibilityRole="button"
                accessibilityLabel={`${r.name} ${year}${r.city ? `, ${r.city}` : ''}`}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {r.name} {year}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {[r.city, r.from === 'yours' ? t('You added it before') : r.from === 'afterglow' ? t('On Afterglow this year') : undefined].filter(Boolean).join(' · ') || t('Festival')}
                  </Text>
                </View>
                {value && value.name === r.name ? <CheckIcon color={color.glow} size={16} /> : null}
              </Pressable>
            ))}
            {typed && !exact ? (
              <Pressable
                onPress={() => choose({ name: typed })}
                accessibilityRole="button"
                accessibilityLabel={t('Add {festival}', { festival: `${typed} ${year}` })}
                style={({ pressed }) => [styles.row, styles.add, pressed && styles.pressed]}
              >
                <Text style={styles.addText} numberOfLines={1}>
                  {t('+ Add “{festival}”', { festival: `${typed} ${year}` })}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

const ROSE = '#F2B8A6';

const styles = StyleSheet.create({
  root: { paddingHorizontal: space.xl, marginTop: space.md, gap: space.sm },
  label: { ...type.caption, color: color.moonDim, marginTop: space.xs },
  years: { gap: space.sm },
  year: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  yearOn: { backgroundColor: 'rgba(242,184,166,0.18)', borderColor: ROSE },
  yearText: { ...type.label, color: color.moonDim, fontVariant: ['tabular-nums'] },
  yearTextOn: { color: color.moon },
  rows: { gap: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  rowText: { flex: 1, gap: 1 },
  rowName: { ...type.headline, color: color.moon },
  rowSub: { ...type.caption, color: color.moonDim },
  add: { borderStyle: 'dashed', borderColor: ROSE },
  addText: { ...type.label, color: ROSE },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(242,184,166,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(242,184,166,0.4)',
  },
  cardText: { flex: 1, gap: 2 },
  cardKicker: { ...type.caption, fontSize: 10, letterSpacing: 1.5, color: ROSE, fontWeight: '700' },
  cardName: { ...type.headline, color: color.moon },
  cardSub: { ...type.caption, color: color.moonDim },
  cardLinks: { flexDirection: 'row', gap: space.lg, marginTop: space.xs },
  link: { ...type.label, color: color.glow },
  linkQuiet: { ...type.label, color: color.moonDim },
  pressed: { opacity: 0.75 },
});
