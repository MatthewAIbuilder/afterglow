import { Image } from 'expo-image';
import { router } from 'expo-router';
import { type ReactNode, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArtistRow } from '../../components/ArtistRow';
import { NightSky } from '../../components/NightSky';
import { SearchField } from '../../components/SearchField';
import { Tabs } from '../../components/Tabs';
import { CheckIcon, ChevronIcon } from '../../components/TabIcons';
import { setFor } from '../../data/festival';
import { SOUND_LABEL, type SoundTag } from '../../data/models';
import type { Artist, Festival } from '../../data/types';
import { HeartIcon, PlayIcon } from '../discover/icons';
import { StarIcon } from '../plan/icons';
import { FilterChips } from '../../components/FilterChips';
import { dayList, daysOf, lineupDays, playsOn } from './days';
import { runLabel, validWeekend } from './weekend';
import { useWeekends } from '../../state/weekends';
import { describeSet, whereWhen } from './format';
import { distanceLabel } from './near';
import { useNearby } from '../../state/nearby';
import { lineupReach } from './links';
import { filterLineup, lineupSounds, SEARCH_FROM } from './search';
import { countdown, isLive, setLine } from './when';
import { useToday } from '../../lib/useToday';
import { leftToRate } from './tune';
import { YourFestival } from '../plan/YourFestival';
import { haptic } from '../../lib/haptics';
import { FriendsGoing } from '../social/FriendsGoing';
import { CrewCard } from '../crews/CrewCard';
import { starsShort } from '../crews/together';
import { useFollowedArtists } from '../../state/followedArtists';
import { useCrews } from '../../state/crews';
import { OfficialLinks } from './OfficialLinks';
import { GetReadyCard } from '../prep/GetReadyCard';
import { TryFestivalMode } from '../festivalMode/FestivalModeCard';
import { useRecap } from '../recap/useRecap';
import { CalendarPill } from '../calendar/CalendarPill';
import { CareCard } from '../care/CareCard';

import { useCatalog } from '../../state/catalog';
import { useGoing } from '../../state/going';
import { useLineupNews } from '../../state/lineupNews';
import { useRatings } from '../../state/ratings';
import { useTaste } from '../../state/taste';
import { color, radius, space, type } from '../../theme/tokens';
import { coverPhotos } from './cover';
import { CrowdVideos } from './CrowdVideos';
import { LiveCrowdRow } from './LiveCrowdRow';
import { FestivalCover } from './FestivalCover';

type Order = 'match' | 'billing';
/** The page's tabs: your plan, the whole lineup, and the practical things. */
type Section = 'plan' | 'lineup' | 'crowd' | 'info';

type Props = {
  festival: Festival;
  /** Space above the title (safe area plus any header). */
  topSpace: number;
  bottomSpace: number;
  /** Shown above the festival's name, e.g. the Lineup tab's festival switcher. */
  above?: ReactNode;
};

/**
 * A festival's page: dates, going, Discover and Tune pills, poster, your
 * festival plan and the full lineup with search and sound filter. Used by the
 * festival route and the Lineup tab.
 */
/** How far the cover reaches below the top space, behind the title. */
const COVER_BELOW = 150;
/** How far below that the night eases back into the sky. */
const COVER_TAIL = 140;

export function FestivalPage({ festival: whole, topSpace, bottomSpace, above }: Props) {
  const catalog = useCatalog();
  // The festival as it is for you: for one run over several weekends, the weekend you're going to.
  const { forYou } = useWeekends();
  const festival = useMemo(() => forYou(whole), [forYou, whole]);
  const { taste } = useTaste();
  const [order, setOrder] = useState<Order>('match');
  const [query, setQuery] = useState('');
  const { ratings } = useRatings();
  // Acts added to this lineup lately (a catalogue update), marked "Just added".
  const added = useLineupNews().justAdded(festival.id);
  const { crewStarsFor } = useCrews();
  const { isFollowing } = useFollowedArtists();
  const today = useToday();

  const lineup = useMemo(() => {
    const list = festival.lineup.map((a) => catalog.artist(a)).filter((a): a is Artist => !!a);
    return order === 'match' ? [...list].sort((a, b) => (taste[b.id] ?? 0) - (taste[a.id] ?? 0)) : list;
  }, [catalog, festival, order, taste]);
  const [picked, setPicked] = useState<SoundTag | undefined>();
  const sounds = useMemo(() => (lineup.length > SEARCH_FROM ? lineupSounds(lineup) : []), [lineup]);
  // Only filter by a sound this lineup actually offers.
  const sound = sounds.length > 1 && sounds.some((s) => s.tag === picked) ? picked : undefined;
  // Day by day, when the poster (or the set times) say who plays when.
  const days = useMemo(() => lineupDays(festival), [festival]);
  const [pickedDay, setPickedDay] = useState<string | undefined>();
  const day = days.includes(pickedDay ?? '') ? pickedDay : undefined;
  const shown = useMemo(
    () => filterLineup(lineup, query, sound).filter((a) => playsOn(festival, a.id, day)),
    [lineup, query, sound, festival, day],
  );

  const soon = countdown(festival, today);
  const { isGoing } = useGoing();
  const reach = lineupReach(festival, catalog.clips);
  const toRate = leftToRate(festival, ratings, (a) => !!catalog.artist(a));
  const recap = useRecap(whole);
  const { distanceTo, units, placeOf } = useNearby();
  const away = distanceTo(whole);
  const cover = useMemo(() => coverPhotos(whole, catalog.artist), [whole, catalog]);
  const [tab, setTab] = useState<Section>('plan');
  // From the first day to the morning after the last (either weekend of a two-weekend festival).
  const onNow = isLive(festival, today);

  return (
    <View style={styles.root}>
      <NightSky />
      <ScrollView
        contentContainerStyle={{ paddingTop: topSpace, paddingBottom: bottomSpace }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* The headliners' faces behind the top of the page, fading into the night under the title. */}
        <FestivalCover photos={cover} fade="page" tail={COVER_TAIL} style={[styles.cover, { height: topSpace + COVER_BELOW + COVER_TAIL }]} />
        {above}
        <View style={styles.pad}>
          <Text style={styles.title}>{festival.name}</Text>
          <Text style={styles.meta}>
            {whereWhen(festival)}
            {away !== undefined ? ` · ${distanceLabel(away, units)}` : ''}
          </Text>
          {soon ? <Text style={styles.soon}>{soon}</Text> : null}
          {/* One row of the things you do here; everything else is in the tabs below. */}
          <View style={styles.pills}>
            <GoingPill festival={whole} />
            {/* Over, and you were part of it: your recap. */}
            {recap ? (
              <Action
                label="Recap"
                a11y={`See your recap of ${whole.name}`}
                icon={<StarIcon color={color.glow} size={13} filled />}
                onPress={() => router.push({ pathname: '/recap/[id]', params: { id: whole.id } })}
              />
            ) : null}
            {reach.clips > 0 ? (
              <Action
                label="Watch"
                count={reach.clips}
                glow
                a11y={`Discover the lineup. ${reach.clips} live clips from ${reach.artists} artists playing ${festival.name}.`}
                icon={<PlayIcon color={color.moon} size={13} />}
                onPress={() => router.navigate({ pathname: '/', params: { festival: festival.id } })}
              />
            ) : null}
            {toRate > 0 ? (
              <Action
                label="Tune"
                count={toRate}
                a11y={`Tune your lineup. Rate ${toRate} artists one at a time.`}
                icon={<HeartIcon color={color.moon} size={13} />}
                // Narrowed to a day in the lineup? Tune that day.
                onPress={() => router.push(day ? { pathname: '/tune/[id]', params: { id: festival.id, day } } : `/tune/${festival.id}`)}
              />
            ) : null}
          </View>
          {/* People you follow (and others) who show this festival on their profile. */}
          <FriendsGoing festivalId={whole.id} />
          {/* While it's on: timers, water and check-ins, private to you. */}
          {onNow ? <CareCard /> : null}
        </View>

        {whole.weekends && whole.weekends.length > 1 ? <WeekendPicker festival={whole} shown={festival.lineup.length} /> : null}

        <View style={styles.tabs}>
          <Tabs<Section>
            value={tab}
            onChange={setTab}
            items={[
              { key: 'plan', label: 'For you' },
              { key: 'lineup', label: 'Lineup', count: festival.lineup.length },
              { key: 'crowd', label: 'Videos' },
              { key: 'info', label: 'Info' },
            ]}
          />
        </View>

        {/* While it's on: what people are filming there right now. */}
        {tab === 'plan' && onNow ? <LiveCrowdRow festival={festival} /> : null}
        {tab === 'plan' ? <YourFestival festival={festival} /> : null}

        {tab === 'lineup' ? (
          <View style={styles.lineupTab}>
            <View style={[styles.pad, styles.lineupHead]}>
              <Text style={styles.lineupCount}>
                {shown.length === lineup.length ? `${lineup.length} acts` : `${shown.length} of ${lineup.length} acts`}
              </Text>
              <Segmented value={order} onChange={setOrder} />
            </View>
            {lineup.length > SEARCH_FROM && (
              <View style={[styles.pad, styles.searchWrap]}>
                <SearchField
                  value={query}
                  onChange={setQuery}
                  placeholder="Find an artist"
                  label={`Find an artist on the ${festival.name} lineup`}
                />
              </View>
            )}

            {days.length > 0 && (
              <View style={styles.dayChips}>
                <FilterChips
                  chips={[
                    { key: undefined, label: 'All days', accessibilityLabel: `Every day at ${festival.name}` },
                    ...days.map((d) => ({
                      key: d,
                      label: d,
                      count: lineup.filter((a) => playsOn(festival, a.id, d)).length,
                      accessibilityLabel: `${d}, ${lineup.filter((a) => playsOn(festival, a.id, d)).length} artists`,
                    })),
                  ]}
                  value={day}
                  onChange={setPickedDay}
                />
              </View>
            )}

            {sounds.length > 1 && (
              <SoundChips festivalName={festival.name} sounds={sounds} value={sound} onChange={setPicked} />
            )}

            <View style={styles.pad}>
              {(query || day) && shown.length === 0 ? (
                <Text style={styles.noMatch}>
                  {sound
                    ? `No ${SOUND_LABEL[sound].toLowerCase()} artist on the lineup matches “${query.trim()}”.`
                    : query
                      ? `No one on the lineup matches “${query.trim()}”.`
                      : `No one with that sound plays ${day}.`}
                </Text>
              ) : null}
              {shown.map((a) => {
                const set = setFor(festival, a.id);
                const line = setLine(set ? describeSet(festival, set) : dayList(daysOf(festival, a.id)), festival.notes?.[a.id]);
                // "Just added", following, your crewmates' stars, then when they play.
                const detail = [added.has(a.id) ? 'Just added' : undefined, isFollowing(a.id) ? 'Following' : undefined, starsShort(crewStarsFor(festival.id, a.id)), line].filter(Boolean).join(' · ') || undefined;
                return (
                  <ArtistRow
                    key={a.id}
                    festivalId={festival.id}
                    artist={a}
                    affinity={taste[a.id] ?? 0}
                    detail={detail}
                    rating={ratings[a.id]}
                  />
                );
              })}
            </View>

          </View>
        ) : null}

        {tab === 'crowd' ? <CrowdVideos festival={festival} /> : null}

        {tab === 'info' ? (
          <View style={styles.infoTab}>
            <View style={styles.pad}>
              {/* Tickets and the festival's own site, when the catalogue has them. */}
              <OfficialLinks festival={whole} over={soon === 'Over'} />
              {/* Once you're going: the days (your weekend) into your calendar, and your checklist. */}
              {isGoing(whole.id) && soon !== 'Over' ? (
                <View style={styles.infoPills}>
                  <CalendarPill festival={festival} />
                </View>
              ) : null}
              {isGoing(whole.id) && soon !== 'Over' ? <GetReadyCard festival={festival} /> : null}
              {/* A simpler app for the day itself: test it any day. */}
              {soon !== 'Over' ? <TryFestivalMode festival={whole} /> : null}
              {/* Your crews for this festival, or start one. */}
              <CrewCard festival={whole} />
            </View>
            {festival.posterImageUrl ? (
              <Pressable
                onPress={() => {
                  haptic.select();
                  router.push(`/poster/${festival.id}`);
                }}
                accessibilityRole="imagebutton"
                accessibilityLabel={festival.posterFrom ? `Picture from ${festival.posterFrom}, the festival's official site. Opens full screen.` : 'Official lineup poster. Opens full screen.'}
                style={[styles.posterWrap, festival.posterFrom && styles.siteWrap]}
              >
                {festival.posterFrom ? (
                  // A site's picture can be any shape (often a wide banner): all of it, over a soft blurred copy.
                  <>
                    <Image source={{ uri: festival.posterImageUrl }} style={styles.poster} contentFit="cover" blurRadius={30} />
                    <View style={styles.siteShade} />
                    <Image source={{ uri: festival.posterImageUrl }} style={styles.poster} contentFit="contain" transition={250} />
                  </>
                ) : (
                  <Image source={{ uri: festival.posterImageUrl }} style={styles.poster} contentFit="cover" transition={250} />
                )}
                <View style={styles.posterHint}>
                  {/* A picture from the festival's own site may be key art rather than the lineup, so it's credited, not called the poster. */}
                  <Text style={styles.posterHintText}>{festival.posterFrom ? `From ${festival.posterFrom}` : 'View poster'}</Text>
                  <ChevronIcon color={color.moon} size={12} />
                </View>
              </Pressable>
            ) : null}

            {/* Where it is, glowing among the others. */}
            {placeOf(whole) ? (
              <Pressable
                onPress={() => {
                  haptic.select();
                  router.push({ pathname: '/festival-map', params: { focus: whole.id } });
                }}
                accessibilityRole="button"
                accessibilityLabel={`See ${whole.name} on the festival map`}
                style={({ pressed }) => [styles.pad, styles.infoRow, pressed && { opacity: 0.7 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoRowTitle}>See it on the map</Text>
                  <Text style={styles.infoRowSub}>{whole.location}, among the other festivals</Text>
                </View>
                <ChevronIcon color={color.moonFaint} size={12} />
              </Pressable>
            ) : null}
            {/* Side by side with other festivals, when there are others to compare. */}
            {catalog.festivals.length > 1 ? (
              <Pressable
                onPress={() => {
                  haptic.select();
                  router.push({ pathname: '/compare', params: { ids: whole.id } });
                }}
                accessibilityRole="button"
                accessibilityLabel={`Compare ${whole.name} with other festivals`}
                style={({ pressed }) => [styles.pad, styles.infoRow, pressed && { opacity: 0.7 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoRowTitle}>Compare festivals</Text>
                  <Text style={styles.infoRowSub}>See which lineup fits your sound best</Text>
                </View>
                <ChevronIcon color={color.moonFaint} size={12} />
              </Pressable>
            ) : null}
            {/* Festivals from the nightly EDMTrain feed credit it, as its terms ask. */}
            {festival.source ? (
              <Pressable
                onPress={() => void Linking.openURL(festival.source!.url).catch(() => {})}
                accessibilityRole="link"
                accessibilityLabel={`Event info from ${festival.source.name}. Opens their page.`}
                style={({ pressed }) => [styles.pad, styles.source, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.sourceText}>Event info from {festival.source.name} ↗</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * For a festival run over several weekends: which one you're going to. The
 * plan, lineup, countdown and reminders follow it.
 */
function WeekendPicker({ festival, shown }: { festival: Festival; shown: number }) {
  const { weekendOf, choose } = useWeekends();
  const chosen = validWeekend(festival, weekendOf(festival.id));
  const runs = festival.weekends ?? [];
  return (
    <View style={styles.weekends}>
      <Text style={styles.weekendsHead}>Your weekend</Text>
      <FilterChips
        chips={[
          { key: undefined, label: 'Every weekend', accessibilityLabel: `Every weekend of ${festival.name}` },
          ...runs.map((r, i) => ({
            key: String(i + 1),
            label: `Weekend ${i + 1} · ${runLabel(r)}`,
            accessibilityLabel: `Weekend ${i + 1}, ${runLabel(r)}`,
          })),
        ]}
        value={chosen ? String(chosen) : undefined}
        onChange={(k) => choose(festival.id, k ? Number(k) : undefined)}
      />
      {chosen ? (
        <Text style={styles.weekendsNote}>
          Your plan and the lineup show weekend {chosen}: {shown} of {festival.lineup.length} acts.
        </Text>
      ) : null}
    </View>
  );
}

/** One of the actions under the title: an icon, a short label, maybe a count. `glow` for the main one. */
function Action({ label, a11y, icon, count, glow, onPress }: { label: string; a11y: string; icon: ReactNode; count?: number; glow?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.discover, !glow && styles.tune, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
    >
      {icon}
      <Text style={styles.discoverText}>{label}</Text>
      {count ? <Text style={styles.discoverCount}>{count}</Text> : null}
    </Pressable>
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
  cover: { position: 'absolute', top: 0, left: 0, right: 0 },
  tabs: { marginTop: space.xl },
  lineupTab: { paddingTop: space.sm },
  lineupCount: { ...type.label, color: color.moonDim, flex: 1 },
  infoTab: { paddingTop: space.sm },
  infoPills: { flexDirection: 'row', marginTop: space.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xl, paddingVertical: space.md },
  infoRowTitle: { ...type.headline, fontSize: 16, color: color.moon },
  infoRowSub: { ...type.caption, color: color.moonDim, marginTop: 2 },
  root: { flex: 1, backgroundColor: color.night },
  pad: { paddingHorizontal: space.xl },
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
  poster: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  siteWrap: { aspectRatio: 4 / 3 },
  siteShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,9,24,0.45)' },
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
  source: { marginTop: space.xl, paddingVertical: space.sm, alignSelf: 'flex-start' },
  sourceText: { ...type.caption, color: color.moonDim },
  searchWrap: { marginBottom: space.sm },
  dayChips: { marginBottom: space.sm },
  weekends: { marginTop: space.xl },
  weekendsHead: { ...type.label, color: color.moonDim, paddingHorizontal: space.xl, marginBottom: space.sm },
  weekendsNote: { ...type.caption, color: color.moonDim, paddingHorizontal: space.xl, marginTop: space.sm },
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
  lineupHead: { marginTop: space.md, marginBottom: space.md, flexDirection: 'row', alignItems: 'center' },
  segment: { flexDirection: 'row', padding: 3, borderRadius: radius.pill, backgroundColor: color.glass },
  segItem: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill },
  segOn: { backgroundColor: 'rgba(169,124,255,0.22)' },
  segText: { ...type.caption, color: color.moonDim },
});
