import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { BarsIcon, ChevronIcon } from '../../components/TabIcons';
import { ArtistSheet } from '../../features/sound-map/ArtistSheet';
import { SaveIcon } from '../../features/discover/icons';
import { yourClipCount, yourClips } from '../../features/discover/saved';
import { EVERYONE } from '../../features/sound-map/scope';
import { lineupDays, playsOn } from '../../features/festivals/days';
import { leftToRate } from '../../features/festivals/tune';
import { artistsOnMap, mapCandidates, SPARSE_MAP } from '../../features/sound-map/layout';
import { SoundMap } from '../../features/sound-map/SoundMap';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useRatings } from '../../state/ratings';
import { useReactions } from '../../state/reactions';
import { useSeen } from '../../state/seen';
import { useTaste } from '../../state/taste';
import { useWeekends } from '../../state/weekends';
import { color, radius, space, type } from '../../theme/tokens';
import { SOUND_LABEL, type SoundTag } from '../../data/models';
import type { Festival } from '../../data/types';
import type { TasteSummary } from '../../features/taste/engine';
import { soundLean } from '../../features/taste/lean';

const HEADER_H = 96;
/** The row of festival chips under the subtitle. */
const SCOPE_H = 44;

export default function MySoundScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const tabSpace = useTabBarSpace();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The map shows the taste you last saw, then reshapes a beat after you
  // arrive, so you can watch what your likes, skips and viewing changed.
  const catalog = useCatalog();
  const { artists, festivals } = catalog;
  const live = useTaste();
  const liveRef = useRef(live);
  liveRef.current = live;
  const [shown, setShown] = useState(live);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  const reshapeSoon = useCallback(() => {
    const t = setTimeout(() => {
      if (shownRef.current.taste === liveRef.current.taste) return;
      haptic.settle();
      setShown(liveRef.current);
    }, 450);
    return () => clearTimeout(t);
  }, []);
  useFocusEffect(reshapeSoon);

  // Everyone, or one festival's lineup: your sound at that festival. A festival page can open it (`festival` param).
  const [scopeId, setScopeId] = useState<string | undefined>();
  // One day of that festival's lineup, when the poster or set times say who plays when.
  const [day, setDay] = useState<string | undefined>();
  const { festival: festivalParam } = useLocalSearchParams<{ festival?: string }>();
  const navigation = useNavigation();
  // `everyone` (from the scope picker) goes back to the whole map; a festival id narrows it.
  const asked = festivalParam === EVERYONE ? EVERYONE : festivalParam && catalog.festival(festivalParam) ? festivalParam : undefined;
  const [lastAsked, setLastAsked] = useState<string | undefined>();
  if (asked && asked !== lastAsked) {
    setLastAsked(asked);
    setScopeId(asked === EVERYONE ? undefined : asked);
    setDay(undefined);
    setSelectedId(null);
  }
  if (!festivalParam && lastAsked) setLastAsked(undefined);
  useEffect(() => {
    if (festivalParam) navigation.setParams({ festival: '' } as never);
  }, [festivalParam, navigation]);
  // The festival as it is for you: for one run over several weekends, only your weekend's acts.
  const { forYou } = useWeekends();
  const scopeWhole = scopeId ? catalog.festival(scopeId) : undefined;
  const scope = useMemo(() => scopeWhole && forYou(scopeWhole), [scopeWhole, forYou]);
  const scopeDays = useMemo(() => (scope ? lineupDays(scope) : []), [scope]);
  const dayOn = scope && day && scopeDays.includes(day) ? day : undefined;

  // Who's on the map: artists the app knows something about, best matches first (see artistsOnMap).
  const onMap = useMemo(
    () =>
      artistsOnMap(
        mapCandidates(artists, scope ? scope.lineup.filter((id) => playsOn(scope, id, dayOn)) : undefined),
        shown.taste,
        shown.informed,
      ),
    [artists, scope, dayOn, shown],
  );

  // Closing the sheet lets the map catch up with anything you rated in it.
  // Which sounds you lean towards, across everyone (not just the festival in view).
  const lean = useMemo(() => soundLean(artists, shown.taste, shown.informed), [artists, shown]);

  const close = useCallback(() => {
    setSelectedId(null);
    reshapeSoon();
  }, [reshapeSoon]);
  const pickDay = useCallback((d: string | undefined) => {
    setSelectedId(null);
    setDay(d);
  }, []);
  const hasScopes = festivals.length > 0;
  const mapTop = insets.top + HEADER_H + (hasScopes ? SCOPE_H : 0);
  const mapHeight = height - mapTop - tabSpace;

  return (
    <View style={styles.root}>
      <NightSky />

      <View style={{ position: 'absolute', top: mapTop, left: 0 }}>
        {/* A new scope draws a fresh map: fitted and centred, its bubbles blooming in. */}
        <SoundMap
          key={`${scope?.id ?? 'everyone'}:${dayOn ?? 'all'}`}
          artists={onMap}
          taste={shown.taste}
          width={width}
          height={mapHeight}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onBackgroundTap={close}
        />
      </View>

      {scope && onMap.length < SPARSE_MAP && <SparseNote festival={scope} shown={onMap.length} bottom={tabSpace + space.lg} />}

      <View style={[styles.header, { paddingTop: insets.top + space.lg }]} pointerEvents="box-none">
        <View style={styles.titleRow} pointerEvents="box-none">
          <Text style={styles.title} pointerEvents="none">
            My Sound
          </Text>
          <View style={styles.actions} pointerEvents="box-none">
            <SavedPill />
            {hasSignal(live.summary, live.rated) && <StartOver onCleared={reshapeSoon} />}
          </View>
        </View>
        <Text style={styles.subtitle} pointerEvents="none">
          {subtitle(shown.summary, shown.rated, lean)}
        </Text>
        {hasScopes && <ScopeRow scope={scope} days={scopeDays} day={dayOn} onDay={pickDay} />}
      </View>

      {/* The sheet shows the live match, so a rating there shows its effect straight away. */}
      <ArtistSheet artistId={selectedId} taste={live.taste} bottomInset={tabSpace} onClose={close} />
    </View>
  );
}

/**
 * Under the subtitle: your sound as a breakdown, which lineup the map shows
 * (everyone, or one festival; opens a picker), and that festival's days.
 */
function ScopeRow({
  scope,
  days,
  day,
  onDay,
}: {
  scope: Festival | undefined;
  days: string[];
  day: string | undefined;
  onDay: (d: string | undefined) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsWrap} contentContainerStyle={styles.chips}>
      {/* Your sound (in this scope) as a breakdown of sounds. */}
      <Pressable
        onPress={() => {
          haptic.select();
          router.push({ pathname: '/your-sound', params: scope ? { festival: scope.id } : {} });
        }}
        accessibilityRole="button"
        accessibilityLabel={scope ? `Your sound at ${scope.name}, as a breakdown` : 'Your sound, as a breakdown'}
        style={({ pressed }) => [styles.chip, styles.breakdown, pressed && { opacity: 0.75 }]}
      >
        <BarsIcon color={color.glow} size={12} />
        <Text style={[styles.chipText, { color: color.moon }]}>Breakdown</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          haptic.select();
          router.push({ pathname: '/sound-scope', params: scope ? { current: scope.id } : {} });
        }}
        accessibilityRole="button"
        accessibilityLabel={`${scope ? `Your sound at ${scope.name}` : 'Your sound across every artist'}. Choose a festival`}
        style={({ pressed }) => [styles.chip, styles.chipOn, styles.scopePill, pressed && { opacity: 0.75 }]}
      >
        <Text style={[styles.chipText, { color: color.moon }]} numberOfLines={1}>
          {scope ? scope.name : 'Everyone'}
        </Text>
        <ChevronIcon color={color.moonDim} size={11} direction="down" />
      </Pressable>
      {days.length > 0 && scope && (
        <>
          <View style={styles.chipDivider} />
          {[undefined, ...days].map((d) => {
            const on = d === day;
            return (
              <Pressable
                key={d ?? 'all'}
                onPress={() => {
                  if (on) return;
                  haptic.select();
                  onDay(d);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={d ? `Only ${d} at ${scope.name}` : `Every day at ${scope.name}`}
                style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.75 }]}
              >
                <Text style={[styles.chipText, on && { color: color.moon }]}>{d ?? 'All days'}</Text>
              </Pressable>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

/** A festival's map with only a few artists on it so far: say so, and offer the quickest way to add more. */
function SparseNote({ festival, shown, bottom }: { festival: Festival; shown: number; bottom: number }) {
  const catalog = useCatalog();
  const { ratings } = useRatings();
  const toRate = leftToRate(festival, ratings, (a) => !!catalog.artist(a));
  const total = festival.lineup.filter((a) => catalog.artist(a)).length;
  return (
    <View style={[styles.sparse, { bottom }]} pointerEvents="box-none">
      <Text style={styles.sparseText}>
        {shown === 0
          ? `None of ${festival.name}’s ${total} artists are on your map yet.`
          : `Only ${shown} of ${festival.name}’s ${total} artists ${shown === 1 ? 'is' : 'are'} on your map so far.`}{' '}
        {toRate > 0 ? 'Rate the lineup to place the rest.' : 'React to clips from the lineup to place more.'}
      </Text>
      {toRate > 0 && (
        <Pressable
          onPress={() => {
            haptic.tap();
            router.push(`/tune/${festival.id}`);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Tune your lineup. Rate ${toRate} artists one at a time.`}
          style={({ pressed }) => [styles.sparseButton, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.sparseButtonText}>Tune your lineup</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Opens your clips (saved and liked). Only there once you have one. */
function SavedPill() {
  const { clips } = useCatalog();
  const { reactions } = useReactions();
  const count = yourClipCount(yourClips(clips, reactions));
  if (count === 0) return null;
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push('/saved');
      }}
      accessibilityRole="button"
      accessibilityLabel={`Your clips, ${count}`}
      hitSlop={10}
      style={({ pressed }) => [styles.pill, styles.savedPill, pressed && { opacity: 0.7 }]}
    >
      <SaveIcon color={color.glow} filled size={13} />
      <Text style={styles.savedCount}>{count}</Text>
    </Pressable>
  );
}

const hasSignal = ({ likes, saves, skips, watched }: TasteSummary, rated: number) =>
  likes + saves + skips + watched + rated > 0;

/**
 * Clear everything your sound has learned (likes, saves, skips, watching,
 * ratings) and the feed's viewing history. Plans stay: festivals you're going
 * to and starred sets are yours, not your taste.
 */
function StartOver({ onCleared }: { onCleared: () => void }) {
  const reactions = useReactions();
  const ratings = useRatings();
  const seen = useSeen();
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        Alert.alert(
          'Start your sound over?',
          'This clears your likes, saves, skips, watched clips and artist ratings. Festivals you’re going to and your starred sets stay.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Start over',
              style: 'destructive',
              onPress: () => {
                reactions.clear();
                ratings.clear();
                seen.clear();
                // The map reshapes to the starting sound a beat later, as when you come back to it.
                onCleared();
              },
            },
          ],
        );
      }}
      accessibilityRole="button"
      accessibilityLabel="Start your sound over"
      hitSlop={10}
      style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.startOverText}>Start over</Text>
    </Pressable>
  );
}

function subtitle(summary: TasteSummary, rated: number, lean: SoundTag[]) {
  const { likes, saves, skips, watched } = summary;
  if (!hasSignal(summary, rated)) return 'Bigger means a closer match. Similar sounds sit together.';
  const parts = [
    likes && `${likes} ${likes === 1 ? 'like' : 'likes'}`,
    saves && `${saves} ${saves === 1 ? 'save' : 'saves'}`,
    skips && `${skips} ${skips === 1 ? 'skip' : 'skips'}`,
    watched && `${watched} watched ${watched === 1 ? 'clip' : 'clips'}`,
    rated && `${rated} rated ${rated === 1 ? 'artist' : 'artists'}`,
  ].filter(Boolean) as string[];
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  const leaning = lean.map((t) => SOUND_LABEL[t].toLowerCase()).join(' and ');
  return `Shaped by your ${list}. ${leaning ? `Leaning ${leaning}.` : 'Bigger means a closer match.'}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  header: { paddingHorizontal: space.xl },
  chipsWrap: { marginTop: space.md, marginHorizontal: -space.xl, flexGrow: 0 },
  chips: { paddingHorizontal: space.xl, gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  chipOn: { backgroundColor: 'rgba(169,124,255,0.22)', borderColor: 'rgba(169,124,255,0.45)' },
  scopePill: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 220 },
  chipDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 6, backgroundColor: color.hairline },
  breakdown: { flexDirection: 'row', alignItems: 'center', gap: 6, borderColor: 'rgba(169,124,255,0.45)', marginRight: space.sm },
  chipText: { ...type.caption, color: color.moonDim },
  sparse: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(18,16,38,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  sparseText: { ...type.body, color: color.moonDim },
  sparseButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(169,124,255,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.4)',
  },
  sparseButtonText: { ...type.label, color: color.moon },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...type.largeTitle, color: color.moon },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pill: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  startOverText: { ...type.caption, color: color.moonDim },
  savedPill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  savedCount: { ...type.caption, color: color.moon, fontVariant: ['tabular-nums'] },
  subtitle: { ...type.body, color: color.moonDim, marginTop: space.xs },
});
