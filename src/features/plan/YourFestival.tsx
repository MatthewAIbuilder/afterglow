import { useMemo } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { ShareIcon } from '../../components/TabIcons';
import { APP_NAME } from '../../config/app';
import type { Festival } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { usePlan } from '../../state/plan';
import { useTaste } from '../../state/taste';
import { useToday } from '../../lib/useToday';
import { daysUntil } from '../festivals/when';
import { color, space, type } from '../../theme/tokens';
import { festivalNight } from './live';
import { LiveNow } from './LiveNow';
import { MustSeeList } from './MustSeeList';
import { buildSchedule, rankLineup } from './plan';
import { festivalRoute } from './route';
import { planText } from './share';
import { Timetable } from './Timetable';

/**
 * "Your festival": who to see, from your live taste. Before set times it is a
 * ranked must-see list; once they are out it becomes a day-by-day plan.
 */
export function YourFestival({ festival }: { festival: Festival }) {
  const { taste, informed } = useTaste();
  const { artists } = useCatalog();
  const { mustSeesAt } = usePlan();

  const picks = useMemo(
    () => rankLineup({ festival, artists, taste, informed, pinned: mustSeesAt(festival.id) }),
    [festival, artists, taste, informed, mustSeesAt],
  );
  const schedule = useMemo(() => (festival.sets?.length ? buildSchedule(festival, picks) : null), [festival, picks]);
  // Every day set to set, from the same live taste and must-sees.
  const route = useMemo(
    () => (festival.sets?.length ? festivalRoute({ festival, artists, taste, informed, pinned: mustSeesAt(festival.id) }) : undefined),
    [festival, artists, taste, informed, mustSeesAt],
  );
  const text = useMemo(() => planText(festival, picks, schedule, APP_NAME), [festival, picks, schedule]);
  // Only during the festival's days (and the morning after) is there anything live to show.
  const today = useToday();
  const until = daysUntil(festival, today);
  const maybeLive = !!schedule && until !== undefined && until <= 0 && until >= -festival.days.length;
  // During the festival the timetable opens on tonight.
  const tonight = maybeLive ? festivalNight(festival, today)?.day : undefined;

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Your festival</Text>
          {text ? (
            <Pressable
              onPress={() => {
                haptic.select();
                Share.share({ message: text }).catch(() => {});
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
        <Text style={styles.sub}>
          {schedule
            ? 'Your night, built from what you like, save, skip and rate. Star anyone you won’t miss.'
            : 'Who to see, ranked by what you like, save, skip and rate. When set times are out, this becomes your schedule.'}
        </Text>
      </View>
      {picks.length === 0 ? (
        <Text style={[styles.sub, styles.head]}>Like a few clips in Discover and your picks will show up here.</Text>
      ) : schedule ? (
        <>
          {maybeLive && <LiveNow festival={festival} schedule={schedule} />}
          <Timetable festival={festival} schedule={schedule} route={route} initialDay={tonight} />
        </>
      ) : (
        <MustSeeList festivalId={festival.id} picks={picks} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: space.xxl, marginHorizontal: space.lg },
  head: { paddingHorizontal: space.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { ...type.title, fontSize: 22, color: color.moon, flex: 1 },
  share: { padding: space.xs },
  sub: { ...type.body, color: color.moonDim, marginTop: space.xs },
});
