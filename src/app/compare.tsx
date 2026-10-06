import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistAvatar } from '../components/ArtistAvatar';
import { ArtistRow } from '../components/ArtistRow';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { SearchField } from '../components/SearchField';
import { SOUND_LABEL } from '../data/models';
import { COMPARE_MAX, compareFestivals, compareIds, type FestivalFit, verdictLine } from '../features/festivals/compare';
import { distanceLabel, distanceShort } from '../features/festivals/near';
import { datesLine } from '../features/festivals/format';
import { bySoonest, isOver } from '../features/festivals/shelves';
import { searchFestivals } from '../features/festivals/search';
import { countdown } from '../features/festivals/when';
import { haptic } from '../lib/haptics';
import { useToday } from '../lib/useToday';
import { useCatalog } from '../state/catalog';
import { useGoing } from '../state/going';
import { useNearby } from '../state/nearby';
import { useRatings } from '../state/ratings';
import { useTaste } from '../state/taste';
import { useLoves } from '../state/useLoves';
import { useWeekends } from '../state/weekends';
import { color, radius, space, type, glowA } from '../theme/tokens';
import { t } from '../i18n';

/** "A", "A and B", "A, B and C". */
const andList = (xs: string[]) => (xs.length > 1 ? t('{list} and {last}', { list: xs.slice(0, -1).join(', '), last: xs[xs.length - 1] }) : (xs[0] ?? ''));

/** How many festivals to offer when adding one, before you search. */
const OFFER = 8;

/**
 * Festivals side by side: how well each fits your sound, who you'd love
 * there (and only there), its sound, and who plays more than one. Opened
 * from a festival page with `?ids=<id>`; add up to three.
 */
export default function CompareScreen() {
  const params = useLocalSearchParams<{ ids?: string }>();
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const { forYou } = useWeekends();
  const { taste, informed } = useTaste();
  const { ratings } = useRatings();
  const loves = useLoves();
  const { going } = useGoing();
  const today = useToday();
  const ids = useMemo(() => compareIds(params.ids, (id) => !!catalog.festival(id)), [params.ids, catalog]);
  const festivals = useMemo(() => ids.map((id) => forYou(catalog.festival(id)!)), [ids, catalog, forYou]);
  const comparison = useMemo(
    () => compareFestivals(festivals, { artist: catalog.artist, taste, informed, loves }),
    [festivals, catalog.artist, taste, informed, loves],
  );
  const setIds = (next: string[]) => {
    haptic.select();
    router.setParams({ ids: next.join(',') });
  };

  // Adding one: festivals you're going to first, then the soonest; or a search.
  const [adding, setAdding] = useState(ids.length < 2);
  const [query, setQuery] = useState('');
  const offer = useMemo(() => {
    const open = catalog.festivals.filter((f) => !ids.includes(f.id) && !isOver(f, today));
    if (query.trim()) return searchFestivals(open, query).slice(0, 12);
    const soonest = bySoonest(open, today);
    return [...soonest.filter((f) => going.includes(f.id)), ...soonest.filter((f) => !going.includes(f.id))].slice(0, OFFER);
  }, [catalog.festivals, ids, today, query, going]);

  return (
    <View style={styles.root}>
      <PageTitle title={t('Compare festivals')} />
      <NightSky />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.title}>{t('Compare festivals')}</Text>
        <Text style={styles.verdict}>{verdictLine(comparison)}</Text>

        <View style={styles.columns}>
          {comparison.fits.map((f) => (
            <Column
              key={f.festival.id}
              fit={f}
              best={comparison.best === f.festival.id}
              onRemove={ids.length > 1 ? () => setIds(ids.filter((id) => id !== f.festival.id)) : undefined}
            />
          ))}
          {ids.length < COMPARE_MAX && !adding ? (
            <Pressable
              onPress={() => {
                haptic.select();
                setAdding(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('Add a festival to compare')}
              style={({ pressed }) => [styles.add, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.addPlus}>+</Text>
              <Text style={styles.addText}>{t('Add a festival')}</Text>
            </Pressable>
          ) : null}
        </View>

        {adding && ids.length < COMPARE_MAX ? (
          <View style={styles.picker}>
            <Text style={styles.section}>{t('Add a festival')}</Text>
            <SearchField value={query} onChange={setQuery} placeholder={t('Find a festival')} label={t('Find a festival to compare')} />
            {offer.length === 0 ? <Text style={styles.none}>{t('No festival matches “{query}”.', { query: query.trim() })}</Text> : null}
            {offer.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => {
                  setQuery('');
                  setAdding(ids.length + 1 < 2);
                  setIds([...ids, f.id]);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('Compare {festival}, {dates}', { festival: f.name, dates: datesLine(f) })}
                style={({ pressed }) => [styles.offer, pressed && { opacity: 0.7 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.offerName} numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Text style={styles.offerMeta} numberOfLines={1}>
                    {[going.includes(f.id) ? t('Going') : '', countdown(f, today) ?? datesLine(f)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={styles.offerAdd}>{t('Add')}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {comparison.shared.length > 0 ? (
          <View style={styles.shared}>
            <Text style={styles.section}>{t('Playing more than one')}</Text>
            {comparison.shared.slice(0, 20).map(({ artist, festivals: at }) => (
              <ArtistRow
                key={artist.id}
                artist={artist}
                affinity={taste[artist.id] ?? 0}
                rating={ratings[artist.id]}
                detail={andList(at.map((id) => catalog.festival(id)?.name ?? '').filter(Boolean))}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
      <PageActions />
    </View>
  );
}

function Column({ fit: f, best, onRemove }: { fit: FestivalFit; best: boolean; onRemove?: () => void }) {
  const today = useToday();
  const { distanceTo, units } = useNearby();
  const away = distanceTo(f.festival);
  const when = countdown(f.festival, today) ?? datesLine(f.festival);
  const only = f.onlyHere.slice(0, 3).map((a) => a.name);
  const more = f.onlyHere.length - only.length;
  return (
    <View
      style={[styles.column, best && styles.columnBest]}
      accessible
      accessibilityLabel={[
        f.festival.name,
        when,
        away !== undefined ? distanceLabel(away, units) : '',
        f.fit !== undefined ? t('{n} percent fit for your sound', { n: f.fit }) : t('no fit yet'),
        t("{n} artists you'd love", { n: f.loved.length }),
        only.length ? (more > 0 ? t('Only here: {artists} and {n} more', { artists: only.join(', '), n: more }) : t('Only here: {artists}', { artists: only.join(', ') })) : '',
        best ? t('Best fit') : '',
      ]
        .filter(Boolean)
        .join('. ')}
    >
      {best ? <Text style={styles.bestTag}>{t('Best fit')}</Text> : null}
      <Text style={styles.name} numberOfLines={3}>
        {f.festival.name}
      </Text>
      <Text style={styles.meta} numberOfLines={2}>
        {when}
        {away !== undefined ? ` · ${distanceShort(away, units)}` : ''}
      </Text>
      <Text style={[styles.fit, best && { color: color.glow }]}>{f.fit !== undefined ? `${f.fit}%` : '–'}</Text>
      <Text style={styles.caption}>{f.fit !== undefined ? t('your fit') : t('new to you')}</Text>
      <View style={styles.faces}>
        {f.loved.slice(0, 3).map((a, i) => (
          <View key={a.id} style={[styles.face, { marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }]}>
            <ArtistAvatar artist={a} size={28} />
          </View>
        ))}
      </View>
      <Text style={styles.loved}>{f.loved.length ? t('{n} you’d love', { n: f.loved.length }) : t('No favourites yet')}</Text>
      {f.sounds.slice(0, 2).map((s) => (
        <Text key={s.tag} style={styles.sound} numberOfLines={1}>
          {SOUND_LABEL[s.tag]} {s.percent}%
        </Text>
      ))}
      {only.length ? (
        <>
          <Text style={styles.onlyHead}>{t('Only here')}</Text>
          <Text style={styles.only} numberOfLines={4}>
            {only.join(', ')}
            {more > 0 ? ` +${more}` : ''}
          </Text>
        </>
      ) : null}
      <View style={styles.spacer} />
      <Pressable
        onPress={() => {
          haptic.select();
          router.push(`/festival/${f.festival.id}`);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('Open {festival}', { festival: f.festival.name })}
        style={({ pressed }) => [styles.open, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.openText}>{t('Open')}</Text>
      </Pressable>
      {onRemove ? (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={t('Remove {festival}', { festival: f.festival.name })} hitSlop={8} style={styles.remove}>
          <Text style={styles.removeText}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.lg, alignSelf: 'center', width: '100%', maxWidth: 720 },
  title: { ...type.largeTitle, color: color.moon, paddingHorizontal: space.sm },
  verdict: { ...type.body, color: color.moonDim, marginTop: space.sm, paddingHorizontal: space.sm },
  columns: { flexDirection: 'row', gap: space.sm, marginTop: space.xl, alignItems: 'stretch' },
  column: {
    flex: 1,
    minHeight: 320,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  columnBest: { borderColor: glowA(0.6), backgroundColor: glowA(0.1) },
  bestTag: { ...type.caption, color: color.glow, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: space.xs },
  name: { ...type.headline, color: color.moon, paddingRight: space.md },
  meta: { ...type.caption, color: color.moonDim, marginTop: space.xs },
  fit: { ...type.largeTitle, color: color.moon, marginTop: space.md, fontVariant: ['tabular-nums'] },
  caption: { ...type.caption, color: color.moonFaint },
  faces: { flexDirection: 'row', marginTop: space.md, minHeight: 28 },
  face: { borderRadius: 16, borderWidth: 2, borderColor: color.night },
  loved: { ...type.label, color: color.moon, marginTop: space.xs },
  sound: { ...type.caption, color: color.moonDim, marginTop: 2 },
  onlyHead: { ...type.caption, color: color.moonFaint, marginTop: space.md },
  only: { ...type.caption, color: color.moon, marginTop: 2 },
  spacer: { flex: 1, minHeight: space.md },
  open: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  openText: { ...type.label, color: color.moon },
  remove: { position: 'absolute', top: space.xs, right: space.xs, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  removeText: { ...type.headline, color: color.moonFaint },
  add: {
    flex: 1,
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.hairline,
  },
  addPlus: { ...type.largeTitle, color: color.moonDim },
  addText: { ...type.label, color: color.moonDim, textAlign: 'center' },
  picker: { marginTop: space.xl, gap: space.sm },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: space.xs, paddingHorizontal: space.sm },
  none: { ...type.body, color: color.moonDim, paddingHorizontal: space.sm },
  offer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  offerName: { ...type.headline, color: color.moon },
  offerMeta: { ...type.caption, color: color.moonDim, marginTop: 2 },
  offerAdd: { ...type.label, color: color.glow },
  shared: { marginTop: space.xxl },
});
