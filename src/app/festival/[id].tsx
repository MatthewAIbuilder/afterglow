import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistRow } from '../../components/ArtistRow';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { NightSky } from '../../components/NightSky';
import { CheckIcon, ChevronIcon, CloseIcon, SearchIcon } from '../../components/TabIcons';
import { setFor } from '../../data/festival';
import { SOUND_LABEL, type SoundTag } from '../../data/models';
import type { Artist, Festival } from '../../data/types';
import { HeartIcon, PlayIcon } from '../../features/discover/icons';
import { describeSet } from '../../features/festivals/format';
import { lineupReach } from '../../features/festivals/links';
import { filterLineup, lineupSounds, SEARCH_FROM } from '../../features/festivals/search';
import { countdown, setLine } from '../../features/festivals/when';
import { useToday } from '../../lib/useToday';
import { leftToRate } from '../../features/festivals/tune';
import { YourFestival } from '../../features/plan/YourFestival';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useGoing } from '../../state/going';
import { useRatings } from '../../state/ratings';
import { useTaste } from '../../state/taste';
import { color, radius, space, type } from '../../theme/tokens';

type Order = 'match' | 'billing';

export default function FestivalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const catalog = useCatalog();
  const festival = catalog.festival(id);
  const insets = useSafeAreaInsets();
  const { taste } = useTaste();
  const [order, setOrder] = useState<Order>('match');
  const [query, setQuery] = useState('');
  const { ratings } = useRatings();
  const today = useToday();

  const lineup = useMemo(() => {
    if (!festival) return [];
    const list = festival.lineup.map((a) => catalog.artist(a)).filter((a): a is Artist => !!a);
    return order === 'match' ? [...list].sort((a, b) => (taste[b.id] ?? 0) - (taste[a.id] ?? 0)) : list;
  }, [catalog, festival, order, taste]);
  const [picked, setPicked] = useState<SoundTag | undefined>();
  const sounds = useMemo(() => (lineup.length > SEARCH_FROM ? lineupSounds(lineup) : []), [lineup]);
  // Only filter by a sound this lineup actually offers.
  const sound = sounds.length > 1 && sounds.some((s) => s.tag === picked) ? picked : undefined;
  const shown = useMemo(() => filterLineup(lineup, query, sound), [lineup, query, sound]);

  if (!festival) return null;
  const timesOut = !!festival.sets?.length;
  const soon = countdown(festival, today);
  const reach = lineupReach(festival, catalog.clips);
  const toRate = leftToRate(festival, ratings, (a) => !!catalog.artist(a));

  return (
    <View style={styles.root}>
      <NightSky />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.pad}>
          <Text style={styles.title}>{festival.name}</Text>
          <Text style={styles.meta}>
            {festival.dates}, {festival.location}
          </Text>
          {soon ? <Text style={styles.soon}>{soon}</Text> : null}
          <View style={styles.pills}>
            <GoingPill festival={festival} />
            {reach.clips > 0 && (
              <Pressable
                onPress={() => {
                  haptic.tap();
                  router.navigate({ pathname: '/', params: { festival: festival.id } });
                }}
                accessibilityRole="button"
                accessibilityLabel={`Discover the lineup. ${reach.clips} live clips from ${reach.artists} artists playing ${festival.name}.`}
                style={({ pressed }) => [styles.discover, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
              >
                <PlayIcon color={color.moon} size={14} />
                <Text style={styles.discoverText}>Discover the lineup</Text>
                <Text style={styles.discoverCount}>
                  {reach.clips} {reach.clips === 1 ? 'clip' : 'clips'}
                </Text>
              </Pressable>
            )}
            {toRate > 0 && (
              <Pressable
                onPress={() => {
                  haptic.tap();
                  router.push(`/tune/${festival.id}`);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Tune your lineup. Rate ${toRate} artists one at a time.`}
                style={({ pressed }) => [styles.discover, styles.tune, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
              >
                <HeartIcon color={color.moon} size={14} />
                <Text style={styles.discoverText}>Tune your lineup</Text>
                <Text style={styles.discoverCount}>{toRate} to rate</Text>
              </Pressable>
            )}
          </View>
        </View>

        {festival.posterImageUrl ? (
          <Pressable
            onPress={() => {
              haptic.select();
              router.push(`/poster/${festival.id}`);
            }}
            accessibilityRole="imagebutton"
            accessibilityLabel="Official lineup poster. Opens full screen."
            style={styles.posterWrap}
          >
            <Image source={{ uri: festival.posterImageUrl }} style={styles.poster} contentFit="cover" transition={250} />
            <View style={styles.posterHint}>
              <Text style={styles.posterHintText}>View poster</Text>
              <ChevronIcon color={color.moon} size={12} />
            </View>
          </Pressable>
        ) : null}

        <View style={[styles.pad, styles.note]}>
          {timesOut ? (
            <>
              <Text style={styles.noteTitle}>Set times are out</Text>
              <Text style={styles.noteBody}>Your plan below is laid out day by day, with any clashes called out.</Text>
            </>
          ) : (
            <>
              <Text style={styles.noteTitle}>Set times aren’t out yet</Text>
              <Text style={styles.noteBody}>
                Festivals usually publish them a week or two before the gates open. Until then, here’s who to put
                first.
              </Text>
            </>
          )}
        </View>

        <YourFestival festival={festival} />

        <View style={[styles.pad, styles.lineupHead]}>
          <Text style={styles.section}>Full lineup</Text>
          <Segmented value={order} onChange={setOrder} />
        </View>

        {lineup.length > SEARCH_FROM && (
          <View style={[styles.pad, styles.searchWrap]}>
            <View style={styles.search}>
              <SearchIcon color={color.moonFaint} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Find an artist"
                placeholderTextColor={color.moonFaint}
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="never"
                keyboardAppearance="dark"
                selectionColor={color.glow}
                accessibilityLabel={`Find an artist on the ${festival.name} lineup`}
              />
              {query ? (
                <Pressable
                  onPress={() => setQuery('')}
                  accessibilityRole="button"
                  accessibilityLabel="Clear the search"
                  hitSlop={10}
                >
                  <CloseIcon color={color.moonDim} size={14} />
                </Pressable>
              ) : null}
            </View>
          </View>
        )}

        {sounds.length > 1 && (
          <SoundChips festivalName={festival.name} sounds={sounds} value={sound} onChange={setPicked} />
        )}

        <View style={styles.pad}>
          {query && shown.length === 0 ? (
            <Text style={styles.noMatch}>
              {sound
                ? `No ${SOUND_LABEL[sound].toLowerCase()} artist on the lineup matches “${query.trim()}”.`
                : `No one on the lineup matches “${query.trim()}”.`}
            </Text>
          ) : null}
          {shown.map((a) => {
            const set = setFor(festival, a.id);
            return (
              <ArtistRow
                key={a.id}
                festivalId={festival.id}
                artist={a}
                affinity={taste[a.id] ?? 0}
                detail={setLine(set && describeSet(festival, set), festival.notes?.[a.id])}
                rating={ratings[a.id]}
              />
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label="Back" onPress={() => router.back()}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
    </View>
  );
}

/** "I'm going" / "Going": puts the festival at the top of your Festivals tab. */
function GoingPill({ festival }: { festival: Festival }) {
  const { isGoing, toggle } = useGoing();
  const going = isGoing(festival.id);
  return (
    <Pressable
      onPress={() => {
        if (going) haptic.select();
        else haptic.tap();
        toggle(festival.id);
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: going }}
      accessibilityLabel={going ? `You're going to ${festival.name}. Tap to undo.` : `I'm going to ${festival.name}`}
      style={({ pressed }) => [
        styles.discover,
        going ? styles.goingOn : styles.tune,
        pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
      ]}
    >
      <CheckIcon color={going ? color.moon : color.moonDim} size={14} />
      <Text style={[styles.discoverText, !going && { color: color.moonDim }]}>{going ? 'Going' : 'I’m going'}</Text>
    </Pressable>
  );
}

/** Narrow a big lineup to one sound. Tapping the chosen sound again shows everyone. */
function SoundChips({
  festivalName,
  sounds,
  value,
  onChange,
}: {
  festivalName: string;
  sounds: { tag: SoundTag; count: number }[];
  value: SoundTag | undefined;
  onChange: (tag: SoundTag | undefined) => void;
}) {
  const chips: { tag: SoundTag | undefined; label: string; count?: number }[] = [
    { tag: undefined, label: 'All sounds' },
    ...sounds.map((s) => ({ tag: s.tag, label: SOUND_LABEL[s.tag], count: s.count })),
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
      style={styles.chipsWrap}
      keyboardShouldPersistTaps="handled"
    >
      {chips.map((c) => {
        const on = c.tag === value;
        return (
          <Pressable
            key={c.tag ?? 'all'}
            onPress={() => {
              haptic.select();
              onChange(on ? undefined : c.tag);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={
              c.tag ? `${c.label}, ${c.count} artists on the ${festivalName} lineup` : `All sounds on the ${festivalName} lineup`
            }
            style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.75 }]}
          >
            <Text style={[styles.chipText, on && { color: color.moon }]}>{c.label}</Text>
            {c.count !== undefined ? <Text style={styles.chipCount}>{c.count}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Segmented({ value, onChange }: { value: Order; onChange: (o: Order) => void }) {
  const options: { key: Order; label: string }[] = [
    { key: 'match', label: 'For you' },
    { key: 'billing', label: 'Billing' },
  ];
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (on) return;
              haptic.select();
              onChange(o.key);
            }}
            style={[styles.segItem, on && styles.segOn]}
          >
            <Text style={[styles.segText, on && { color: color.moon }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  pad: { paddingHorizontal: space.xl },
  back: { position: 'absolute', left: space.lg },
  title: { ...type.largeTitle, color: color.moon },
  meta: { ...type.body, color: color.moonDim, marginTop: space.xs },
  soon: { ...type.label, color: color.glow, marginTop: space.xs, fontVariant: ['tabular-nums'] },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },
  discover: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.sm,
    paddingLeft: space.md,
    paddingRight: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(169,124,255,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.4)',
  },
  tune: { backgroundColor: color.glass, borderColor: color.hairline },
  goingOn: { backgroundColor: 'rgba(169,124,255,0.32)', borderColor: 'rgba(169,124,255,0.55)' },
  discoverText: { ...type.label, color: color.moon },
  discoverCount: { ...type.caption, color: color.moonDim, fontVariant: ['tabular-nums'] },
  posterWrap: {
    marginHorizontal: space.lg,
    marginTop: space.xl,
    borderRadius: radius.lg,
    overflow: 'hidden',
    aspectRatio: 4 / 5,
    backgroundColor: color.glass,
  },
  poster: { width: '100%', height: '100%' },
  posterHint: {
    position: 'absolute',
    right: space.md,
    bottom: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10,9,24,0.6)',
  },
  posterHintText: { ...type.caption, color: color.moon },
  note: { marginTop: space.xl },
  noteTitle: { ...type.headline, color: color.moon },
  noteBody: { ...type.body, color: color.moonDim, marginTop: space.xs },
  searchWrap: { marginBottom: space.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  searchInput: { ...type.body, flex: 1, color: color.moon, paddingVertical: 0 },
  chipsWrap: { marginBottom: space.sm, flexGrow: 0 },
  chips: { paddingHorizontal: space.xl, gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  chipOn: { backgroundColor: 'rgba(169,124,255,0.22)', borderColor: 'rgba(169,124,255,0.45)' },
  chipText: { ...type.caption, color: color.moonDim },
  chipCount: { ...type.caption, color: color.moonFaint, fontVariant: ['tabular-nums'] },
  noMatch: { ...type.body, color: color.moonDim, paddingVertical: space.lg },
  lineupHead: { marginTop: space.xxl, marginBottom: space.sm, flexDirection: 'row', alignItems: 'center' },
  section: { ...type.title, fontSize: 22, color: color.moon, flex: 1 },
  segment: { flexDirection: 'row', padding: 3, borderRadius: radius.pill, backgroundColor: color.glass },
  segItem: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill },
  segOn: { backgroundColor: 'rgba(169,124,255,0.22)' },
  segText: { ...type.caption, color: color.moonDim },
});
