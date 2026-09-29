import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Festival } from '../../data/types';
import { useCatalog } from '../../state/catalog';
import { usePlan } from '../../state/plan';
import { useTaste } from '../../state/taste';
import { color, space, type } from '../../theme/tokens';
import { MustSeeList } from './MustSeeList';
import { buildSchedule, rankLineup } from './plan';
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

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.title}>Your festival</Text>
        <Text style={styles.sub}>
          {schedule
            ? 'Your night, built from what you like, save, skip and rate. Star anyone you won’t miss.'
            : 'Who to see, ranked by what you like, save, skip and rate. When set times are out, this becomes your schedule.'}
        </Text>
      </View>
      {picks.length === 0 ? (
        <Text style={[styles.sub, styles.head]}>Like a few clips in Discover and your picks will show up here.</Text>
      ) : schedule ? (
        <Timetable festival={festival} schedule={schedule} />
      ) : (
        <MustSeeList festivalId={festival.id} picks={picks} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: space.xxl, marginHorizontal: space.lg },
  head: { paddingHorizontal: space.sm },
  title: { ...type.title, fontSize: 22, color: color.moon },
  sub: { ...type.body, color: color.moonDim, marginTop: space.xs },
});
