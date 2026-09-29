import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { ArtistRow } from '../../components/ArtistRow';
import { SearchField } from '../../components/SearchField';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { NoticeBell } from '../../components/NoticeBell';
import { ChevronIcon } from '../../components/TabIcons';
import type { Artist, Festival } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { groupFestivals } from '../../features/festivals/going';
import { PlayIcon } from '../../features/discover/icons';
import { lineupReach } from '../../features/festivals/links';
import { searchArtists } from '../../features/festivals/search';
import { countdown } from '../../features/festivals/when';
import { useToday } from '../../lib/useToday';
import { useCatalog } from '../../state/catalog';
import { useGoing } from '../../state/going';
import { useRatings } from '../../state/ratings';
import { useTaste } from '../../state/taste';
import { color, radius, space, type } from '../../theme/tokens';

const LOVE = 0.8;

export default function FestivalsScreen() {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const { taste } = useTaste();
  const catalog = useCatalog();
  const { festivals } = catalog;
  const { going } = useGoing();
  const { ratings } = useRatings();
  const today = useToday();
  const groups = groupFestivals(festivals, going, today);
  // Find any artist across every lineup.
  const [query, setQuery] = useState('');
  const found = useMemo(() => searchArtists(catalog.artists, query), [catalog.artists, query]);
  const searching = query.trim().length > 0;

  return (
    <View style={styles.root}>
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
            <NoticeBell />
          </View>
          <Text style={styles.subtitle}>Lineups ranked by your sound.</Text>
          <View style={styles.searchWrap}>
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Find an artist"
              label="Find an artist at any festival"
            />
          </View>
        </View>
        {searching ? (
          <View style={styles.results}>
            {found.length === 0 ? (
              <Text style={styles.noMatch}>No artist matches “{query.trim()}”.</Text>
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
          </View>
        ) : (
          <>
            {groups.going.length > 0 && <Text style={styles.section}>Going</Text>}
            {groups.going.map((f) => (
              <FestivalCard key={f.id} festival={f} taste={taste} />
            ))}
            {groups.going.length > 0 && groups.others.length > 0 && <Text style={styles.section}>More festivals</Text>}
            {groups.others.map((f) => (
              <FestivalCard key={f.id} festival={f} taste={taste} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
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
            {festival.dates}, {festival.location}
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
            accessibilityLabel={`Discover the lineup, ${reach.clips} ${reach.clips === 1 ? 'clip' : 'clips'}`}
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
