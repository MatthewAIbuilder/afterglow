import { LinearGradient } from 'expo-linear-gradient';
import { PageTitle } from '../../components/PageTitle';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistAvatar, artistColors } from '../../components/ArtistAvatar';
import { ArtistRow } from '../../components/ArtistRow';
import { FestivalRow } from '../../components/FestivalRow';
import { SearchField } from '../../components/SearchField';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { NoticeBell } from '../../components/NoticeBell';
import { ChevronIcon, GridIcon, ListIcon } from '../../components/TabIcons';
import type { Artist, Festival } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { groupFestivals } from '../../features/festivals/going';
import { bySoonest, festivalShelf, isMany } from '../../features/festivals/shelves';
import { useLoves } from '../../state/useLoves';
import { PlayIcon } from '../../features/discover/icons';
import { lineupReach } from '../../features/festivals/links';
import { searchArtists, searchFestivals } from '../../features/festivals/search';
import { whereWhen } from '../../features/festivals/format';
import { countdown } from '../../features/festivals/when';
import { useToday } from '../../lib/useToday';
import { useCatalog } from '../../state/catalog';
import { type FestivalsView, useFestivalsView } from '../../state/festivalsView';
import { useGoing } from '../../state/going';
import { useWeekends } from '../../state/weekends';
import { useRatings } from '../../state/ratings';
import { useTaste } from '../../state/taste';
import { color, radius, space, type } from '../../theme/tokens';

const LOVE = 0.8;
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
  const shelf = useMemo(
    () => (many ? festivalShelf(festivals, going, loves, today) : undefined),
    [many, festivals, going, loves, today],
  );
  const rest = useMemo(
    () => (shelf ? bySoonest(groups.others.filter((f) => !shelf.festivals.includes(f)), today) : groups.others),
    [shelf, groups.others, today],
  );
  const [restShown, setRestShown] = useState(MORE_PAGE);
  // Find any artist or festival.
  const [query, setQuery] = useState('');
  const found = useMemo(() => searchArtists(catalog.artists, query), [catalog.artists, query]);
  const foundFestivals = useMemo(() => searchFestivals(festivals, query), [festivals, query]);
  const searching = query.trim().length > 0;
  const [showMore, setShowMore] = useState(false);
  // Big cards or square tiles, your choice.
  const { view, setView } = useFestivalsView();
  const list = (fs: Festival[]) => <FestivalList festivals={fs} taste={taste} view={view} />;

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
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Festivals</Text>
            <View style={styles.actions}>
              <ViewToggle value={view} onChange={setView} />
              <NoticeBell />
            </View>
          </View>
          <Text style={styles.subtitle}>Lineups ranked by your sound.</Text>
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
            {groups.going.length > 0 && <Text style={styles.section}>Going</Text>}
            {list(groups.going)}
            {shelf && shelf.festivals.length > 0 && <Text style={styles.section}>{shelf.title}</Text>}
            {shelf && list(shelf.festivals)}
            {/* Once you're going somewhere (or there are many), the rest wait behind "More festivals" so they stay out of the way. */}
            {(groups.going.length > 0 || shelf) && rest.length > 0 && (
              <Pressable
                onPress={() => {
                  haptic.select();
                  setShowMore((v) => !v);
                }}
                accessibilityRole="button"
                accessibilityState={{ expanded: showMore }}
                accessibilityLabel={`More festivals, ${rest.length}. ${showMore ? 'Hide them' : 'Show them'}`}
                hitSlop={6}
                style={({ pressed }) => [styles.moreRow, pressed && { opacity: 0.7 }]}
              >
                <Text style={[styles.section, styles.moreText]}>More festivals</Text>
                <Text style={styles.moreCount}>{rest.length}</Text>
                <ChevronIcon color={color.moonFaint} size={12} direction={showMore ? 'up' : 'down'} />
              </Pressable>
            )}
            {shelf ? (
              showMore && (
                <>
                  {list(rest.slice(0, restShown))}
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
                </>
              )
            ) : (
              (groups.going.length === 0 || showMore) && list(groups.others)
            )}
            <RequestRow />
          </>
        )}
      </ScrollView>
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
      accessibilityLabel={next === 'grid' ? 'Show festivals as tiles' : 'Show festivals as cards'}
      hitSlop={10}
      style={({ pressed }) => [styles.toggle, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      {value === 'list' ? <GridIcon color={color.moonDim} /> : <ListIcon color={color.moonDim} />}
    </Pressable>
  );
}

function FestivalList({ festivals, taste, view }: { festivals: Festival[]; taste: Record<string, number>; view: FestivalsView }) {
  if (view === 'list') return festivals.map((f) => <FestivalCard key={f.id} festival={f} taste={taste} />);
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

/** The festival as a square tile: countdown, name, how many you'll love, and its clips. */
function FestivalTile({ festival, taste }: { festival: Festival; taste: Record<string, number> }) {
  const { artist: artistById, clips } = useCatalog();
  const { width } = useWindowDimensions();
  const size = (width - space.lg * 2 - space.md) / 2;
  const reach = lineupReach(festival, clips);
  const today = useToday();
  const soon = countdown(festival, today);
  const ranked = festival.lineup
    .map((id) => artistById(id))
    .filter((a): a is Artist => !!a)
    .sort((a, b) => (taste[b.id] ?? 0) - (taste[a.id] ?? 0));
  const loved = ranked.filter((a) => (taste[a.id] ?? 0) >= LOVE).length;
  const timesOut = !!festival.sets?.length;
  // The colour of your best match there tints the tile.
  const [, bright] = artistColors(ranked[0]?.id ?? festival.id);
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
      style={({ pressed }) => [styles.tile, { width: size, height: size }, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
    >
      <LinearGradient colors={[`${bright}33`, 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Text style={[styles.tileWhen, timesOut && { color: color.glow }]} numberOfLines={1}>
        {timesOut ? 'Set times out' : (soon ?? festival.dates)}
      </Text>
      <Text style={styles.tileName} numberOfLines={3}>
        {festival.name}
      </Text>
      <Text style={styles.tileLoved} numberOfLines={1}>
        {loved > 0 ? `${loved} you’ll love` : `${ranked.length} acts`}
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

function FestivalCard({ festival, taste }: { festival: Festival; taste: Record<string, number> }) {
  const { artist: artistById, clips } = useCatalog();
  const reach = lineupReach(festival, clips);
  const discover = () => {
    haptic.tap();
    router.navigate({ pathname: '/', params: { festival: festival.id } });
  };
  const ranked = festival.lineup
    .map((id) => artistById(id))
    .filter((a): a is Artist => !!a)
    .sort((a, b) => (taste[b.id] ?? 0) - (taste[a.id] ?? 0));
  const loved = ranked.filter((a) => (taste[a.id] ?? 0) >= LOVE).length;
  const timesOut = !!festival.sets?.length;
  const today = useToday();
  const soon = countdown(festival, today);

  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push(`/festival/${festival.id}`);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${festival.name}, ${festival.dates}`}
      // The clips button sits inside the card, so screen readers get it as an action on the card.
      accessibilityActions={reach.clips > 0 ? [{ name: 'discover', label: 'Discover the lineup' }] : undefined}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'discover') discover();
      }}
      style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.985 }], opacity: 0.9 }]}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{festival.name}</Text>
          <Text style={styles.meta}>
            {whereWhen(festival)}
          </Text>
        </View>
        <ChevronIcon color={color.moonFaint} />
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.faces}>
          {ranked.slice(0, 4).map((a, i) => (
            <View key={a.id} style={[styles.face, { marginLeft: i === 0 ? 0 : -12, zIndex: 10 - i }]}>
              <ArtistAvatar artist={a} size={38} />
            </View>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.loved}>
            {loved > 0 ? `${loved} of ${ranked.length} artists you'll love` : `${ranked.length} artists`}
          </Text>
          <Text style={[styles.status, timesOut && { color: color.glow }]}>
            {soon ? `${soon} · ` : ''}
            {timesOut ? 'Set times are out' : 'Set times not announced yet'}
          </Text>
        </View>
        {reach.clips > 0 && (
          <Pressable
            onPress={discover}
            accessibilityRole="button"
            accessibilityLabel={`Discover the ${festival.name} lineup, ${reach.clips} ${reach.clips === 1 ? 'clip' : 'clips'}`}
            hitSlop={8}
            style={({ pressed }) => [styles.clips, pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] }]}
          >
            <PlayIcon color={color.moon} size={12} />
            <Text style={styles.clipsText}>{reach.clips}</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(169,124,255,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.4)',
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
    backgroundColor: 'rgba(169,124,255,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.4)',
  },
  clipsText: { ...type.caption, color: color.moon, fontVariant: ['tabular-nums'] },
  noMatch: { ...type.body, color: color.moonDim, paddingVertical: space.lg },
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
