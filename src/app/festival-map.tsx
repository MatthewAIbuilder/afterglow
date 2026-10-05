import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, type NativeScrollEvent, type NativeSyntheticEvent, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistAvatar } from '../components/ArtistAvatar';
import { FilterChips } from '../components/FilterChips';
import { PageActions } from '../components/PageActions';
import { GlassCircleButton } from '../components/GlassCircleButton';
import { ChevronIcon, LocateIcon, SearchIcon } from '../components/TabIcons';
import { SearchField } from '../components/SearchField';
import { PageTitle } from '../components/PageTitle';
import type { Festival } from '../data/types';
import { FestivalMap } from '../features/festival-map/FestivalMap';
import { type WhenFilter, WHEN_LABEL, filterWhen, inView, inViewLine, searchMarkers } from '../features/festival-map/explore';
import { TONE_COLOR } from '../features/festival-map/tones';
import { type MapFilter, type Marker, type Region, filterMarkers, inDateOrder, journeyOf, mapMarkers, unplacedLine } from '../features/festival-map/map';
import { whereWhen } from '../features/festivals/format';
import { distanceLabel } from '../features/festivals/near';
import { lovedOn, whenRank } from '../features/festivals/shelves';
import { dateBlock } from '../features/festivals/timeline';
import { lovedLine, useFestivalSummary } from '../features/festivals/useFestivalSummary';
import { haptic } from '../lib/haptics';
import { showActionSheet, showAlert } from '../lib/dialog';
import { useToday } from '../lib/useToday';
import { useCatalog } from '../state/catalog';
import { bumpQuestEvent } from '../state/dailyQuests';
import { useGoing } from '../state/going';
import { useLoves } from '../state/useLoves';
import { useNearby } from '../state/nearby';
import { useWeekends } from '../state/weekends';
import { color, radius, space, type } from '../theme/tokens';

const CARD_GAP = 12;
const CARDS_H = 132;

/**
 * The festival map: every festival with a place, glowing on a night-time
 * world. Filter to yours or ones with acts you'd love, pinch and drag around,
 * tap a light or swipe the cards to move between festivals.
 * `?focus=<id>` opens on one festival, `?show=going|love` on a filter.
 */
export default function FestivalMapScreen() {
  const params = useLocalSearchParams<{ focus?: string; show?: string; artist?: string }>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const catalog = useCatalog();
  const { forYou } = useWeekends();
  const festivals = useMemo(() => catalog.festivals.map(forYou), [catalog.festivals, forYou]);
  const { going } = useGoing();
  const loves = useLoves();
  const nearby = useNearby();
  const [toHere, setToHere] = useState(0);
  const today = useToday();

  const all = useMemo(
    () => mapMarkers(festivals, { placeOf: nearby.placeOf, going, lovedOn: (f: Festival) => lovedOn(f, loves), today }),
    [festivals, nearby.placeOf, going, loves, today],
  );
  const initial: MapFilter = params.show === 'going' || params.show === 'love' ? params.show : 'all';
  const [filter, setFilter] = useState<MapFilter>(initial);
  const [when, setWhen] = useState<WhenFilter>('any');
  // Search: what's typed, and what the map has framed (after a pause, so it doesn't jump on every letter).
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setApplied(query.trim()), 450);
    return () => clearTimeout(t);
  }, [query]);
  // The part of the map you moved to: the cards show what's there.
  const [view, setView] = useState<Region | undefined>();
  // An artist's tour: only the festivals they play, past ones too, joined up in date order.
  const touring = params.artist ? catalog.artist(params.artist) : undefined;
  const markers = useMemo(() => {
    if (touring) return inDateOrder(all.filter((m) => m.festival.lineup.includes(touring.id)));
    const shown = searchMarkers(filterWhen(filterMarkers(all, filter), when, today), applied);
    // A festival you came to see stays, whatever the filter.
    const focus = all.find((m) => m.festival.id === params.focus);
    return focus && !shown.includes(focus) ? [focus, ...shown] : shown;
  }, [all, filter, when, applied, today, params.focus, touring]);
  // The cards: what's in view once you've moved the map, otherwise all of them; soonest first.
  const cards = useMemo(
    () =>
      touring
        ? markers
        : view
          ? inView(markers, view, today)
          : [...markers].sort((a, b) => whenRank(a.festival, today) - whenRank(b.festival, today) || a.festival.name.localeCompare(b.festival.name)),
    [touring, markers, view, today],
  );
  const counts = useMemo(
    () => ({ all: filterMarkers(all, 'all').length, going: filterMarkers(all, 'going').length, love: filterMarkers(all, 'love').length }),
    [all],
  );
  const unplaced = festivals.length - all.length;
  // Yours: a line through them in date order.
  const journey = useMemo(() => (touring ? markers.map((m) => m.at) : filter === 'going' ? journeyOf(markers).map((m) => m.at) : undefined), [touring, filter, markers]);
  // Looking around counts for the "Explorer" daily quest.
  useEffect(() => bumpQuestEvent('map'), []);

  // The cards, in the same order as the lights.
  const [selected, setSelected] = useState<string | undefined>(params.focus && all.some((m) => m.festival.id === params.focus) ? params.focus : undefined);
  const list = useRef<FlatList<Marker>>(null);
  const cardW = Math.min(420, width - 56);
  const step = cardW + CARD_GAP;
  const choose = useCallback(
    (id: string) => {
      setSelected(id);
      const i = cards.findIndex((m) => m.festival.id === id);
      if (i >= 0) list.current?.scrollToOffset({ offset: i * step, animated: true });
    },
    [cards, step],
  );
  // Whenever the cards change (opening on a festival, moving the map, a filter), keep the chosen one in view, or start from the first.
  const cardsKey = cards.map((m) => m.festival.id).join('|');
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  useEffect(() => {
    const i = cardsKey.split('|').indexOf(selectedRef.current ?? '');
    const t = setTimeout(() => list.current?.scrollToOffset({ offset: Math.max(0, i) * step, animated: false }), 0);
    return () => clearTimeout(t);
  }, [cardsKey, step]);
  // The website's lists don't say when a swipe has settled: wait for the scrolling to stop.
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(settleTimer.current), []);
  const onCardsScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (Platform.OS !== 'web') return;
    const x = e.nativeEvent.contentOffset.x;
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => settleAt(x), 160);
  };
  const onCardsSettled = (e: NativeSyntheticEvent<NativeScrollEvent>) => settleAt(e.nativeEvent.contentOffset.x);
  const settleAt = (x: number) => {
    const i = Math.round(x / step);
    const m = cards[Math.max(0, Math.min(cards.length - 1, i))];
    if (m && m.festival.id !== selected) {
      haptic.select();
      setSelected(m.festival.id);
    }
  };

  const headerH = insets.top + (touring ? 64 : 112);
  const cardsSpace = cards.length ? CARDS_H + insets.bottom + space.lg : insets.bottom;
  const chips = [
    { key: 'all', label: 'All festivals', count: counts.all, accessibilityLabel: `All festivals, ${counts.all}` },
    ...(counts.going ? [{ key: 'going', label: 'Yours', count: counts.going, accessibilityLabel: `Festivals you're going to or went to, ${counts.going}` }] : []),
    ...(counts.love ? [{ key: 'love', label: 'For you', count: counts.love, accessibilityLabel: `Festivals with artists you'd love, ${counts.love}` }] : []),
  ];

  return (
    <View style={styles.root}>
      <PageTitle title="Festival map" />
      <FestivalMap
        testID="festival-map"
        markers={markers}
        selected={selected}
        onSelect={choose}
        here={nearby.here}
        width={width}
        height={height}
        area={{ top: headerH, bottom: cardsSpace }}
        journey={journey}
        toHere={toHere}
        frameKey={`${params.artist ?? ''}|${filter}|${when}|${applied}`}
        onView={setView}
      />

      {/* The header fades into the map, so the lights glide under it. */}
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <LinearGradient
          colors={['rgba(10,9,24,0.94)', 'rgba(10,9,24,0.86)', 'rgba(10,9,24,0)']}
          locations={[0, 0.7, 1]}
          style={styles.scrim}
          pointerEvents="none"
        />
        {searching ? (
          <View style={styles.searchRow}>
            <View style={{ flex: 1 }}>
              <SearchField value={query} onChange={setQuery} placeholder="Festival or city" label="Search the map" autoFocus />
            </View>
            <Pressable
              onPress={() => {
                haptic.select();
                setSearching(false);
                setQuery('');
                setApplied('');
              }}
              accessibilityRole="button"
              accessibilityLabel="Stop searching"
              hitSlop={8}
            >
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.titleWrap} pointerEvents="none">
            <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
              {touring ? `${touring.name} on tour` : 'Festival map'}
            </Text>
            <Text style={styles.sub}>
              {touring ? tourLine(markers.length) : view ? `${inViewLine(cards.length)} · ${markers.length} in all` : subLine(markers.length, filter)}
            </Text>
          </View>
        )}
        {touring ? null : (
          <View style={styles.chips}>
            {/* When: any time, or soon. */}
            <Pressable
              onPress={() => {
                haptic.select();
                const keys: WhenFilter[] = ['any', 'month', 'season'];
                showActionSheet({ title: 'When', options: [...keys.map((k) => WHEN_LABEL[k]), 'Cancel'], cancelButtonIndex: keys.length }, (i) => {
                  if (i < keys.length) setWhen(keys[i]);
                });
              }}
              accessibilityRole="button"
              accessibilityLabel={`When: ${WHEN_LABEL[when]}. Change`}
              style={({ pressed }) => [styles.when, when !== 'any' && styles.whenOn, pressed && { opacity: 0.8 }]}
            >
              <Text style={[styles.whenText, when !== 'any' && { color: color.moon }]}>{WHEN_LABEL[when]}</Text>
              <ChevronIcon color={color.moonDim} size={10} direction="down" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <FilterChips chips={chips} value={filter} onChange={(k) => setFilter((k as MapFilter | undefined) ?? 'all')} inset={space.sm} />
            </View>
          </View>
        )}
      </View>
      <PageActions />
      {/* You on the map: switches on Near you the first time (it asks), then glides to you. */}
      <View style={[styles.here, { top: insets.top + space.sm }]}>
        {touring || searching ? null : (
          <GlassCircleButton
            label="Search the map"
            onPress={() => {
              haptic.select();
              setSearching(true);
            }}
          >
            <SearchIcon color={color.moon} size={17} />
          </GlassCircleButton>
        )}
        <GlassCircleButton
          label={nearby.here ? 'Show where I am' : 'Show me on the map'}
          hint={nearby.here ? undefined : 'Uses your location, rounded, kept on this phone'}
          onPress={() => {
            if (nearby.here) setToHere((n) => n + 1);
            else
              void nearby.turnOn().then((s) => {
                if (s === 'on') setToHere((n) => n + 1);
                else if (s === 'denied') showAlert('Location is off for Afterglow', 'Turn it on in your settings to see where you are among the festivals.');
              });
          }}
        >
          <LocateIcon color={nearby.here ? '#6FC3FF' : color.moon} size={18} />
        </GlassCircleButton>
      </View>

      {cards.length === 0 && view && markers.length ? (
        <View style={[styles.empty, { bottom: insets.bottom + space.xl }]} pointerEvents="none">
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <Text style={styles.emptyTitle}>No festivals here</Text>
          <Text style={styles.emptyText}>Zoom out, or tap Show all.</Text>
        </View>
      ) : markers.length === 0 ? (
        <View style={[styles.empty, { bottom: insets.bottom + space.xl }]}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <Text style={styles.emptyTitle}>
            {applied || when !== 'any' ? 'No festivals match' : filter === 'going' ? 'None of your festivals are on the map yet' : 'No festivals on the map yet'}
          </Text>
          <Text style={styles.emptyText}>
            {applied || when !== 'any'
              ? 'Try another name or city, or any time.'
              : filter === 'going'
                ? 'Tap I’m going on a festival and it lights up here.'
                : (unplacedLine(unplaced) ?? 'New festivals arrive every night.')}
          </Text>
        </View>
      ) : (
        <View style={[styles.cards, { bottom: insets.bottom + space.md }]}>
          <FlatList
            ref={list}
            horizontal
            data={cards}
            keyExtractor={(m) => m.festival.id}
            showsHorizontalScrollIndicator={false}
            snapToInterval={step}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: (width - cardW) / 2 }}
            ItemSeparatorComponent={Gap}
            getItemLayout={(_, index) => ({ length: step, offset: step * index, index })}
            onMomentumScrollEnd={onCardsSettled}
            onScroll={onCardsScroll}
            scrollEventThrottle={32}
            renderItem={({ item }) => <MapCard marker={item} width={cardW} chosen={item.festival.id === selected} onFocus={() => choose(item.festival.id)} />}
          />
        </View>
      )}
    </View>
  );
}

const Gap = () => <View style={{ width: CARD_GAP }} />;

const tourLine = (n: number) => (n === 0 ? 'No festivals with a place yet' : n === 1 ? '1 festival' : `${n} festivals, in date order`);

const subLine = (n: number, filter: MapFilter) =>
  n === 0 ? 'Nothing to show here yet' : filter === 'going' ? (n > 1 ? `Your journey · ${n} festivals` : '1 of yours') : filter === 'love' ? `${n} with artists you’d love` : n === 1 ? '1 festival' : `${n} festivals`;

/** A festival's card under the map: its date, name, place, what's there for you. */
function MapCard({ marker, width, chosen, onFocus }: { marker: Marker; width: number; chosen: boolean; onFocus: () => void }) {
  const f = marker.festival;
  const s = useFestivalSummary(f);
  const block = dateBlock(f);
  const tint = TONE_COLOR[marker.tone];
  const facts = [marker.going ? (marker.tone === 'over' ? 'Been there' : 'Going') : undefined, lovedLine(s.loved, s.ranked.length), s.soon].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        if (!chosen) onFocus();
        else router.push(`/festival/${f.id}`);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${f.name}, ${whereWhen(f)}. ${facts}`}
      accessibilityHint={chosen ? 'Opens the festival' : 'Shows it on the map'}
      testID={`map-card-${f.id}`}
      style={({ pressed }) => [styles.card, { width }, chosen && { borderColor: tint }, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.cardRow}>
        <View style={[styles.date, marker.going && { backgroundColor: tint }]}>
          <Text style={[styles.month, marker.going && styles.onTint]}>{block?.month ?? 'TBA'}</Text>
          <Text style={[styles.days, marker.going && styles.onTint]}>{block?.days ?? '–'}</Text>
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardName} numberOfLines={1}>
            {f.name}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {f.location}
            {s.away !== undefined ? ` · ${distanceLabel(s.away, s.units)}` : ''}
          </Text>
          <Text style={[styles.cardFacts, marker.loved > 0 && { color: color.glow }]} numberOfLines={1}>
            {facts}
          </Text>
        </View>
      </View>
      <View style={styles.cardFoot}>
        <View style={styles.faces}>
          {s.ranked.slice(0, 4).map((a, i) => (
            <View key={a.id} style={{ marginLeft: i ? -8 : 0, zIndex: 10 - i }}>
              <ArtistAvatar artist={a} size={26} />
            </View>
          ))}
        </View>
        <Text style={styles.open}>{chosen ? 'Open ›' : 'Show'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  header: { position: 'absolute', left: 0, right: 0, top: 0 },
  here: { position: 'absolute', right: space.lg, flexDirection: 'row', gap: space.sm },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, height: 44, paddingLeft: 64, paddingRight: 112 },
  cancel: { ...type.label, color: color.glow },
  when: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: space.lg,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  whenOn: { borderColor: color.glow, backgroundColor: 'rgba(169,124,255,0.18)' },
  whenText: { ...type.label, color: color.moonDim },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: -32 },
  titleWrap: { alignItems: 'center', height: 44, justifyContent: 'center', paddingHorizontal: 112 },
  title: { ...type.headline, color: color.moon },
  sub: { ...type.caption, color: color.moonDim, marginTop: 1 },
  chips: { marginTop: space.sm, flexDirection: 'row', alignItems: 'center' },
  cards: { position: 'absolute', left: 0, right: 0, height: CARDS_H },
  card: {
    height: CARDS_H,
    borderRadius: radius.lg,
    overflow: 'hidden',
    padding: space.md,
    borderWidth: 1,
    borderColor: color.hairline,
    backgroundColor: 'rgba(18,16,38,0.55)',
    justifyContent: 'space-between',
  },
  cardRow: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  date: {
    width: 52,
    height: 56,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glass,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  month: { ...type.caption, fontSize: 11, color: color.glow, letterSpacing: 1 },
  days: { ...type.headline, color: color.moon },
  onTint: { color: color.night },
  cardText: { flex: 1, minWidth: 0 },
  cardName: { ...type.headline, color: color.moon },
  cardMeta: { ...type.caption, color: color.moonDim, marginTop: 2 },
  cardFacts: { ...type.caption, color: color.moonDim, marginTop: 4 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faces: { flexDirection: 'row' },
  open: { ...type.label, color: color.glow },
  empty: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    padding: space.lg,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  emptyTitle: { ...type.headline, color: color.moon },
  emptyText: { ...type.body, color: color.moonDim, marginTop: space.xs },
});
