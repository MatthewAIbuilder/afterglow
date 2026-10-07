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
import { revealSecret } from '../../state/secrets';
import { useCatalog } from '../../state/catalog';
import { useClipPool } from '../../state/community';
import { useRatings } from '../../state/ratings';
import { useReactions } from '../../state/reactions';
import { useSeen } from '../../state/seen';
import { useTaste } from '../../state/taste';
import { useWeekends } from '../../state/weekends';
import { color, radius, space, type, glowA, nightA, raisedA } from '../../theme/tokens';
import { SOUND_LABEL, type SoundTag } from '../../data/models';
import type { Festival } from '../../data/types';
import type { TasteSummary } from '../../features/taste/engine';
import { soundLean, tasteMix } from '../../features/taste/lean';
import { isWarm } from '../../features/taste/ratings';
import { SoundSpectrum } from '../../features/sound-map/SoundSpectrum';
import { SoundOverview } from '../../features/sound-map/SoundOverview';
import { SoundList } from '../../features/sound-map/SoundList';
import { musicNote, type MusicNote } from '../../features/music/copy';
import { PROVIDER_NAME } from '../../features/music/models';
import { useMusic } from '../../state/music';
import { showActionSheet, showAlert } from '../../lib/dialog';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { dayWord, t, tn } from '../../i18n';

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
    const timer = setTimeout(() => {
      if (shownRef.current.taste === liveRef.current.taste) return;
      haptic.settle();
      setShown(liveRef.current);
    }, 450);
    return () => clearTimeout(timer);
  }, []);
  useFocusEffect(reshapeSoon);

  // Everyone, or one festival's lineup: your sound at that festival. A festival page can open it (`festival` param).
  const [scopeId, setScopeId] = useState<string | undefined>();
  // One day of that festival's lineup, when the poster or set times say who plays when.
  const [day, setDay] = useState<string | undefined>();
  const { festival: festivalParam, view: viewParam } = useLocalSearchParams<{ festival?: string; view?: string }>();
  // The overview (your sound, a guide to every sound, tips), the ranked list or the bubble map.
  // A festival or `view=map` opens the map; `view=list` the list.
  const [view, setView] = useState<SoundView>(viewParam === 'list' ? 'list' : viewParam === 'map' || festivalParam ? 'map' : 'overview');
  const navigation = useNavigation();
  // `everyone` (from the scope picker) goes back to the whole map; a festival id narrows it.
  const asked = festivalParam === EVERYONE ? EVERYONE : festivalParam && catalog.festival(festivalParam) ? festivalParam : undefined;
  const [lastAsked, setLastAsked] = useState<string | undefined>();
  if (asked && asked !== lastAsked) {
    setLastAsked(asked);
    // The list keeps its place: a festival chosen from it shows that lineup ranked.
    if (view !== 'list') setView('map');
    setScopeId(asked === EVERYONE ? undefined : asked);
    setDay(undefined);
    setSelectedId(null);
  }
  if (!festivalParam && lastAsked) setLastAsked(undefined);
  // `view=map` (or `view=list`) opens it even when the tab is already open (a quest, your profile's orbit).
  const [lastView, setLastView] = useState(viewParam);
  if (viewParam !== lastView) {
    setLastView(viewParam);
    if (viewParam === 'map' || viewParam === 'list') setView(viewParam);
  }
  useEffect(() => {
    if (festivalParam) navigation.setParams({ festival: '' } as never);
  }, [festivalParam, navigation]);
  useEffect(() => {
    if (viewParam) navigation.setParams({ view: '' } as never);
  }, [viewParam, navigation]);
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
  // The overview is always about you across everyone, whatever festival the map is showing.
  const everyone = useMemo(() => (scope ? mapCandidates(artists, undefined) : candidates), [scope, artists, candidates]);
  const mixAll = useMemo(() => (everyone === candidates ? mix : tasteMix(everyone, shown.taste, shown.informed)), [everyone, candidates, mix, shown]);
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
  const watchable = useMemo(() => new Set(soundChoices(catalog.clips, catalog.artist).map((c) => c.tag)), [catalog]);
  const openMap = useCallback(() => setView('map'), []);
  const openBreakdown = useCallback(() => router.push({ pathname: '/your-sound', params: scope && view !== 'overview' ? { festival: scope.id } : {} }), [scope, view]);

  const summaryCard = (
    <SoundSummary
      headline={leanLine(lean, shaped)}
      basis={basisLine({ ...shown.summary, rated: shown.rated, libraries: shown.importing.map((p) => PROVIDER_NAME[p]) })}
      shares={view === 'overview' ? mixAll : mix}
      shaped={shaped}
      scopeName={view === 'overview' ? undefined : scope?.name}
      onPress={openBreakdown}
    />
  );
  const titleRow = (
    <View style={styles.titleRow} pointerEvents="box-none">
      {/* A secret: hold the title for a bass drop. */}
      <Pressable onLongPress={() => revealSecret('bassdrop')} delayLongPress={700} accessibilityRole="header" accessibilityLabel={t('My Sound')}>
        <Text style={styles.title}>{t('My Sound')}</Text>
      </Pressable>
      <View style={styles.actions} pointerEvents="box-none">
        {view !== 'map' || searchOpen ? null : (
          <GlassCircleButton label={t('Search your map for an artist or a sound')} onPress={() => setSearchOpen(true)}>
            <SearchIcon color={color.moon} size={18} />
          </GlassCircleButton>
        )}
        {shaped ? <SoundMenu onCleared={reshapeSoon} scopeId={scope?.id} /> : null}
      </View>
    </View>
  );
  const toggle = <ViewToggle view={view} onChange={(v) => {
    setSelectedId(null);
    // The map comes back framed on your top matches, not searching.
    setMoved(false);
    closeSearch();
    setView(v);
  }} />;

  // The festival choices, shared by the list and the map: switching between them keeps the festival.
  const scopeRows = hasScopes ? (
    <>
      <LensRow lenses={lenses} current={scope} onPick={pickLens} />
      {scope && scopeDays.length > 0 ? <DayRow scope={scope} days={scopeDays} day={dayOn} onDay={pickDay} /> : null}
    </>
  ) : null;

  if (view === 'list') {
    return (
      <View style={styles.root}>
        <PageTitle title={t('My Sound')} />
        <NightSky />
        {/* Ranked on your live taste, so a rating on an artist's page shows when you come back. */}
        <SoundList
          header={
            <View>
              {titleRow}
              {toggle}
              {scopeRows}
            </View>
          }
          candidates={candidates}
          taste={live.taste}
          informed={live.informed}
          festivalId={scope?.id}
          festivalName={scope ? (dayOn ? t('{festival} on {day}', { festival: scope.name, day: dayWord(dayOn) }) : scope.name) : undefined}
          top={insets.top + space.lg}
          bottom={tabSpace + space.xl}
        />
      </View>
    );
  }

  if (view === 'overview') {
    return (
      <View style={styles.root}>
        <PageTitle title={t('My Sound')} />
        <NightSky />
        <ScrollView contentContainerStyle={[styles.overview, { paddingTop: insets.top + space.lg, paddingBottom: tabSpace + space.xl }]}>
          {titleRow}
          {toggle}
          {summaryCard}
          <SoundOverview
            shares={mixAll}
            artists={artists}
            taste={shown.taste}
            watchable={watchable}
            shaped={shaped}
            canConnect={note?.action === 'connect'}
            hasFestivals={hasScopes}
            onOpenMap={openMap}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <PageTitle title={t('My Sound')} />
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
        colors={[nightA(0), nightA(0.85), nightA(0.97)]}
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
        colors={[nightA(0.98), nightA(0.98), nightA(0)]}
        locations={[0, mapTop / (mapTop + SCRIM_FADE), 1]}
        style={[styles.scrim, { height: mapTop + SCRIM_FADE }]}
        pointerEvents="none"
      />

      <View
        style={[styles.header, { paddingTop: insets.top + space.lg }]}
        pointerEvents="box-none"
        onLayout={(e) => setHeaderH(Math.round(e.nativeEvent.layout.height))}
      >
        {titleRow}
        {toggle}
        {/* What you lean towards lives on Overview; the map keeps its room for the map. */}

        {searchOpen ? (
          <View style={styles.searchRow}>
            <View style={{ flex: 1 }}>
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder={t('Artist or sound, like dubstep')}
                label={t('Search your map for an artist or a sound')}
                autoFocus={typing}
              />
            </View>
            <Pressable onPress={closeSearch} accessibilityRole="button" accessibilityLabel={t('Done searching')} hitSlop={8}>
              <Text style={styles.done}>{t('Done')}</Text>
            </Pressable>
          </View>
        ) : (
          scopeRows
        )}
      </View>

      {/* Moved away: one tap glides the map back to your strongest matches. */}
      {moved && !selectedId ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={[styles.recenter, { top: mapTop + space.sm }]}>
          <GlassCircleButton
            label={t('Back to your top matches')}
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

type SoundView = 'overview' | 'list' | 'map';
/** What each view is called to screen readers. */
const VIEW_SAID: Record<SoundView, string> = { overview: t('Overview'), list: t('Ranked list of artists'), map: t('Bubble map') };

/** Overview, list or map: a quiet three-way switch under the title. */
function ViewToggle({ view, onChange }: { view: SoundView; onChange: (v: SoundView) => void }) {
  return (
    <View style={styles.toggle} accessibilityRole="tablist">
      {(
        [
          ['overview', t('Overview')],
          ['list', t('List')],
          ['map', t('Map')],
        ] as const
      ).map(([v, label]) => {
        const on = view === v;
        return (
          <Pressable
            key={v}
            onPress={() => {
              if (on) return;
              haptic.select();
              onChange(v);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={VIEW_SAID[v]}
            style={[styles.toggleItem, on && styles.toggleOn]}
          >
            <Text style={[styles.toggleText, on && styles.toggleTextOn]}>{label}</Text>
          </Pressable>
        );
      })}
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
  const spoken = shares.map((s) => t('{sound} {pct} percent', { sound: SOUND_LABEL[s.tag], pct: s.percent })).join(', ');
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={scopeName ? t('Your sound at {festival}: {mix}', { festival: scopeName, mix: spoken || headline }) : t('Your sound: {mix}', { mix: spoken || headline })}
      accessibilityHint={t('Opens the breakdown')}
      style={({ pressed }) => [styles.summary, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
    >
      <View style={styles.summaryTop}>
        <Text style={[styles.summaryTitle, shaped && top && { color: SOUND_COLOR[top] }]} numberOfLines={1}>
          {headline}
        </Text>
        <View style={styles.summaryLink}>
          <Text style={styles.summaryLinkText}>{t('Breakdown')}</Text>
          <ChevronIcon color={color.moonDim} size={11} />
        </View>
      </View>
      {shares.length ? (
        <View style={styles.spectrum} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <SoundSpectrum shares={shares} label={t('Your sound')} />
        </View>
      ) : null}
      <Text style={styles.summaryBasis} numberOfLines={1}>
        {basis
          ? scopeName
            ? t('{basis} · at {festival}', { basis, festival: scopeName })
            : basis
          : scopeName
            ? t('Bigger bubbles are closer matches · {festival}', { festival: scopeName })
            : t('Bigger bubbles are closer matches')}
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
            accessibilityLabel={l.id ? t('Your sound at {festival}', { festival: l.label }) : t('Your sound across every artist')}
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
        accessibilityLabel={current ? t('Your sound at {festival}. Choose a festival', { festival: current.name }) : t('Your sound across every artist. Choose a festival')}
        style={({ pressed }) => [styles.chip, styles.moreChip, pressed && { opacity: 0.75 }]}
      >
        <Text style={styles.chipText}>{t('More festivals')}</Text>
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
            accessibilityLabel={d ? t('Only {day} at {festival}', { day: dayWord(d), festival: scope.name }) : t('Every day at {festival}', { festival: scope.name })}
            style={({ pressed }) => [styles.day, on && styles.dayOn, pressed && { opacity: 0.75 }]}
          >
            <Text style={[styles.dayText, on && styles.dayTextOn]}>{d ? t(d) : t('All days')}</Text>
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
    <View style={[styles.sparse, styles.slim, { bottom }]} pointerEvents="box-none" accessible={false}>
      <Text style={styles.slimTitle} accessibilityLabel={connect ? t('Make this map yours. Pick a few artists you love and it rearranges around you. {connect}', { connect }) : t('Make this map yours. Pick a few artists you love and it rearranges around you.')}>
        {t('Make this map yours')}
      </Text>
      {connect ? <Text style={styles.slimText}>{connect}</Text> : null}
      <View style={styles.noteButtons}>
        {button(t('Pick artists'), t('Pick artists you know'), () => router.push(scopeId ? { pathname: '/pick-artists', params: { festivals: scopeId } } : '/pick-artists'), true)}
        {button(t('This or that'), t('Play this or that'), () => router.push('/this-or-that'))}
        {connect ? button(t('Connect music'), t('Connect your music'), () => router.push('/music')) : null}
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
      ? t('No artist or sound matches “{query}”.', { query: query.trim() })
      : sound
        ? extra
          ? tn(n, '{n} {sound} artist, {extra} new to your map. Tap one to see more.', '{n} {sound} artists, {extra} new to your map. Tap one to see more.', { sound, extra })
          : tn(n, '{n} {sound} artist. Tap one to see more.', '{n} {sound} artists. Tap one to see more.', { sound })
        : extra
          ? tn(n, '{n} artist, {extra} new to your map. Tap one to see more.', '{n} artists, {extra} new to your map. Tap one to see more.', { extra })
          : tn(n, '{n} artist. Tap one to see more.', '{n} artists. Tap one to see more.');
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
          accessibilityLabel={t('Watch {sound} live sets in Discover', { sound: sound ?? '' })}
          style={({ pressed }) => [styles.sparseButton, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.sparseButtonText}>{t('Watch {sound}', { sound: sound ?? '' })}</Text>
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
          ? t('None of {festival}’s {total} artists are on your map yet.', { festival: festival.name, total })
          : shown === 1
            ? t('Only {shown} of {festival}’s {total} artists is on your map so far.', { shown, festival: festival.name, total })
            : t('Only {shown} of {festival}’s {total} artists are on your map so far.', { shown, festival: festival.name, total })}{' '}
        {toRate > 0 ? t('Rate the lineup to place the rest.') : t('React to clips from the lineup to place more.')}
      </Text>
      {toRate > 0 && (
        <Pressable
          onPress={() => {
            haptic.tap();
            router.push(`/tune/${festival.id}`);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('Tune your lineup. Rate {n} artists one at a time.', { n: toRate })}
          style={({ pressed }) => [styles.sparseButton, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.sparseButtonText}>{t('Tune your lineup')}</Text>
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
          accessibilityLabel={note.action === 'connect' ? t('Connect your music') : t('Open music connections')}
          style={({ pressed }) => [styles.sparseButton, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.sparseButtonText}>{note.action === 'connect' ? t('Connect music') : t('Music connections')}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** "A and B" (and "A, B and C"), in the app's language. */
const andList = (xs: string[]) => (xs.length > 1 ? t('{list} and {last}', { list: xs.slice(0, -1).join(', '), last: xs[xs.length - 1] }) : (xs[0] ?? ''));

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
    ? t('Your {libraries} library stays connected (remove it in Music connections).', { libraries: andList(importing.map((p) => PROVIDER_NAME[p])) })
    : '';
  const startOver = () =>
    showAlert(
      t('Start your sound over?'),
      music
        ? t('This clears your likes, saves, skips, watched clips and artist ratings. Festivals you’re going to and your starred sets stay. {music}', { music })
        : t('This clears your likes, saves, skips, watched clips and artist ratings. Festivals you’re going to and your starred sets stay.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Start over'),
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
    ...(count > 0 ? [{ label: t('Your clips · {n}', { n: count }), run: () => router.push('/saved') }] : []),
    {
      label: t('Pick more artists'),
      run: () => router.push(scopeId ? { pathname: '/pick-artists', params: { festivals: scopeId } } : '/pick-artists'),
    },
    { label: t('Play this or that'), run: () => router.push('/this-or-that') },
    { label: t('Start over'), run: startOver, destructive: true },
  ];
  return (
    <GlassCircleButton
      label={count > 0 ? t('More: your clips ({n}), pick artists, this or that, start over', { n: count }) : t('More: pick artists, this or that, start over')}
      onPress={() =>
        showActionSheet(
          {
            title: t('Your sound'),
            options: [...items.map((i) => i.label), t('Cancel')],
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
    borderTopColor: color.rim,
    maxWidth: 220,
  },
  chipOn: { backgroundColor: color.moon, borderColor: color.moon },
  chipTextOn: { color: color.night, fontWeight: '600' },
  moreChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  day: { height: 28, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.pill },
  dayOn: { backgroundColor: glowA(0.22) },
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
    backgroundColor: raisedA(0.82),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  sparseText: { ...type.body, color: color.moonDim },
  // The newcomer note: a slim strip, so the map stays the star.
  slim: { paddingVertical: space.md, paddingHorizontal: space.md, gap: space.sm, backgroundColor: raisedA(0.72) },
  slimTitle: { ...type.label, color: color.moonDim, paddingHorizontal: space.xs },
  slimText: { ...type.caption, color: color.moonDim, paddingHorizontal: space.xs },
  sparseButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: glowA(0.18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.4),
  },
  sparseButtonText: { ...type.label, color: color.moon },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overview: { paddingHorizontal: space.xl },
  toggle: { flexDirection: 'row', alignSelf: 'flex-start', padding: 3, marginTop: space.md, marginBottom: space.md, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  toggleItem: { paddingHorizontal: space.lg, paddingVertical: 7, borderRadius: radius.pill },
  toggleOn: { backgroundColor: glowA(0.28) },
  toggleText: { ...type.label, color: color.moonDim },
  toggleTextOn: { color: color.moon },
  title: { ...type.largeTitle, color: color.moon },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  spectrum: { marginTop: space.sm, height: 6 },
});
