import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { PageTitle } from '../../components/PageTitle';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { ChevronIcon, LocateIcon, MoreIcon, SearchIcon } from '../../components/TabIcons';
import { SearchField } from '../../components/SearchField';
import { extraMatches, type MapSearch, mapSearch } from '../../features/sound-map/search';
import { ArtistSheet } from '../../features/sound-map/ArtistSheet';
import { yourClipCount, yourClips } from '../../features/discover/saved';
import { basisLine, EVERYONE, leanLine, mapLenses } from '../../features/sound-map/scope';
import { useGoing } from '../../state/going';
import { useToday } from '../../lib/useToday';
import { SOUND_COLOR } from '../../features/sound-map/colors';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { soundChoices, soundFocus } from '../../features/discover/focus';
import { lineupDays, playsOn } from '../../features/festivals/days';
import { leftToRate } from '../../features/festivals/tune';
import { artistsOnMap, mapCandidates, SPARSE_MAP } from '../../features/sound-map/layout';
import { SoundMap } from '../../features/sound-map/SoundMap';
import { haptic } from '../../lib/haptics';
import { bumpQuestEvent } from '../../state/dailyQuests';
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
import { soundLean, tasteMix } from '../../features/taste/lean';
import { isWarm } from '../../features/taste/ratings';
import { SoundSpectrum } from '../../features/sound-map/SoundSpectrum';
import { musicNote, type MusicNote } from '../../features/music/copy';
import { PROVIDER_NAME } from '../../features/music/models';
import { useMusic } from '../../state/music';
import { showActionSheet, showAlert } from '../../lib/dialog';
import { GlassCircleButton } from '../../components/GlassCircleButton';

/** Where the header ends before it has been measured (it's measured on layout). */
const HEADER_GUESS = 210;
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
  const [shown, setShown] = useState(live);
  const shownRef = useRef(shown);
  // The latest of both, for the reshape timer (kept after each render, never during it).
  useEffect(() => {
    liveRef.current = live;
    shownRef.current = shown;
  }, [live, shown]);

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
  // Your sound as one line of colour, for whoever the map shows (the same pull as the breakdown).
  const mix = useMemo(() => tasteMix(candidates, shown.taste, shown.informed), [candidates, shown]);
  // Artists you love or like wear a small heart on the map.
  const { ratings: rated } = useRatings();
  const loved = useMemo(() => new Set(Object.keys(rated).filter((id) => isWarm(rated[id]))), [rated]);

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
  const shaped = hasSignal(live.summary, live.rated) || live.importing.length > 0;
  // A newcomer's quickest way to a real map, at the bottom (after search and the sparse note).
  const newcomer = !search && !sparse && !shaped;
  // The festival choices above the map: all artists, the festivals you're going to, the one shown.
  const { going } = useGoing();
  const today = useToday();
  const lenses = useMemo(() => mapLenses(festivals, going, scope?.id, today), [festivals, going, scope?.id, today]);
  const pickLens = useCallback((id: string | undefined) => {
    setSelectedId(null);
    setScopeId(id);
    setDay(undefined);
  }, []);
  // The header is measured, so the map starts right under it whatever it holds.
  const [headerH, setHeaderH] = useState(insets.top + HEADER_GUESS);
  const mapTop = headerH;
  const mapHeight = height - mapTop - tabSpace;
  // Once you've moved the map, a button glides it back.
  const [moved, setMoved] = useState(false);
  const [recenter, setRecenter] = useState(0);
  // A new lineup or day draws a fresh, framed map.
  const mapKey = `${scope?.id ?? 'everyone'}:${dayOn ?? 'all'}`;
  const [lastKey, setLastKey] = useState(mapKey);
  if (mapKey !== lastKey) {
    setLastKey(mapKey);
    setMoved(false);
  }
  const openBreakdown = useCallback(() => router.push({ pathname: '/your-sound', params: scope ? { festival: scope.id } : {} }), [scope]);

  return (
    <View style={styles.root}>
      <PageTitle title="My Sound" />
      <NightSky />

      <View style={{ position: 'absolute', top: mapTop, left: 0 }}>
        {/* A new scope draws a fresh map: fitted and centred, its bubbles blooming in. */}
        <SoundMap
          key={mapKey}
          artists={onMap}
          taste={shown.taste}
          width={width}
          height={mapHeight}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            // Opening artists counts for the "Stargazer" daily quest.
            if (id) bumpQuestEvent('bubble');
          }}
          onBackgroundTap={close}
          onRegionTap={showSound}
          matchIds={search?.ids}
          similarity={live.similarity}
          loved={loved}
          onMoved={setMoved}
          recenter={recenter}
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
      {newcomer ? <NewcomerNote scopeId={scope?.id} connect={note?.action === 'connect' ? note.text : undefined} bottom={tabSpace + space.lg} /> : null}
      {!search && !sparse && !newcomer && note && <MusicNoteView note={note} bottom={tabSpace + space.lg} />}

      {/* A soft scrim under the header: bubbles glide beneath it rather than being cut off. */}
      <LinearGradient
        colors={['rgba(10,9,24,0.98)', 'rgba(10,9,24,0.98)', 'rgba(10,9,24,0)']}
        locations={[0, mapTop / (mapTop + SCRIM_FADE), 1]}
        style={[styles.scrim, { height: mapTop + SCRIM_FADE }]}
        pointerEvents="none"
      />

      <View
        style={[styles.header, { paddingTop: insets.top + space.lg }]}
        pointerEvents="box-none"
        onLayout={(e) => setHeaderH(Math.round(e.nativeEvent.layout.height))}
      >
        <View style={styles.titleRow} pointerEvents="box-none">
          <Text style={styles.title} pointerEvents="none">
            My Sound
          </Text>
          <View style={styles.actions} pointerEvents="box-none">
            {searchOpen ? null : (
              <GlassCircleButton label="Search your map for an artist or a sound" onPress={() => setSearchOpen(true)}>
                <SearchIcon color={color.moon} size={18} />
              </GlassCircleButton>
            )}
            {shaped ? <SoundMenu onCleared={reshapeSoon} scopeId={scope?.id} /> : null}
          </View>
        </View>

        <SoundSummary
          headline={leanLine(lean, shaped)}
          basis={basisLine({ ...shown.summary, rated: shown.rated, libraries: shown.importing.map((p) => PROVIDER_NAME[p]) })}
          shares={mix}
          shaped={shaped}
          scopeName={scope?.name}
          onPress={openBreakdown}
        />

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
          <>
            <LensRow lenses={lenses} current={scope} onPick={pickLens} />
            {scope && scopeDays.length > 0 ? <DayRow scope={scope} days={scopeDays} day={dayOn} onDay={pickDay} /> : null}
          </>
        ) : null}
      </View>

      {/* Moved away: one tap glides the map back to your strongest matches. */}
      {moved && !selectedId ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={[styles.recenter, { top: mapTop + space.sm }]}>
          <GlassCircleButton
            label="Back to your top matches"
            onPress={() => {
              haptic.settle();
              setRecenter((n) => n + 1);
            }}
          >
            <LocateIcon color={color.moon} size={18} />
          </GlassCircleButton>
        </Animated.View>
      ) : null}

      {/* The sheet shows the live match, so a rating there shows its effect straight away. */}
      <ArtistSheet artistId={selectedId} taste={live.taste} bottomInset={tabSpace} onClose={close} />
    </View>
  );
}

/**
 * Your sound, in one card: what you lean towards (in the top sound's colour),
 * the mix as a line of colour, and what it rests on. Tap for the breakdown.
 */
function SoundSummary({
  headline,
  basis,
  shares,
  shaped,
  scopeName,
  onPress,
}: {
  shaped: boolean;
  headline: string;
  basis: string | undefined;
  shares: ReturnType<typeof tasteMix>;
  scopeName: string | undefined;
  onPress: () => void;
}) {
  const top = shares[0]?.tag;
  const spoken = shares.map((s) => `${SOUND_LABEL[s.tag]} ${s.percent} percent`).join(', ');
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${scopeName ? `Your sound at ${scopeName}` : 'Your sound'}: ${spoken || headline}`}
      accessibilityHint="Opens the breakdown"
      style={({ pressed }) => [styles.summary, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
    >
      <View style={styles.summaryTop}>
        <Text style={[styles.summaryTitle, shaped && top && { color: SOUND_COLOR[top] }]} numberOfLines={1}>
          {headline}
        </Text>
        <View style={styles.summaryLink}>
          <Text style={styles.summaryLinkText}>Breakdown</Text>
          <ChevronIcon color={color.moonDim} size={11} />
        </View>
      </View>
      {shares.length ? (
        <View style={styles.spectrum} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <SoundSpectrum shares={shares} label="Your sound" />
        </View>
      ) : null}
      <Text style={styles.summaryBasis} numberOfLines={1}>
        {basis ? `${basis}${scopeName ? ` · at ${scopeName}` : ''}` : `Bigger bubbles are closer matches${scopeName ? ` · ${scopeName}` : ''}`}
      </Text>
    </Pressable>
  );
}

/**
 * Which artists the map shows, in plain words: All artists, the festivals
 * you're going to, and More festivals for any other lineup.
 */
function LensRow({ lenses, current, onPick }: { lenses: { id: string | undefined; label: string }[]; current: Festival | undefined; onPick: (id: string | undefined) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsWrap} contentContainerStyle={styles.chips}>
      {lenses.map((l) => {
        const on = (l.id ?? undefined) === current?.id;
        return (
          <Pressable
            key={l.id ?? 'all'}
            onPress={() => {
              if (on) return;
              haptic.select();
              onPick(l.id);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={l.id ? `Your sound at ${l.label}` : 'Your sound across every artist'}
            style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.75 }]}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
              {l.label}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        onPress={() => {
          haptic.select();
          router.push({ pathname: '/sound-scope', params: current ? { current: current.id } : {} });
        }}
        accessibilityRole="button"
        accessibilityLabel={`${current ? `Your sound at ${current.name}` : 'Your sound across every artist'}. Choose a festival`}
        style={({ pressed }) => [styles.chip, styles.moreChip, pressed && { opacity: 0.75 }]}
      >
        <Text style={styles.chipText}>More festivals</Text>
        <ChevronIcon color={color.moonDim} size={10} direction="down" />
      </Pressable>
    </ScrollView>
  );
}

/** One day of the chosen festival's lineup (when the poster or set times say who plays when). */
function DayRow({ scope, days, day, onDay }: { scope: Festival; days: string[]; day: string | undefined; onDay: (d: string | undefined) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysWrap} contentContainerStyle={styles.chips}>
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
            style={({ pressed }) => [styles.day, on && styles.dayOn, pressed && { opacity: 0.75 }]}
          >
            <Text style={[styles.dayText, on && styles.dayTextOn]}>{d ?? 'All days'}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Nothing of yours yet: the quickest ways to a real map. */
function NewcomerNote({ scopeId, connect, bottom }: { scopeId?: string; connect?: string; bottom: number }) {
  const button = (label: string, a11y: string, go: () => void, primary?: boolean) => (
    <Pressable
      key={label}
      onPress={() => {
        haptic.tap();
        go();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.sparseButton, !primary && styles.quietButton, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
    >
      <Text style={styles.sparseButtonText}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={[styles.sparse, { bottom }]} pointerEvents="box-none">
      <Text style={styles.noteTitle}>Make this map yours</Text>
      <Text style={styles.sparseText}>
        Pick a few artists you love and it rearranges around you.{connect ? ` ${connect}` : ''}
      </Text>
      <View style={styles.noteButtons}>
        {button('Pick artists', 'Pick artists you know', () => router.push(scopeId ? { pathname: '/pick-artists', params: { festivals: scopeId } } : '/pick-artists'), true)}
        {button('This or that', 'Play this or that', () => router.push('/this-or-that'))}
        {connect ? button('Connect music', 'Connect your music', () => router.push('/music')) : null}
      </View>
    </View>
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

const hasSignal = ({ likes, saves, skips, watched }: TasteSummary, rated: number) =>
  likes + saves + skips + watched + rated > 0;

/**
 * One quiet button for the rest: your clips (saved and liked), picking more
 * artists, and starting over. Starting over clears everything your sound
 * has learned (likes, saves, skips, watching, ratings) and the feed's viewing
 * history. Plans stay: festivals you're going to and starred sets are yours,
 * not your taste.
 */
function SoundMenu({ onCleared, scopeId }: { onCleared: () => void; scopeId?: string }) {
  const reactions = useReactions();
  const ratings = useRatings();
  const seen = useSeen();
  const { clips } = useClipPool();
  const count = yourClipCount(yourClips(clips, reactions.reactions));
  // Connected music is a connection, not something you did here: it stays, and says where to remove it.
  const { importing } = useMusic();
  const music = importing.length
    ? ` Your ${importing.map((p) => PROVIDER_NAME[p]).join(' and ')} library stays connected (remove it in Music connections).`
    : '';
  const startOver = () =>
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
  const items: { label: string; run: () => void; destructive?: boolean }[] = [
    ...(count > 0 ? [{ label: `Your clips · ${count}`, run: () => router.push('/saved') }] : []),
    {
      label: 'Pick more artists',
      run: () => router.push(scopeId ? { pathname: '/pick-artists', params: { festivals: scopeId } } : '/pick-artists'),
    },
    { label: 'Play this or that', run: () => router.push('/this-or-that') },
    { label: 'Start over', run: startOver, destructive: true },
  ];
  return (
    <GlassCircleButton
      label={count > 0 ? `More: your clips (${count}), pick artists, this or that, start over` : 'More: pick artists, this or that, start over'}
      onPress={() =>
        showActionSheet(
          {
            title: 'Your sound',
            options: [...items.map((i) => i.label), 'Cancel'],
            cancelButtonIndex: items.length,
            destructiveButtonIndex: items.findIndex((i) => i.destructive),
          },
          (i) => items[i]?.run(),
        )
      }
    >
      <MoreIcon color={color.moon} />
    </GlassCircleButton>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  header: { paddingHorizontal: space.xl },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomScrim: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  chipsWrap: { marginTop: space.md, marginHorizontal: -space.xl, flexGrow: 0 },
  daysWrap: { marginTop: space.sm, marginHorizontal: -space.xl, flexGrow: 0 },
  chips: { paddingHorizontal: space.xl, gap: space.sm },
  chip: {
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    maxWidth: 220,
  },
  chipOn: { backgroundColor: color.moon, borderColor: color.moon },
  chipTextOn: { color: color.night, fontWeight: '600' },
  moreChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  day: { height: 28, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.pill },
  dayOn: { backgroundColor: 'rgba(169,124,255,0.22)' },
  dayText: { ...type.caption, color: color.moonDim },
  dayTextOn: { color: color.moon, fontWeight: '600' },
  summary: {
    marginTop: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  summaryTitle: { ...type.headline, color: color.moon, flexShrink: 1 },
  summaryLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryLinkText: { ...type.caption, color: color.moonDim },
  summaryBasis: { ...type.caption, color: color.moonDim, marginTop: space.sm },
  recenter: { position: 'absolute', right: space.xl },
  noteTitle: { ...type.headline, color: color.moon },
  noteButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  quietButton: { backgroundColor: color.glass, borderColor: color.hairline },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  done: { ...type.headline, color: color.glow },
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
  spectrum: { marginTop: space.sm, height: 6 },
});
