import { StyleSheet, Text, View } from 'react-native';
import { stageName } from '../../data/festival';
import type { Festival } from '../../data/types';
import { useNow } from '../../lib/useNow';
import { color, radius, space, type } from '../../theme/tokens';
import { formatTime } from '../festivals/format';
import { liveNow } from './live';
import type { Schedule, TimedPick } from './plan';

/**
 * During the festival, above your plan: what to watch right now and what's
 * next. Nothing outside the festival's nights.
 */
export function LiveNow({ festival, schedule }: { festival: Festival; schedule: Schedule }) {
  const now = useNow();
  const live = liveNow(festival, schedule, now);
  if (!live) return null;

  const names = (list: TimedPick[]) => list.map((p) => p.artist.name).join(' or ');
  const where = (p: TimedPick) => stageName(festival, p.set.stageId);
  const first = live.now[0];
  const nowLine = first
    ? `${live.nowIsDiscovery ? 'Something new · ' : ''}${live.now.length > 1 ? 'A close call, your pick' : where(first)}, until ${formatTime(first.set.end)}`
    : undefined;
  const upcoming = live.next?.[0];
  const nextLine = upcoming
    ? `${formatTime(upcoming.set.start)}  ${names(live.next!)}${live.next!.length > 1 ? '' : `, ${where(upcoming)}`}${live.nextIsDiscovery ? '  ·  something new' : ''}`
    : 'That’s everything on your plan tonight.';

  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={[
        `${live.night.day} night.`,
        first ? `On now: ${names(live.now)}. ${nowLine}.` : 'Nothing on your plan right now.',
        upcoming ? `Next: ${nextLine.replace(/ {2}/g, ', ')}.` : nextLine,
      ].join(' ')}
    >
      <View style={styles.head}>
        <View style={styles.dot} />
        <Text style={styles.label}>{`Now · ${live.night.day}`}</Text>
      </View>
      {first ? (
        <>
          <Text style={styles.name}>{names(live.now)}</Text>
          <Text style={styles.meta}>{nowLine}</Text>
        </>
      ) : (
        <Text style={styles.quiet}>Nothing on your plan right now.</Text>
      )}
      <View style={styles.divider} />
      <Text style={styles.nextLabel}>Next</Text>
      <Text style={styles.next}>{nextLine}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: space.lg,
    marginBottom: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(169,124,255,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.45)',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.glow },
  label: { ...type.label, color: color.glow, textTransform: 'uppercase', letterSpacing: 0.8 },
  name: { ...type.title, color: color.moon, marginTop: space.sm },
  meta: { ...type.body, color: color.moonDim, marginTop: 2 },
  quiet: { ...type.headline, color: color.moonDim, marginTop: space.sm },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: color.hairline, marginVertical: space.md },
  nextLabel: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8 },
  next: { ...type.body, color: color.moon, marginTop: 2, fontVariant: ['tabular-nums'] },
});
