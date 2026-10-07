import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SearchField } from '../../components/SearchField';
import { CheckIcon } from '../../components/TabIcons';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { useCatalog } from '../../state/catalog';
import { useMemories } from '../../state/memories';
import { t } from '../../i18n';
import { showDateSpoken as formatDay } from '../artists/shows';
import { cleanShowName, localDay, showKey, showLabel, showsAround, showsOf, showTagOf, type ShowTag } from './show';

/**
 * Finding the one-night show a video is from: Afterglow's shows around the
 * day it was filmed (the ones with the artist you picked first), shows you
 * tagged before, or the venue or night's name as you type it. Once chosen, a
 * card shows it with a way to change it.
 */
export function ShowPicker({
  capturedAt,
  city,
  artistId,
  value,
  searching,
  onSearch,
  onChange,
}: {
  capturedAt: string;
  /** Where the video was filmed, for a show typed in by hand. */
  city?: string;
  /** The artist already picked, whose shows come first. */
  artistId?: string;
  value?: ShowTag;
  searching: boolean;
  onSearch: () => void;
  onChange: (s: ShowTag | undefined) => void;
}) {
  const catalog = useCatalog();
  const { memories } = useMemories();
  const [query, setQuery] = useState('');
  const day = localDay(capturedAt);
  const fromAfterglow = useMemo(
    () => showsAround(catalog.shows, { capturedAt, query, artistId, city, artistName: (id) => catalog.artist(id)?.name }).map(showTagOf),
    [catalog, capturedAt, query, artistId, city],
  );
  const yours = useMemo(() => {
    const q = query.trim().toLowerCase();
    return showsOf(memories).filter((s) => !q || s.name.toLowerCase().includes(q));
  }, [memories, query]);
  const results = useMemo(() => {
    const seen = new Set<string>();
    return [...fromAfterglow, ...yours].filter((s) => (seen.has(showKey(s)) ? false : (seen.add(showKey(s)), true)));
  }, [fromAfterglow, yours]);
  const typed = cleanShowName(query);
  const exact = results.some((r) => r.name.toLowerCase() === typed.toLowerCase());

  const choose = (s: ShowTag) => {
    setQuery('');
    onChange(s);
  };

  if (value && !searching)
    return (
      <View style={styles.root}>
        <View style={styles.card} testID="show-chosen">
          <View style={styles.cardText}>
            <Text style={styles.cardKicker}>{t('ONE-NIGHT SHOW')}</Text>
            <Text style={styles.cardName} numberOfLines={2}>
              {showLabel(value)}
            </Text>
            <Text style={styles.cardSub}>{formatDay(value.date)}</Text>
            <View style={styles.cardLinks}>
              <Pressable onPress={onSearch} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Change the show')}>
                <Text style={styles.link}>{t('Change')}</Text>
              </Pressable>
              <Pressable onPress={() => onChange(undefined)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Not a show')}>
                <Text style={styles.linkQuiet}>{t('Remove')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{t('Which show was it?')}</Text>
      <SearchField value={query} onChange={setQuery} placeholder={t('The venue or the night’s name')} label={t('Search for the show')} />
      <View style={styles.rows}>
        {results.map((r) => (
          <Pressable
            key={showKey(r)}
            onPress={() => choose(r)}
            accessibilityRole="button"
            accessibilityLabel={`${showLabel(r)}, ${formatDay(r.date)}`}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowName} numberOfLines={1}>
                {showLabel(r)}
              </Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {[formatDay(r.date), r.showId ? t('On Afterglow') : t('You added it before')].join(' · ')}
              </Text>
            </View>
            {value && showKey(value) === showKey(r) ? <CheckIcon color={color.glow} size={16} /> : null}
          </Pressable>
        ))}
        {!results.length && !typed ? <Text style={styles.quiet}>{t('No shows on Afterglow around {day}. Type the venue to add it.', { day: formatDay(day) })}</Text> : null}
        {typed && !exact ? (
          <Pressable
            onPress={() => choose({ name: typed, date: day, ...(city ? { city } : {}) })}
            accessibilityRole="button"
            accessibilityLabel={t('Add {show}', { show: typed })}
            style={({ pressed }) => [styles.row, styles.add, pressed && styles.pressed]}
          >
            <Text style={styles.addText} numberOfLines={1}>
              {t('+ Add “{show}”, {day}', { show: typed, day: formatDay(day) })}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: space.xl, marginTop: space.md, gap: space.sm },
  label: { ...type.caption, color: color.moonDim, marginTop: space.xs },
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
    borderTopColor: color.rim,
  },
  rowText: { flex: 1, gap: 1 },
  rowName: { ...type.headline, color: color.moon },
  rowSub: { ...type.caption, color: color.moonDim },
  quiet: { ...type.caption, color: color.moonDim, paddingVertical: space.xs },
  add: { borderStyle: 'dashed', borderColor: glowA(0.6) },
  addText: { ...type.label, color: color.glow },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: glowA(0.1), borderWidth: 1, borderColor: glowA(0.45) },
  cardText: { flex: 1, gap: 2 },
  cardKicker: { ...type.caption, fontSize: 10, letterSpacing: 1.5, color: color.glow, fontWeight: '700' },
  cardName: { ...type.headline, color: color.moon },
  cardSub: { ...type.caption, color: color.moonDim },
  cardLinks: { flexDirection: 'row', gap: space.lg, marginTop: space.xs },
  link: { ...type.label, color: color.glow },
  linkQuiet: { ...type.label, color: color.moonDim },
  pressed: { opacity: 0.75 },
});
