import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FilterChips } from '../components/FilterChips';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { SearchField } from '../components/SearchField';
import { localDay } from '../features/artists/shows';
import { NearYouPrompt } from '../features/festivals/NearYouPrompt';
import { reachLabel } from '../features/festivals/near';
import { ShowRow, useShowTaste } from '../features/festivals/ShowCards';
import { dedupeShows, filterShows, rankShows, searchShows, upcomingShows, type ShowFilter } from '../features/festivals/showsForYou';
import { haptic } from '../lib/haptics';
import { useToday } from '../lib/useToday';
import { useCatalog } from '../state/catalog';
import { useNearby } from '../state/nearby';
import { color, radius, space, type } from '../theme/tokens';
import { t } from '../i18n';
import { PageFeedback } from '../components/PageFeedback';

/** Rows shown at a time. */
const PAGE = 30;

/** The filters, in the phone's language (worked out when shown). */
const filters = (): { key: ShowFilter; label: string; spoken: string; none: string }[] => [
  { key: 'near', label: t('Near you'), spoken: t('Shows near you'), none: t('No shows that close yet.') },
  { key: 'week', label: t('This week'), spoken: t('Shows in the next 7 days'), none: t('No shows this week yet.') },
  { key: 'month', label: t('This month'), spoken: t('Shows in the next month'), none: t('No shows this month yet.') },
  { key: 'all', label: t('All'), spoken: t('All upcoming shows'), none: t('No shows yet.') },
];

/**
 * Every upcoming club show from the nightly EDMTrain feed, best for you
 * first (near you first once location is on), with filters and a search by
 * artist, venue or town. "See all" on the Festivals tab's "Shows for you".
 */
export default function ShowsScreen() {
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const today = localDay(useToday());
  const taste = useShowTaste();
  const FILTERS = useMemo(() => filters(), []);
  const nearby = useNearby();
  const [filter, setFilter] = useState<ShowFilter>('all');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const upcoming = useMemo(() => dedupeShows(upcomingShows(catalog.shows, today)), [catalog.shows, today]);
  const ranked = useMemo(() => rankShows(upcoming, taste, nearby.here), [upcoming, taste, nearby.here]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, filterShows(ranked, f.key, today).length])) as Record<ShowFilter, number>, [FILTERS, ranked, today]);
  const searching = query.trim().length > 0;
  const listed = useMemo(() => {
    const inFilter = filterShows(ranked, filter, today);
    if (!searching) return inFilter;
    const found = new Map(searchShows(inFilter.map((r) => r.show), query, (id) => catalog.artist(id)?.name).map((s, i) => [s.id, i]));
    return inFilter.filter((r) => found.has(r.show.id)).sort((a, b) => found.get(a.show.id)! - found.get(b.show.id)!);
  }, [ranked, filter, today, searching, query, catalog]);
  const needsPlace = filter === 'near' && nearby.status !== 'on';
  const none = FILTERS.find((f) => f.key === filter)!.none;

  return (
    <View style={styles.root}>
      <PageTitle title={t('Shows')} />
      <NightSky />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {t('Shows')}
          </Text>
          <Text style={styles.sub}>{t('Club nights and concerts, best for you first.')}</Text>
          <View style={styles.search}>
            <SearchField
              value={query}
              onChange={(q) => {
                setQuery(q);
                setShown(PAGE);
              }}
              placeholder={t('Artist, venue or town')}
              label={t('Find a show by artist, venue or town')}
            />
          </View>
        </View>
        <FilterChips
          sticky
          inset={space.lg}
          value={filter}
          onChange={(k) => {
            if (!k) return;
            setFilter(k as ShowFilter);
            setShown(PAGE);
          }}
          chips={FILTERS.map((f) => ({
            key: f.key,
            label: f.label,
            count: f.key === 'near' && nearby.status !== 'on' ? undefined : counts[f.key],
            accessibilityLabel: f.key === 'near' && nearby.status !== 'on' ? f.spoken : t('{filter}, {n}', { filter: f.spoken, n: counts[f.key] }),
          }))}
        />
        {filter === 'near' && nearby.status === 'on' ? (
          <Text style={styles.reach}>
            {nearby.hereLabel
              ? t('{within} of {place}', { within: reachLabel(nearby.units), place: nearby.hereLabel })
              : t('{within} of you', { within: reachLabel(nearby.units) })}
          </Text>
        ) : null}
        <View style={styles.list}>
          {needsPlace ? (
            nearby.hydrated ? (
              <NearYouPrompt title={t('Shows near you')} style={styles.prompt} />
            ) : null
          ) : listed.length === 0 ? (
            <Text style={styles.none}>
              {searching ? t('No show matches “{query}”.', { query: query.trim() }) : `${catalog.shows.length ? none : t('No shows yet.')} ${t('New ones arrive every night.')}`}
            </Text>
          ) : (
            listed.slice(0, shown).map((r) => <ShowRow key={r.show.id} ranked={r} />)
          )}
          {!needsPlace && listed.length > shown ? (
            <Pressable
              onPress={() => {
                haptic.select();
                setShown((n) => n + PAGE);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('Show more shows. {n} left', { n: listed.length - shown })}
              style={({ pressed }) => [styles.more, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.moreText}>{t('Show more · {n} left', { n: listed.length - shown })}</Text>
            </Pressable>
          ) : null}
        </View>
        <PageFeedback />
      </ScrollView>
      <PageActions />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  header: { paddingHorizontal: space.xl, marginBottom: space.lg },
  title: { ...type.largeTitle, color: color.moon },
  sub: { ...type.body, color: color.moonDim, marginTop: space.xs },
  search: { marginTop: space.lg },
  reach: { ...type.caption, color: color.moonDim, paddingHorizontal: space.xl, marginTop: space.md },
  list: { marginTop: space.lg },
  prompt: { marginHorizontal: space.lg },
  none: { ...type.body, color: color.moonDim, paddingHorizontal: space.xl },
  more: {
    alignSelf: 'center',
    marginTop: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  moreText: { ...type.label, color: color.moonDim },
});
