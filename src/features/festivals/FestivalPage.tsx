import { Image } from 'expo-image';
import { router } from 'expo-router';
import { type ReactNode, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArtistRow } from '../../components/ArtistRow';
import { NightSky } from '../../components/NightSky';
import { SearchField } from '../../components/SearchField';
import { CheckIcon, ChevronIcon } from '../../components/TabIcons';
import { setFor } from '../../data/festival';
import { SOUND_LABEL, type SoundTag } from '../../data/models';
import type { Artist, Festival } from '../../data/types';
import { HeartIcon, PlayIcon } from '../discover/icons';
import { FilterChips } from '../../components/FilterChips';
import { dayList, daysOf, lineupDays, playsOn } from './days';
import { runLabel, validWeekend } from './weekend';
import { useWeekends } from '../../state/weekends';
import { describeSet, whereWhen } from './format';
import { lineupReach } from './links';
import { filterLineup, lineupSounds, SEARCH_FROM } from './search';
import { countdown, setLine } from './when';
import { useToday } from '../../lib/useToday';
import { leftToRate } from './tune';
import { YourFestival } from '../plan/YourFestival';
import { haptic } from '../../lib/haptics';
import { FriendsGoing } from '../social/FriendsGoing';
import { CrewCard } from '../crews/CrewCard';
import { useCatalog } from '../../state/catalog';
import { useGoing } from '../../state/going';
import { useRatings } from '../../state/ratings';
import { useTaste } from '../../state/taste';
import { color, radius, space, type } from '../../theme/tokens';

type Order = 'match' | 'billing';

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
export function FestivalPage({ festival: whole, topSpace, bottomSpace, above }: Props) {
  const catalog = useCatalog();
  // The festival as it is for you: for one run over several weekends, the weekend you're going to.
  const { forYou } = useWeekends();
  const festival = useMemo(() => forYou(whole), [forYou, whole]);
  const { taste } = useTaste();
  const [order, setOrder] = useState<Order>('match');
  const [query, setQuery] = useState('');
  const { ratings } = useRatings();
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

  const timesOut = !!festival.sets?.length;
  const soon = countdown(festival, today);
  const reach = lineupReach(festival, catalog.clips);
  const toRate = leftToRate(festival, ratings, (a) => !!catalog.artist(a));

  return (
    <View style={styles.root}>
      <NightSky />
      <ScrollView
        contentContainerStyle={{ paddingTop: topSpace, paddingBottom: bottomSpace }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {above}
        <View style={styles.pad}>
          <Text style={styles.title}>{festival.name}</Text>
          <Text style={styles.meta}>
            {whereWhen(festival)}
          </Text>
          {soon ? <Text style={styles.soon}>{soon}</Text> : null}
          <View style={styles.pills}>
            <GoingPill festival={whole} />
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
                  // Narrowed to a day in the lineup below? Tune that day.
                  router.push(day ? { pathname: '/tune/[id]', params: { id: festival.id, day } } : `/tune/${festival.id}`);
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
          {/* People you follow (and others) who show this festival on their profile. */}
          <FriendsGoing festivalId={whole.id} />
          {/* Your crews for this festival, or start one. */}
          <CrewCard festival={whole} />
        </View>

        {whole.weekends && whole.weekends.length > 1 ? <WeekendPicker festival={whole} shown={festival.lineup.length} /> : null}

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
            return (
              <ArtistRow
                key={a.id}
                festivalId={festival.id}
                artist={a}
                affinity={taste[a.id] ?? 0}
                detail={setLine(set ? describeSet(festival, set) : dayList(daysOf(festival, a.id)), festival.notes?.[a.id])}
                rating={ratings[a.id]}
              />
            );
          })}
        </View>
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
  lineupHead: { marginTop: space.xxl, marginBottom: space.sm, flexDirection: 'row', alignItems: 'center' },
  section: { ...type.title, fontSize: 22, color: color.moon, flex: 1 },
  segment: { flexDirection: 'row', padding: 3, borderRadius: radius.pill, backgroundColor: color.glass },
  segItem: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill },
  segOn: { backgroundColor: 'rgba(169,124,255,0.22)' },
  segText: { ...type.caption, color: color.moonDim },
});
