import { LinearGradient } from 'expo-linear-gradient';
import { PageTitle } from '../../components/PageTitle';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistAvatar, artistColors } from '../../components/ArtistAvatar';
import { ArtistRow } from '../../components/ArtistRow';
import { FestivalRow } from '../../components/FestivalRow';
import { SearchField } from '../../components/SearchField';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { NoticeBell } from '../../components/NoticeBell';
import { CalendarIcon, GridIcon, ListIcon, MapIcon } from '../../components/TabIcons';
import type { Artist, Festival } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { groupFestivals } from '../../features/festivals/going';
import { byMonth, bySoonest, festivalShelf, isMany, isOver } from '../../features/festivals/shelves';
import { NextUpCard } from '../../features/festivals/NextUpCard';
import { FestivalWeekCard } from '../../features/festivalWeek/FestivalWeekCard';
import { LineupReadyCard } from '../../features/plan/LineupReadyCard';
import { readyFestival } from '../../features/plan/ready';
import { TimelineRow } from '../../features/festivals/TimelineRow';
import { useLoves } from '../../state/useLoves';
import { PlayIcon } from '../../features/discover/icons';
import { coverPhotos } from '../../features/festivals/cover';
import { FestivalCover } from '../../features/festivals/FestivalCover';
import { lineupReach } from '../../features/festivals/links';
import { searchArtists, searchFestivals } from '../../features/festivals/search';
import { distanceShort, nearYou, reachLabel } from '../../features/festivals/near';
import { NearYouPrompt } from '../../features/festivals/NearYouPrompt';
import { useNearby } from '../../state/nearby';
import { countdown } from '../../features/festivals/when';
import { useToday } from '../../lib/useToday';
import { useCatalog, useCatalogRefresh } from '../../state/catalog';
import { revealSecret } from '../../state/secrets';
import { type FestivalsView, useFestivalsView } from '../../state/festivalsView';
import { useGoing } from '../../state/going';
import { useWeekends } from '../../state/weekends';
import { useRatings } from '../../state/ratings';
import { useTaste } from '../../state/taste';
import { color, radius, space, type, glowA } from '../../theme/tokens';

const LOVE = 0.8;
/** Tiles on the For you shelf are this big. */
const SHELF_TILE = 168;
/** With many festivals, "More festivals" shows this many at a time. */
const MORE_PAGE = 20;

export default function FestivalsScreen() {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const { taste } = useTaste();
  const catalog = useCatalog();
  // Festivals as they are for you: a two-weekend festival counts down to the weekend you're going to.
  const { forYou } = useWeekends();
  const festivals = useMemo(() => catalog.festivals.map(forYou), [catalog.festivals, forYou]);
  const { going } = useGoing();
  const { ratings } = useRatings();
  const today = useToday();
  const groups = groupFestivals(festivals, going, today);
  // Many festivals (the nightly feed): a short shelf for you, the rest behind "More festivals".
  const loves = useLoves();
  const many = isMany(festivals);
  // Near you, once you've turned it on: festivals within reach you're not already going to.
  const nearby = useNearby();
  const near = useMemo(
    () => (nearby.here ? nearYou(festivals.filter((f) => !going.includes(f.id)), nearby.here, nearby.placeOf, today) : []),
    [nearby.here, nearby.placeOf, festivals, going, today],
  );
  const shelf = useMemo(() => {
    if (!many) return undefined;
    const nearIds = new Set(near.map((n) => n.festival.id));
    return festivalShelf(festivals.filter((f) => !nearIds.has(f.id)), going, loves, today);
  }, [many, festivals, going, loves, today, near]);
  // The festival you're going to next leads the page; any others you're going to follow it.
  // Set times out for one of them: your set-to-set plan leads instead.
  const ready = readyFestival(groups.going, today);
  const upNext = groups.going.find((f) => !isOver(f, today) && f !== ready);
  const alsoGoing = groups.going.filter((f) => f !== upNext && f !== ready);
  // Everything else, soonest first, month by month: nothing hidden, a page at a time.
  const shownAbove = new Set([...(shelf?.festivals ?? []), ...near.map((n) => n.festival)].map((f) => f.id));
  const rest = bySoonest(groups.others.filter((f) => !shownAbove.has(f.id)), today);
  const [restShown, setRestShown] = useState(MORE_PAGE);
  // Find any artist or festival.
  const [query, setQuery] = useState('');
  const found = useMemo(() => searchArtists(catalog.artists, query), [catalog.artists, query]);
  const foundFestivals = useMemo(() => searchFestivals(festivals, query), [festivals, query]);
  const searching = query.trim().length > 0;
  // Rows on a timeline or square tiles, your choice.
  const { view, setView } = useFestivalsView();
  // Pull to refresh: the latest festivals and clips. Three pulls in a row set off fireworks.
  const refreshCatalog = useCatalogRefresh();
  const [refreshing, setRefreshing] = useState(false);
  const pulls = useRef<number[]>([]);
  const pullToRefresh = () => {
    haptic.soft();
    const now = Date.now();
    pulls.current = [...pulls.current.filter((t) => now - t < 20_000), now];
    if (pulls.current.length >= 3) {
      pulls.current = [];
      revealSecret('fireworks');
    }
    setRefreshing(true);
    void refreshCatalog().finally(() => {
      setRefreshing(false);
      haptic.settle();
    });
  };
  const list = (fs: Festival[], isGoing = false) => <FestivalList festivals={fs} taste={taste} view={view} going={isGoing} />;

  return (
    <View style={styles.root}>
      <PageTitle title="Festivals" />
      <NightSky />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.lg,
          paddingBottom: tabSpace + space.xl,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} tintColor={color.glow} colors={[color.glow]} progressBackgroundColor={color.nightRaised} />
        }
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Festivals</Text>
            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  haptic.select();
                  router.push('/festival-map');
                }}
                accessibilityRole="button"
                accessibilityLabel="Festival map"
                accessibilityHint="Every festival, glowing on a map"
                hitSlop={10}
                style={({ pressed }) => [styles.toggle, pressed && { transform: [{ scale: 0.92 }] }]}
              >
                <MapIcon color={color.moonDim} />
              </Pressable>
              <ViewToggle value={view} onChange={setView} />
              <NoticeBell />
            </View>
          </View>
          <View style={styles.searchWrap}>
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Artist or festival"
              label="Find an artist or festival"
            />
          </View>
        </View>
        {searching ? (
          <View style={styles.results}>
            {foundFestivals.length > 0 && <Text style={styles.resultsHead}>Festivals</Text>}
            {foundFestivals.map((f) => (
              <FestivalRow key={f.id} festival={f} />
            ))}
            {found.length > 0 && foundFestivals.length > 0 && <Text style={styles.resultsHead}>Artists</Text>}
            {found.length === 0 && foundFestivals.length === 0 ? (
              <Text style={styles.noMatch}>No festival or artist matches “{query.trim()}”.</Text>
            ) : (
              found.map((a) => {
                const at = catalog.festivalsOf(a.id);
                return (
                  <ArtistRow
                    key={a.id}
                    artist={a}
                    affinity={taste[a.id] ?? 0}
                    festivalId={at.length === 1 ? at[0].id : undefined}
                    detail={at.length ? `Plays ${at.map((f) => f.name).join(', ')}` : undefined}
                    rating={ratings[a.id]}
                  />
                );
              })
            )}
            {/* Not in the app yet? Ask for it, with what you typed filled in. */}
            {foundFestivals.length === 0 && <RequestRow name={query.trim()} />}
          </View>
        ) : (
          <>
            {ready ? <LineupReadyCard festival={ready} /> : null}
            {upNext ? <NextUpCard festival={upNext} /> : null}
            {/* The week before a festival you're going to: a door a day. */}
            {[ready, upNext].map((f) => (f ? <FestivalWeekCard key={`week-${f.id}`} festival={f} showName /> : null))}
            {alsoGoing.length > 0 && <SectionHead title={upNext || ready ? 'Also going' : 'Going'} />}
            {list(alsoGoing, true)}
            {nearby.status === 'on' && (many || near.length > 0) ? (
              <>
                <View style={styles.nearHead}>
                  <Text style={[styles.section, styles.nearTitle]}>Near you</Text>
                  <Pressable
                    onPress={() => {
                      haptic.select();
                      nearby.turnOff();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Stop showing festivals near you"
                    hitSlop={8}
                  >
                    <Text style={styles.nearOff}>Turn off</Text>
                  </Pressable>
                </View>
                <Text style={styles.nearSub}>
                  {reachLabel(nearby.units)} of {nearby.hereLabel ?? 'you'}
                </Text>
                {near.length > 0 ? list(near.map((n) => n.festival)) : <Text style={styles.nearNone}>No festivals that close yet. New ones arrive every night.</Text>}
              </>
            ) : (
              many && <NearYouPrompt />
            )}
            {/* With many festivals: a short shelf picked for you, to swipe through. */}
            {shelf && shelf.festivals.length > 0 ? (
              <>
                <SectionHead title={shelf.title} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf} style={styles.shelfWrap}>
                  {shelf.festivals.map((f) => (
                    <FestivalTile key={f.id} festival={f} taste={taste} size={SHELF_TILE} />
                  ))}
                </ScrollView>
              </>
            ) : null}
            {rest.length > 0 && <SectionHead title={groups.going.length || shelf ? 'All festivals' : 'Coming up'} count={rest.length} calendar />}
            {byMonth(rest.slice(0, restShown), today).map((g) => (
              <View key={g.label}>
                <Text style={[styles.section, styles.month]}>{g.label}</Text>
                {list(g.festivals)}
              </View>
            ))}
            {rest.length > restShown && (
              <Pressable
                onPress={() => {
                  haptic.select();
                  setRestShown((n) => n + MORE_PAGE);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Show more festivals. ${rest.length - restShown} left`}
                style={({ pressed }) => [styles.showMore, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.showMoreText}>Show more · {rest.length - restShown} left</Text>
              </Pressable>
            )}
            <RequestRow />
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** A section title, with how many when it helps. */
function SectionHead({ title, count, calendar }: { title: string; count?: number; calendar?: boolean }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.section, styles.sectionTitle]} accessibilityRole="header">
        {title}
      </Text>
      {count ? <Text style={styles.sectionCount}>{count}</Text> : null}
      {calendar ? (
        <Pressable
          onPress={() => {
            haptic.select();
            router.push('/festival-calendar');
          }}
          accessibilityRole="button"
          accessibilityLabel="See festivals on a calendar"
          hitSlop={10}
          style={({ pressed }) => [styles.calLink, pressed && { opacity: 0.7 }]}
        >
          <CalendarIcon color={color.glow} size={14} />
          <Text style={styles.calText}>Calendar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Switch between big cards and square tiles. */
function ViewToggle({ value, onChange }: { value: FestivalsView; onChange: (v: FestivalsView) => void }) {
  const next = value === 'list' ? 'grid' : 'list';
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onChange(next);
      }}
      accessibilityRole="button"
      accessibilityLabel={next === 'grid' ? 'Show festivals as tiles' : 'Show festivals as a list'}
      hitSlop={10}
      style={({ pressed }) => [styles.toggle, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      {value === 'list' ? <GridIcon color={color.moonDim} /> : <ListIcon color={color.moonDim} />}
    </Pressable>
  );
}

function FestivalList({ festivals, taste, view, going }: { festivals: Festival[]; taste: Record<string, number>; view: FestivalsView; going?: boolean }) {
  if (!festivals.length) return null;
  if (view === 'list') return festivals.map((f) => <TimelineRow key={f.id} festival={f} going={going} />);
  return (
    <View style={styles.grid}>
      {festivals.map((f) => (
        <FestivalTile key={f.id} festival={f} taste={taste} />
      ))}
    </View>
  );
}

/** "Missing a festival? Request it", or, while searching, a request for what you typed. */
function RequestRow({ name }: { name?: string }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push(name ? { pathname: '/request', params: { name } } : '/request');
      }}
      accessibilityRole="button"
      accessibilityLabel={name ? `Can't find it? Request ${name}` : 'Missing a festival? Request it'}
      style={({ pressed }) => [styles.request, name && styles.requestInline, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.requestText}>
        {name ? (
          <>
            Can’t find it? <Text style={styles.requestLink}>Request “{name}”</Text>
          </>
        ) : (
          <>
            Missing a festival? <Text style={styles.requestLink}>Request it</Text>
          </>
        )}
      </Text>
    </Pressable>
  );
}

/** How tall the faces are across the top of a festival card. */
const COVER_HEIGHT = 128;

/** The festival as a square tile: countdown, name, how many you'll love, and its clips. */
function FestivalTile({ festival, taste, size: fixed }: { festival: Festival; taste: Record<string, number>; size?: number }) {
  const { artist: artistById, clips } = useCatalog();
  const { width } = useWindowDimensions();
  const size = fixed ?? (width - space.lg * 2 - space.md) / 2;
  const reach = lineupReach(festival, clips);
  const today = useToday();
  const soon = countdown(festival, today);
  const ranked = festival.lineup
    .map((id) => artistById(id))
    .filter((a): a is Artist => !!a)
    .sort((a, b) => (taste[b.id] ?? 0) - (taste[a.id] ?? 0));
  const loved = ranked.filter((a) => (taste[a.id] ?? 0) >= LOVE).length;
  const timesOut = !!festival.sets?.length;
  const { distanceTo, units } = useNearby();
  const away = distanceTo(festival);
  // The colour of your best match there tints the tile.
  const [, bright] = artistColors(ranked[0]?.id ?? festival.id, ranked[0]?.color);
  const cover = coverPhotos(festival, artistById);
  const discover = () => {
    haptic.tap();
    router.navigate({ pathname: '/', params: { festival: festival.id } });
  };

  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push(`/festival/${festival.id}`);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${festival.name}, ${festival.dates}${soon ? `, ${soon}` : ''}, ${loved ? `${loved} artists you'll love` : `${ranked.length} artists`}`}
      accessibilityActions={reach.clips > 0 ? [{ name: 'discover', label: 'Discover the lineup' }] : undefined}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'discover') discover();
      }}
      style={({ pressed }) => [styles.tile, { width: size, height: size }, cover.length > 0 && { backgroundColor: color.night }, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
    >
      {/* The headliners' faces behind it all, when they have photos. */}
      <FestivalCover photos={cover} style={StyleSheet.absoluteFill} />
      {cover.length > 0 && <View style={styles.coverGlass} pointerEvents="none" />}
      <LinearGradient colors={[`${bright}33`, 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Text style={[styles.tileWhen, timesOut && { color: color.glow }]} numberOfLines={1}>
        {timesOut ? 'Set times out' : (soon ?? festival.dates)}
      </Text>
      <Text style={styles.tileName} numberOfLines={3}>
        {festival.name}
      </Text>
      <Text style={styles.tileLoved} numberOfLines={1}>
        {loved > 0 ? `${loved} you’ll love` : `${ranked.length} acts`}
        {away !== undefined ? ` · ${distanceShort(away, units)}` : ''}
      </Text>
      <View style={styles.tileBottom}>
        <View style={[styles.faces, { flex: 1 }]}>
          {ranked.slice(0, 3).map((a, i) => (
            <View key={a.id} style={[styles.face, { marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }]}>
              <ArtistAvatar artist={a} size={26} />
            </View>
          ))}
        </View>
        {reach.clips > 0 && (
          <Pressable
            onPress={discover}
            accessibilityRole="button"
            accessibilityLabel={`Discover the ${festival.name} lineup, ${reach.clips} ${reach.clips === 1 ? 'clip' : 'clips'}`}
            hitSlop={8}
            style={({ pressed }) => [styles.tileClips, pressed && { opacity: 0.75 }]}
          >
            <PlayIcon color={color.moon} size={10} />
            <Text style={styles.clipsText}>{reach.clips}</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  calLink: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5 },
  calText: { ...type.label, color: color.glow },
  root: { flex: 1, backgroundColor: color.night },
  header: { paddingHorizontal: space.xl, marginBottom: space.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  toggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  resultsHead: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.md, marginBottom: space.xs },
  month: { marginTop: space.md, marginBottom: space.sm, fontSize: 12, color: color.glow },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.lg, paddingRight: space.xl },
  sectionTitle: { ...type.headline, fontSize: 20, textTransform: 'none', letterSpacing: 0, color: color.moon, paddingRight: 0, marginBottom: space.sm },
  sectionCount: { ...type.label, color: color.moonFaint, fontVariant: ['tabular-nums'] },
  shelfWrap: { flexGrow: 0, marginBottom: space.md },
  shelf: { paddingHorizontal: space.lg, gap: space.md },
  showMore: {
    alignSelf: 'center',
    marginTop: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  showMoreText: { ...type.label, color: color.moonDim },
  request: { alignSelf: 'center', paddingVertical: space.lg, paddingHorizontal: space.xl },
  requestInline: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  requestText: { ...type.label, color: color.moonDim },
  requestLink: { color: color.glow },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginHorizontal: space.lg, marginBottom: space.lg },
  tile: {
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    overflow: 'hidden',
  },
  tileWhen: { ...type.caption, color: color.moonDim, fontVariant: ['tabular-nums'] },
  tileName: { ...type.headline, fontSize: 19, lineHeight: 23, color: color.moon, marginTop: space.sm, flex: 1 },
  tileBottom: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tileLoved: { ...type.caption, color: color.moonDim, marginBottom: space.sm },
  tileClips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: glowA(0.18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.4),
  },
  title: { ...type.largeTitle, color: color.moon },
  subtitle: { ...type.body, color: color.moonDim, marginTop: space.xs },
  searchWrap: { marginTop: space.lg },
  results: { paddingHorizontal: space.xl },
  clips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: space.sm,
    paddingRight: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: glowA(0.18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.4),
  },
  clipsText: { ...type.caption, color: color.moon, fontVariant: ['tabular-nums'] },
  noMatch: { ...type.body, color: color.moonDim, paddingVertical: space.lg },
  nearHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: space.xl },
  nearTitle: { flex: 1 },
  nearOff: { ...type.label, color: color.moonFaint },
  nearSub: { ...type.caption, color: color.moonDim, paddingHorizontal: space.xl, marginTop: -space.xs, marginBottom: space.md },
  nearNone: { ...type.body, color: color.moonDim, paddingHorizontal: space.xl, marginBottom: space.lg },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingRight: space.xl, marginTop: space.sm },
  moreText: { marginBottom: 0, paddingRight: 0 },
  moreCount: { ...type.label, color: color.moonFaint, flex: 1, fontVariant: ['tabular-nums'] },
  section: {
    ...type.label,
    color: color.moonFaint,
    paddingHorizontal: space.xl,
    marginBottom: space.md,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  card: {
    marginHorizontal: space.lg,
    marginBottom: space.lg,
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  // Solid night under the cover and the glass laid over both, so the faces fade into the card with no edge.
  cardCovered: { overflow: 'hidden', paddingTop: COVER_HEIGHT - space.xl * 1.5, backgroundColor: color.night },
  coverGlass: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.glass },
  cover: { position: 'absolute', top: 0, left: 0, right: 0, height: COVER_HEIGHT },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  name: { ...type.title, color: color.moon },
  meta: { ...type.body, color: color.moonDim, marginTop: 2 },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.xl,
    gap: space.lg,
  },
  faces: { flexDirection: 'row' },
  face: { borderRadius: 20, borderWidth: 2, borderColor: color.night },
  loved: { ...type.label, color: color.moon },
  status: { ...type.caption, color: color.moonDim, marginTop: 2 },
});
