import { StyleSheet, Text, View } from 'react-native';
import type { Festival } from '../../data/types';
import { useTaste } from '../../state/taste';
import { color, radius, space, type } from '../../theme/tokens';
import { picksByDay } from './byDay';
import { exploreLine, TIER_LABEL } from './copy';
import { PickRow } from './MustSeeList';
import { exploreReason, type Pick } from './plan';

/**
 * Before set times, when the poster says who plays which day: your picks day
 * by day, with a few to explore under each. Once set times are out this
 * becomes the full-day route.
 */
export function ByDayList({ festival, picks }: { festival: Festival; picks: Pick[] }) {
  const { similarity } = useTaste();
  const { days, noDay } = picksByDay(festival, picks);
  return (
    <View>
      {days.map((d) => (
        <View key={d.day} style={styles.day}>
          <View style={styles.head}>
            <Text style={styles.dayName}>{d.day}</Text>
            <Text style={styles.count}>
              {d.planned.length ? `${d.planned.length} for you` : 'Nothing you love yet'}
            </Text>
          </View>
          {d.planned.map((p) => (
            <PickRow key={p.artist.id} festivalId={festival.id} pick={p} note={p.pinned ? 'You starred this one.' : TIER_LABEL[p.tier]} />
          ))}
          {d.explore.length > 0 && (
            <>
              <Text style={styles.sub}>Worth a look</Text>
              {d.explore.map((p) => (
                <PickRow
                  key={p.artist.id}
                  festivalId={festival.id}
                  pick={p}
                  note={exploreLine(exploreReason(p, picks, similarity))}
                />
              ))}
            </>
          )}
        </View>
      ))}
      {noDay.length > 0 && (
        <View style={styles.day}>
          <View style={styles.head}>
            <Text style={styles.dayName}>Day to come</Text>
          </View>
          {noDay.map((p) => (
            <PickRow key={p.artist.id} festivalId={festival.id} pick={p} note={TIER_LABEL[p.tier]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  day: {
    marginTop: space.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.xs,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  dayName: { ...type.headline, color: color.moon },
  count: { ...type.caption, color: color.glow },
  sub: { ...type.caption, color: color.moonFaint, marginTop: space.sm },
});
