import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { ShareIcon } from '../../components/TabIcons';
import type { Festival } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { useToday } from '../../lib/useToday';
import { lineupDays } from '../festivals/days';
import { isLive } from '../festivals/when';
import { setTimesExpected } from '../festivals/setTimes';
import { useGoing } from '../../state/going';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { festivalNight } from './live';
import { LiveNow } from './LiveNow';
import { ByDayList } from './ByDayList';
import { MustSeeList } from './MustSeeList';
import { Timetable } from './Timetable';
import { useFestivalPlan } from './useFestivalPlan';
import { warmupLine, warmupPlaylist } from './warmup';
import { PlayIcon } from '../discover/icons';
import { useCatalog } from '../../state/catalog';

/**
 * "Your festival": who to see, from your live taste. Before set times it is a
 * ranked must-see list; once they are out it becomes a day-by-day plan.
 */
export function YourFestival({ festival }: { festival: Festival }) {
  const { picks, schedule, route, text } = useFestivalPlan(festival);
  // Only during the festival's days (and the morning after) is there anything live to show.
  const today = useToday();
  const maybeLive = !!schedule && isLive(festival, today);
  // During the festival the timetable opens on tonight.
  const tonight = maybeLive ? festivalNight(festival, today)?.day : undefined;
  // Before set times, when the poster says who plays which day: your picks by day, or ranked.
  const byDayPossible = !schedule && lineupDays(festival).length > 0;
  const [byDay, setByDay] = useState(true);
  // Live sets from the artists you'd love here, as one YouTube playlist.
  const { clipsOf } = useCatalog();
  const warmup = useMemo(() => warmupPlaylist(picks, clipsOf), [picks, clipsOf]);
  // Before set times: roughly when to expect them.
  const { isGoing } = useGoing();
  const expected = schedule ? undefined : setTimesExpected(festival, today, isGoing(festival.id));

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text style={[styles.sub, { flex: 1 }]}>
            {schedule ? 'Your night, set to set. Star anyone you won’t miss.' : 'Ranked by what you like and rate. It turns into your schedule when set times are out.'}
          </Text>
          {text ? (
            <Pressable
              onPress={() => {
                haptic.select();
                // A picture of your plan to share, or the plain text.
                router.push(`/plan-card/${festival.id}`);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Share your plan for ${festival.name}`}
              hitSlop={10}
              style={({ pressed }) => [styles.share, pressed && { opacity: 0.6 }]}
            >
              <ShareIcon color={color.moonDim} />
            </Pressable>
          ) : null}
        </View>
        {expected ? <Text style={styles.expected}>{expected}</Text> : null}
        {/* Fans often see set times first: they can send them in, for HQ to check and publish. */}
        {!festival.sets?.length && (expected || isLive(festival, today)) ? (
          <Pressable
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/send-set-times/[id]', params: { id: festival.id } });
            }}
            accessibilityRole="button"
            accessibilityLabel={`Seen the set times for ${festival.name}? Send them to us`}
            hitSlop={6}
            style={({ pressed }) => [styles.tipLink, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.tipText}>Seen the set times? Send them to us</Text>
          </Pressable>
        ) : null}
        {warmup ? (
          <Pressable
            onPress={() => {
              haptic.tap();
              void Linking.openURL(warmup.url).catch(() => {});
            }}
            accessibilityRole="link"
            accessibilityLabel={`Warm-up playlist: live sets from ${warmupLine(warmup)}. Opens YouTube.`}
            style={({ pressed }) => [styles.warmup, pressed && { opacity: 0.75, transform: [{ scale: 0.99 }] }]}
          >
            <View style={styles.warmupIcon}>
              <PlayIcon color={color.moon} size={13} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.warmupTitle}>Warm-up playlist</Text>
              <Text style={styles.warmupSub} numberOfLines={1}>
                {warmup.artists.length} live sets · {warmupLine(warmup)}
              </Text>
            </View>
            <Text style={styles.warmupGo}>YouTube ↗</Text>
          </Pressable>
        ) : null}
      </View>
      {picks.length === 0 ? (
        <Text style={[styles.sub, styles.head]}>Like a few clips in Discover and your picks will show up here.</Text>
      ) : schedule ? (
        <>
          {maybeLive && <LiveNow festival={festival} schedule={schedule} route={route} />}
          <Timetable festival={festival} schedule={schedule} route={route} initialDay={tonight} />
        </>
      ) : byDayPossible ? (
        <>
          <Toggle byDay={byDay} onChange={setByDay} />
          {byDay ? <ByDayList festival={festival} picks={picks} /> : <MustSeeList festivalId={festival.id} picks={picks} />}
        </>
      ) : (
        <MustSeeList festivalId={festival.id} picks={picks} />
      )}
    </View>
  );
}

/** By day (from the poster) or ranked by match. */
function Toggle({ byDay, onChange }: { byDay: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle} accessibilityRole="tablist">
      {[
        { on: byDay, label: 'By day', value: true },
        { on: !byDay, label: 'Ranked', value: false },
      ].map((o) => (
        <Pressable
          key={o.label}
          accessibilityRole="tab"
          accessibilityState={{ selected: o.on }}
          accessibilityLabel={o.value ? 'Your picks by day' : 'Your picks ranked by match'}
          onPress={() => {
            if (o.on) return;
            haptic.select();
            onChange(o.value);
          }}
          style={[styles.toggleItem, o.on && styles.toggleOn]}
        >
          <Text style={[styles.toggleText, o.on && { color: color.moon }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  expected: { ...type.caption, color: color.glow, marginTop: space.sm },
  tipLink: { alignSelf: 'flex-start', marginTop: space.xs },
  tipText: { ...type.caption, color: color.moonDim, textDecorationLine: 'underline' },
  toggle: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    marginTop: space.lg,
  },
  toggleItem: { paddingHorizontal: space.lg, paddingVertical: 6, borderRadius: radius.pill },
  toggleOn: { backgroundColor: glowA(0.22) },
  toggleText: { ...type.label, color: color.moonDim },
  root: { marginTop: space.lg, marginHorizontal: space.lg },
  head: { paddingHorizontal: space.sm },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  share: { padding: space.xs },
  warmup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  warmupIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glowDeep },
  warmupTitle: { ...type.label, color: color.moon },
  warmupSub: { ...type.caption, color: color.moonDim, marginTop: 2 },
  warmupGo: { ...type.caption, color: color.glow },
  sub: { ...type.body, color: color.moonDim, marginTop: space.xs },
});
