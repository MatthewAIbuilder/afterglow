import { StyleSheet, Text, View } from 'react-native';
import { color, radius, space, type } from '../../theme/tokens';
import { type Care, elapsed, feelingsBetween, HELP_MOODS, lastFeeling, type Mood, MOOD_LABEL, MOOD_LEVEL, MOOD_TIP, nightStart } from './care';
import { FeelingGraph } from './FeelingGraph';
import { FeelingChips, moodColor } from './feelings';
import { CareButtons } from '../crews/CareButtons';
import { careFor } from '../crews/care';

const MIN = 60_000;
/** After a check-in, telling your crew is offered for this long. */
const CREW_OFFER_MS = 30 * MIN;

/**
 * How are you feeling: the feelings to pick from, what to do about the one
 * you picked last, and tonight so far as a little graph once you've checked
 * in twice. Check in now and then: it's the quickest way to notice things
 * changing.
 */
export function FeelingCard({ care, now, onFeel, crewFestival }: { care: Care; now: number; onFeel: (m: Mood) => void; crewFestival?: string }) {
  const last = lastFeeling(care, now);
  const tonight = feelingsBetween(care, nightStart(now), now);
  const careful = last && HELP_MOODS.includes(last.mood);
  const since = last ? now - last.at : undefined;
  const stale = since !== undefined && since > 45 * MIN;
  return (
    <View style={styles.card}>
      {last ? (
        <View style={[styles.now, careful && styles.nowCareful]} accessible accessibilityLabel={`Last check-in: ${MOOD_LABEL[last.mood]}, ${elapsed(now - last.at)} ago. ${MOOD_TIP[last.mood]}`}>
          <View style={styles.nowHead}>
            <View style={[styles.dot, { backgroundColor: moodColor(last.mood) }]} />
            <Text style={styles.nowTitle}>{MOOD_LABEL[last.mood]}</Text>
            <Text style={styles.nowWhen}>{elapsed(now - last.at) === 'Just now' ? 'just now' : `${elapsed(now - last.at)} ago`}</Text>
          </View>
          <Text style={styles.tip}>{MOOD_TIP[last.mood]}</Text>
        </View>
      ) : (
        <Text style={styles.intro}>Check in now and then. It’s the quickest way to notice when things change, for you or a friend.</Text>
      )}
      {/* Just checked in, with a crew here: offer to tell them (never automatic). */}
      {crewFestival && last && since !== undefined && since < CREW_OFFER_MS ? (
        <View style={styles.crew}>
          <Text style={styles.crewTitle}>Tell your crew?</Text>
          <CareButtons festivalId={crewFestival} only={careFor(MOOD_LEVEL[last.mood])} />
        </View>
      ) : null}
      {stale ? <Text style={styles.nudge}>It’s been a while. How are you now?</Text> : null}
      <FeelingChips onPick={onFeel} current={since !== undefined && since < 2 * MIN ? last?.mood : undefined} />
      {tonight.length >= 2 ? (
        <View style={styles.graph}>
          <Text style={styles.graphTitle}>Tonight so far</Text>
          <FeelingGraph start={tonight[0].at - 10 * MIN} now={now} points={tonight} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.md, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(169,124,255,0.4)' },
  intro: { ...type.body, color: color.moonDim },
  now: { padding: space.md, gap: space.xs, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.05)' },
  nowCareful: { backgroundColor: 'rgba(255,120,120,0.1)', borderWidth: 1, borderColor: 'rgba(255,140,140,0.35)' },
  nowHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 12, height: 12, borderRadius: 6 },
  nowTitle: { ...type.headline, color: color.moon, flex: 1 },
  nowWhen: { ...type.caption, color: color.moonFaint },
  tip: { ...type.body, color: color.moonDim },
  nudge: { ...type.label, color: '#FFB86B' },
  graph: { gap: space.xs, marginTop: space.xs },
  crew: { gap: space.sm },
  crewTitle: { ...type.label, color: color.moonDim },
  graphTitle: { ...type.label, color: color.moonDim },
});
