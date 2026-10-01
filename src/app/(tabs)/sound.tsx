import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { PageTitle } from '../../components/PageTitle';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { BarsIcon, ChevronIcon, SearchIcon } from '../../components/TabIcons';
import { SearchField } from '../../components/SearchField';
import { extraMatches, type MapSearch, mapSearch } from '../../features/sound-map/search';
import { ArtistSheet } from '../../features/sound-map/ArtistSheet';
import { SaveIcon } from '../../features/discover/icons';
import { yourClipCount, yourClips } from '../../features/discover/saved';
import { EVERYONE } from '../../features/sound-map/scope';
import { soundChoices, soundFocus } from '../../features/discover/focus';
import { lineupDays, playsOn } from '../../features/festivals/days';
import { leftToRate } from '../../features/festivals/tune';
import { artistsOnMap, mapCandidates, SPARSE_MAP } from '../../features/sound-map/layout';
import { SoundMap } from '../../features/sound-map/SoundMap';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useClipPool } from '../../state/community';
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
import { musicNote, type MusicNote } from '../../features/music/copy';
import { PROVIDER_NAME, type MusicProviderId } from '../../features/music/models';
import { useMusic } from '../../state/music';
import { showAlert } from '../../lib/dialog';

const HEADER_H = 96;
/** The row of festival chips under the subtitle. */
const SCOPE_H = 44;
/** How far the header's scrim fades out over the top of the map. */
const SCRIM_FADE = 36;

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
  const candidates = useMemo(
    () => mapCandidates(artists, scope ? scope.lineup.filter((id) => playsOn(scope, id, dayOn)) : undefined),
    [artists, scope, dayOn],
  );
  const known = useMemo(() => artistsOnMap(candidates, shown.taste, shown.informed), [candidates, shown]);

  // Searching the map: an artist or a sound. Matches pop; ones not on the map yet join it.
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Opened by tapping a sound name around the map: no keyboard, just that sound lit up.
  const [typing, setTyping] = useState(true);
  const showSound = useCallback((tag: SoundTag) => {
    setSelectedId(null);
    setTyping(false);
    setQuery(SOUND_LABEL[tag]);
    setSearchOpen(true);
  }, []);
  const search = useMemo(() => (searchOpen ? mapSearch(candidates, query) : undefined), [searchOpen, candidates, query]);
  const extra = useMemo(
    () => (search ? extraMatches(candidates, known, search, shown.taste) : []),
    [search, candidates, known, shown],
  );
  const onMap = useMemo(() => (extra.length ? [...known, ...extra] : known), [known, extra]);
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery('');
    setTyping(true);
  }, []);

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
  // Connected music: reading, failed, a small library, or an offer to connect. Your own signal here quiets the offer.
  const music = useMusic();
  const note = useMemo(
    () =>
      musicNote({
        state: music.state,
        availability: music.availability,
        matched: music.imported.matched,
        ownSignal: hasSignal(live.summary, live.rated),
      }),
    [music.state, music.availability, music.imported.matched, live.summary, live.rated],
  );
  const sparse = !search && !!scope && onMap.length < SPARSE_MAP;
  const hasScopes = festivals.length > 0;
  const mapTop = insets.top + HEADER_H + (hasScopes ? SCOPE_H : 0);
  const mapHeight = height - mapTop - tabSpace;

  return (
    <View style={styles.root}>
      <PageTitle title="My Sound" />
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
          onRegionTap={showSound}
          matchIds={search?.ids}
        />
      </View>

      {/* And a soft fade at the bottom, under the tab bar. */}
      <LinearGradient
        colors={['rgba(10,9,24,0)', 'rgba(10,9,24,0.85)', 'rgba(10,9,24,0.97)']}
        locations={[0, 0.55, 1]}
        style={[styles.bottomScrim, { height: tabSpace + SCRIM_FADE }]}
        pointerEvents="none"
      />

      {search ? (
        <SearchNote search={search} query={query} extra={extra.length} bottom={tabSpace + space.lg} />
      ) : null}
      {sparse && scope && <SparseNote festival={scope} shown={onMap.length} bottom={tabSpace + space.lg} />}
      {!search && !sparse && note && <MusicNoteView note={note} bottom={tabSpace + space.lg} />}

      {/* A soft scrim under the header: bubbles glide beneath it rather than being cut off. */}
      <LinearGradient
        colors={['rgba(10,9,24,0.97)', 'rgba(10,9,24,0.93)', 'rgba(10,9,24,0)']}
        locations={[0, (mapTop - space.sm) / (mapTop + SCRIM_FADE), 1]}
        style={[styles.scrim, { height: mapTop + SCRIM_FADE }]}
        pointerEvents="none"
      />

      <View style={[styles.header, { paddingTop: insets.top + space.lg }]} pointerEvents="box-none">
        <View style={styles.titleRow} pointerEvents="box-none">
          <Text style={styles.title} pointerEvents="none">
            My Sound
          </Text>
          <View style={styles.actions} pointerEvents="box-none">
            <SavedPill />
            {hasSignal(live.summary, live.rated) ? (
              <StartOver onCleared={reshapeSoon} />
            ) : (
              // Nothing of yours yet: the quickest way to a real map.
              <Pressable
                onPress={() => {
                  haptic.tap();
                  router.push(scope ? { pathname: '/pick-artists', params: { festivals: scope.id } } : '/pick-artists');
                }}
                accessibilityRole="button"
                accessibilityLabel="Pick artists you know"
                hitSlop={10}
                style={({ pressed }) => [styles.pill, styles.pickPill, pressed && { opacity: 0.7 }]}
              >
                <Text style={[styles.startOverText, { color: color.moon }]}>Pick artists</Text>
              </Pressable>
            )}
          </View>
        </View>
        <Text style={styles.subtitle} pointerEvents="none">
          {subtitle(shown.summary, shown.rated, lean, shown.importing)}
        </Text>
        {searchOpen ? (
          <View style={styles.searchRow}>
            <View style={{ flex: 1 }}>
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder="Artist or sound, like dubstep"
                label="Search your map for an artist or a sound"
                autoFocus={typing}
              />
            </View>
            <Pressable onPress={closeSearch} accessibilityRole="button" accessibilityLabel="Done searching" hitSlop={8}>
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>
        ) : hasScopes ? (
          <ScopeRow scope={scope} days={scopeDays} day={dayOn} onDay={pickDay} onSearch={() => setSearchOpen(true)} />
        ) : null}
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
  onSearch,
}: {
  scope: Festival | undefined;
  days: string[];
  day: string | undefined;
  onDay: (d: string | undefined) => void;
  onSearch: () => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsWrap} contentContainerStyle={styles.chips}>
      <Pressable
        onPress={() => {
          haptic.select();
          onSearch();
        }}
        accessibilityRole="button"
        accessibilityLabel="Search your map for an artist or a sound"
        style={({ pressed }) => [styles.chip, styles.searchChip, pressed && { opacity: 0.75 }]}
      >
        <SearchIcon color={color.moon} size={13} />
      </Pressable>
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

/** While searching: what lit up, in a quiet glass note above the tab bar; for one sound, a way to watch it in Discover. */
function SearchNote({ search, query, extra, bottom }: { search: MapSearch; query: string; extra: number; bottom: number }) {
  const catalog = useCatalog();
  const n = search.ids.size;
  const tag = search.sounds.length === 1 ? search.sounds[0] : undefined;
  const sound = tag ? SOUND_LABEL[tag].toLowerCase() : undefined;
  const watchable = !!tag && soundChoices(catalog.clips, catalog.artist).some((c) => c.tag === tag);
  const text =
    n === 0
      ? `No artist or sound matches “${query.trim()}”.`
      : `${n} ${sound ? `${sound} ` : ''}${n === 1 ? 'artist' : 'artists'}${extra ? `, ${extra} new to your map` : ''}. Tap one to see more.`;
  return (
    <View style={[styles.sparse, { bottom }]} pointerEvents="box-none" accessibilityLiveRegion="polite">
      <Text style={styles.sparseText}>{text}</Text>
      {watchable && tag && n > 0 ? (
        <Pressable
          onPress={() => {
            haptic.tap();
            router.navigate({ pathname: '/', params: { festival: soundFocus(tag) } });
          }}
          accessibilityRole="button"
          accessibilityLabel={`Watch ${sound} live sets in Discover`}
          style={({ pressed }) => [styles.sparseButton, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.sparseButtonText}>Watch {sound}</Text>
        </Pressable>
      ) : null}
    </View>
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

/** Connected music on the map: what's happening with it, and the way to Music connections when that helps. */
function MusicNoteView({ note, bottom }: { note: MusicNote; bottom: number }) {
  return (
    <View style={[styles.sparse, { bottom }]} pointerEvents="box-none" accessibilityLiveRegion="polite">
      <Text style={styles.sparseText}>{note.text}</Text>
      {note.action && (
        <Pressable
          onPress={() => {
            haptic.tap();
            router.push('/music');
          }}
          accessibilityRole="button"
          accessibilityLabel={note.action === 'connect' ? 'Connect your music' : 'Open music connections'}
          style={({ pressed }) => [styles.sparseButton, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.sparseButtonText}>{note.action === 'connect' ? 'Connect music' : 'Music connections'}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Opens your clips (saved and liked). Only there once you have one. */
function SavedPill() {
  const { clips } = useClipPool();
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
  // Connected music is a connection, not something you did here: it stays, and says where to remove it.
  const { importing } = useMusic();
  const music = importing.length
    ? ` Your ${importing.map((p) => PROVIDER_NAME[p]).join(' and ')} library stays connected (remove it in Music connections).`
    : '';
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        showAlert(
          'Start your sound over?',
          `This clears your likes, saves, skips, watched clips and artist ratings. Festivals you’re going to and your starred sets stay.${music}`,
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

function subtitle(summary: TasteSummary, rated: number, lean: SoundTag[], importing: MusicProviderId[]) {
  const { likes, saves, skips, watched } = summary;
  if (!hasSignal(summary, rated) && !importing.length) return 'Bigger means a closer match. Similar sounds sit together.';
  const parts = [
    importing.length > 0 && `${importing.map((p) => PROVIDER_NAME[p]).join(' and ')} ${importing.length === 1 ? 'library' : 'libraries'}`,
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
  scrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  pickPill: { borderColor: 'rgba(169,124,255,0.45)', backgroundColor: 'rgba(169,124,255,0.14)' },
  bottomScrim: { position: 'absolute', bottom: 0, left: 0, right: 0 },
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
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xs },
  done: { ...type.headline, color: color.glow },
  searchChip: { paddingHorizontal: space.md, justifyContent: 'center' },
  scopePill: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 220 },
  chipDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 6, backgroundColor: color.hairline },
  breakdown: { flexDirection: 'row', alignItems: 'center', gap: 6, borderColor: 'rgba(169,124,255,0.45)' },
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
