import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FestivalRow } from '../components/FestivalRow';
import { FilterChips } from '../components/FilterChips';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { Tabs } from '../components/Tabs';
import { ChevronIcon } from '../components/TabIcons';
import type { Festival } from '../data/types';
import {
  type Month,
  WEEKDAY_LETTERS,
  calendarMonths,
  dayKey,
  monthFestivals,
  monthGrid,
  monthLine,
  monthOf,
  monthTitle,
  sameMonth,
} from '../features/festivals/calendar';
import { NearYouPrompt } from '../features/festivals/NearYouPrompt';
import { RADII, festivalStates, radiusLabel, reachWords, stateNear, statesWithFestivals, withinReach, type Reach } from '../features/festivals/reach';
import { lovedOn } from '../features/festivals/shelves';
import { showActionSheet } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { useToday } from '../lib/useToday';
import { useCalendarReach } from '../state/calendarReach';
import { useCatalog } from '../state/catalog';
import { useGoing } from '../state/going';
import { useNearby } from '../state/nearby';
import { useLoves } from '../state/useLoves';
import { useWeekends } from '../state/weekends';
import { localDay } from '../features/artists/shows';
import { ShowRow, useShowTaste } from '../features/festivals/ShowCards';
import { isForYou, rankShows, showsByDay, showsInReach, upcomingShows } from '../features/festivals/showsForYou';
import { router } from 'expo-router';
import { color, radius, space, type, glowA } from '../theme/tokens';

const GOING = '#FF9AD5';
/** Shows for you listed under a month (a day lists all of its own). */
const MONTH_SHOWS = 8;

/**
 * The festival calendar: a month at a time, each day lit with a dot for every
 * festival on it (pink for yours, glow for ones with acts you'd love). Tap a
 * day to see what's on; flip months with the arrows or tap the month to jump.
 * Club shows for you get a small ring on their day and a list under the
 * festivals. It opens on what's within about 100 miles of you (once location is on);
 * a state or everywhere are a tap away. Festivals you're going to always show.
 */
export default function FestivalCalendarScreen() {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const today = useToday();
  const catalog = useCatalog();
  const { forYou } = useWeekends();
  const all = useMemo(() => catalog.festivals.map(forYou), [catalog.festivals, forYou]);
  const { going } = useGoing();
  const loves = useLoves();
  const nearby = useNearby();
  const { reach, setReach } = useCalendarReach();
  const states = useMemo(() => festivalStates(all, nearby.placeOf), [all, nearby.placeOf]);
  const stateList = useMemo(() => statesWithFestivals(states), [states]);
  const festivals = useMemo(
    () => withinReach(all, reach, { here: nearby.here, placeOf: nearby.placeOf, states, going }),
    [all, reach, nearby.here, nearby.placeOf, states, going],
  );
  const located = !!nearby.here;
  const where = reachWords(reach, nearby.units, located);
  const months = useMemo(() => calendarMonths(festivals, today), [festivals, today]);
  const [shown, setShown] = useState<Month | undefined>();
  const found = shown ? months.findIndex((m) => sameMonth(m, shown)) : 0;
  const index = Math.max(0, found);
  const month: Month = months[Math.min(index, months.length - 1)] ?? monthOf(today);
  const onDays = useMemo(() => monthFestivals(festivals, month), [festivals, month]);
  const inMonth = useMemo(() => [...new Set([...onDays.values()].flat())], [onDays]);
  const todayKey = dayKey(today.getFullYear(), today.getMonth(), today.getDate());
  const [picked, setPicked] = useState<string | undefined>();
  const day = picked && picked.startsWith(`${month.year}-${String(month.month + 1).padStart(2, '0')}`) ? picked : undefined;
  const listed: Festival[] = day ? (onDays.get(day) ?? []) : inMonth;
  // Club shows picked for you (never one carried only by an artist you turned down), within the same reach.
  const showTaste = useShowTaste();
  const showPicks = useMemo(
    () => showsInReach(rankShows(upcomingShows(catalog.shows, localDay(today)), showTaste, nearby.here).filter((r) => isForYou(r)), reach, located),
    [catalog.shows, today, showTaste, nearby.here, reach, located],
  );
  const showDays = useMemo(() => showsByDay(showPicks), [showPicks]);
  const monthKey = `${month.year}-${String(month.month + 1).padStart(2, '0')}`;
  const monthShows = useMemo(() => showPicks.filter((r) => r.show.date.startsWith(monthKey)), [showPicks, monthKey]);
  const listedShows = day ? (showDays.get(day) ?? []) : monthShows;
  const tone = (f: Festival) => (going.includes(f.id) ? GOING : lovedOn(f, loves) > 0 ? color.glow : color.moonDim);

  const flip = (by: number) => {
    const next = index + by;
    if (next < 0 || next >= months.length) return;
    haptic.select();
    setShown(months[next]);
    setPicked(undefined);
  };

  const jump = () => {
    if (months.length < 2) return;
    haptic.select();
    showActionSheet({ title: 'Go to a month', options: [...months.map((m) => monthTitle(m, today)), 'Cancel'], cancelButtonIndex: months.length }, (i) => {
      if (i < 0 || i >= months.length) return;
      setShown(months[i]);
      setPicked(undefined);
    });
  };

  const mode = reach.kind;
  const choose = (next: Reach) => {
    setReach(next);
    setPicked(undefined);
  };
  const pickMode = (k: Reach['kind']) => {
    if (k === mode) return;
    if (k === 'all') choose({ kind: 'all' });
    else if (k === 'near') choose({ kind: 'near', km: RADII[nearby.units][1] });
    else {
      const code = stateNear(nearby.here, all, states, nearby.placeOf) ?? stateList[0]?.code;
      choose(code ? { kind: 'state', code } : { kind: 'all' });
    }
  };

  return (
    <View style={styles.root}>
      <PageTitle title="Festivals & shows calendar" />
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Pressable onPress={() => flip(-1)} disabled={index === 0} accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={12} style={[styles.arrow, index === 0 && styles.off]}>
            <ChevronIcon color={color.moon} direction="left" size={16} />
          </Pressable>
          <Pressable
            onPress={jump}
            disabled={months.length < 2}
            accessibilityRole="button"
            accessibilityLabel={`${monthTitle(month, today)}, ${monthLine(inMonth.length, month, where)}`}
            accessibilityHint={months.length < 2 ? undefined : 'Go to another month'}
            style={styles.titleWrap}
          >
            <Text style={styles.title} accessibilityRole="header">
              {monthTitle(month, today)}
            </Text>
            <Text style={styles.sub}>{monthLine(inMonth.length, month, where)}</Text>
          </Pressable>
          <Pressable
            onPress={() => flip(1)}
            disabled={index >= months.length - 1}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            hitSlop={12}
            style={[styles.arrow, index >= months.length - 1 && styles.off]}
          >
            <ChevronIcon color={color.moon} direction="right" size={16} />
          </Pressable>
        </View>

        <View style={styles.reach}>
          <Tabs
            items={[
              { key: 'near', label: 'Near me' },
              { key: 'state', label: 'By state' },
              { key: 'all', label: 'Everywhere' },
            ]}
            value={mode}
            onChange={pickMode}
          />
        </View>
        {reach.kind === 'near' ? (
          located ? (
            <View style={styles.chipRow}>
              <FilterChips
                sticky
                inset={space.lg}
                value={String(Math.round(reach.km))}
                onChange={(k) => k && choose({ kind: 'near', km: Number(k) })}
                chips={RADII[nearby.units].map((km) => ({
                  key: String(Math.round(km)),
                  label: radiusLabel(km, nearby.units),
                  accessibilityLabel: `Within ${radiusLabel(km, nearby.units)}${nearby.hereLabel ? ` of ${nearby.hereLabel}` : ''}`,
                }))}
              />
            </View>
          ) : nearby.hydrated ? (
            <NearYouPrompt style={styles.prompt} />
          ) : null
        ) : reach.kind === 'state' ? (
          <View style={styles.chipRow}>
            <FilterChips
              sticky
              inset={space.lg}
              value={reach.code}
              onChange={(k) => k && choose({ kind: 'state', code: k })}
              chips={stateList.map((st) => ({ key: st.code, label: st.name, count: st.count, accessibilityLabel: `${st.name}, ${st.count} ${st.count === 1 ? 'festival' : 'festivals'}` }))}
            />
          </View>
        ) : null}

        <Animated.View key={`${month.year}-${month.month}`} entering={reduced ? undefined : FadeIn.duration(220)} style={styles.grid}>
          <View style={styles.week}>
            {WEEKDAY_LETTERS.map((l, i) => (
              <Text key={i} style={styles.weekday}>
                {l}
              </Text>
            ))}
          </View>
          {monthGrid(month).map((week, w) => (
            <View key={w} style={styles.week}>
              {week.map((key, i) => {
                if (!key) return <View key={i} style={styles.cell} />;
                const on = onDays.get(key) ?? [];
                const shows = showDays.get(key) ?? [];
                const chosen = key === day;
                const isToday = key === todayKey;
                const past = key < todayKey;
                const mine = on.some((f) => going.includes(f.id));
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      haptic.select();
                      setPicked(chosen ? undefined : key);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${Number(key.slice(8))} ${monthTitle(month, today)}${on.length ? `, ${on.map((f) => f.name).join(', ')}` : shows.length ? '' : ', nothing on'}${mine ? ', you’re going' : ''}${shows.length ? `, ${shows.length} ${shows.length === 1 ? 'show' : 'shows'} for you` : ''}`}
                    accessibilityState={{ selected: chosen }}
                    testID={`cal-${key}`}
                    style={[styles.cell, (on.length > 0 || shows.length > 0) && styles.cellOn, mine && styles.cellMine, chosen && styles.cellChosen, isToday && styles.cellToday]}
                  >
                    <Text style={[styles.num, past && styles.past, on.length > 0 && styles.numOn, chosen && styles.numChosen]}>{Number(key.slice(8))}</Text>
                    <View style={styles.dots}>
                      {on.slice(0, 3).map((f) => (
                        <View key={f.id} style={[styles.dot, { backgroundColor: chosen ? color.night : tone(f) }]} />
                      ))}
                      {shows.length > 0 ? <View style={[styles.ring, chosen && { borderColor: color.night }]} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Animated.View>

        <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.dot, { backgroundColor: GOING }]} />
          <Text style={styles.legendText}>Going</Text>
          <View style={[styles.dot, { backgroundColor: color.glow, marginLeft: space.md }]} />
          <Text style={styles.legendText}>Artists you’d love</Text>
          {showPicks.length > 0 ? (
            <>
              <View style={[styles.ring, { marginLeft: space.md }]} />
              <Text style={styles.legendText}>Shows for you</Text>
            </>
          ) : null}
        </View>

        <Text style={styles.section} accessibilityRole="header">
          {day ? `On ${Number(day.slice(8))} ${monthTitle(month, today)}` : `In ${monthTitle(month, today)}`}
        </Text>
        {listed.length ? (
          <View style={styles.rows}>
            {listed.map((f) => (
              <FestivalRow key={f.id} festival={f} />
            ))}
          </View>
        ) : listedShows.length ? (
          <Text style={styles.none}>{day ? 'No festivals that day.' : 'No festivals this month.'}</Text>
        ) : (
          <Text style={styles.none}>{day ? 'Nothing on that day yet.' : where ? 'Nothing here this month. Try a wider reach.' : 'New festivals arrive every night.'}</Text>
        )}
        {listedShows.length > 0 ? (
          <>
            <Text style={styles.section} accessibilityRole="header">
              Shows for you
            </Text>
            {(day ? listedShows : listedShows.slice(0, MONTH_SHOWS)).map((r) => (
              <ShowRow key={r.show.id} ranked={r} />
            ))}
            {!day && listedShows.length > MONTH_SHOWS ? (
              <Pressable
                onPress={() => {
                  haptic.select();
                  router.push('/shows');
                }}
                accessibilityRole="button"
                accessibilityLabel="See all shows"
                style={styles.back}
              >
                <Text style={styles.backText}>See all shows</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
        {sameMonth(month, monthOf(today)) ? null : (
          <Pressable
            onPress={() => {
              haptic.select();
              setShown(undefined);
              setPicked(undefined);
            }}
            accessibilityRole="button"
            style={styles.back}
          >
            <Text style={styles.backText}>Back to this month</Text>
          </Pressable>
        )}
      </ScrollView>
      <PageActions />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, marginBottom: space.md },
  reach: { marginHorizontal: space.lg },
  chipRow: { marginTop: space.md },
  prompt: { marginTop: space.md, marginBottom: 0, marginHorizontal: space.md },
  arrow: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glass },
  off: { opacity: 0.3 },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: { ...type.title, color: color.moon },
  sub: { ...type.caption, color: color.moonDim, marginTop: 2 },
  grid: { marginTop: space.md, marginHorizontal: space.md, padding: space.sm, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', ...type.caption, color: color.moonFaint, paddingVertical: space.xs },
  cell: { flex: 1, aspectRatio: 0.9, margin: 2, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  cellOn: { backgroundColor: glowA(0.1) },
  cellMine: { backgroundColor: 'rgba(255,154,213,0.14)' },
  cellChosen: { backgroundColor: color.glow },
  cellToday: { borderWidth: 1.5, borderColor: color.moon },
  num: { ...type.label, color: color.moonDim },
  past: { color: color.moonFaint },
  numOn: { color: color.moon },
  numChosen: { color: color.night },
  dots: { flexDirection: 'row', gap: 2, height: 6, marginTop: 3 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  ring: { width: 5, height: 5, borderRadius: 2.5, borderWidth: 1, borderColor: color.glow },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: space.xl, marginTop: space.md },
  legendText: { ...type.caption, color: color.moonDim },
  section: { ...type.headline, color: color.moon, paddingHorizontal: space.xl, marginTop: space.xl, marginBottom: space.sm },
  rows: { paddingHorizontal: space.xl },
  none: { ...type.body, color: color.moonDim, paddingHorizontal: space.xl },
  back: { alignSelf: 'center', marginTop: space.lg, padding: space.sm },
  backText: { ...type.label, color: color.glow },
});
