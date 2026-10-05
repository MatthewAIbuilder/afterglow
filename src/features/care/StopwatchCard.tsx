import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { type CareTimer, elapsed, type FeelingPoint, lastDose, type Mood } from './care';
import { FeelingGraph } from './FeelingGraph';
import { FeelingChips } from './feelings';
import { guideEntry, phaseAt, phaseMarks, stopwatchText, tooSoon, tooSoonLine } from './guide';

const AMBER = '#FFB86B';
const PINK = '#FF7EB6';
const MIN = 60_000;

/**
 * One stopwatch: a big running clock from when you started, when you last
 * took more, and (for something in the timing guide) a bar of where you
 * probably are, what that means, and the most important tip. "Took more"
 * asks first when it's too soon.
 */
export function StopwatchCard({
  timer,
  now,
  feelings,
  onTookMore,
  onStop,
  onFeel,
}: {
  timer: CareTimer;
  now: number;
  /** Your check-ins since this stopwatch started. */
  feelings: FeelingPoint[];
  onTookMore: () => void;
  onStop: () => void;
  onFeel: (m: Mood) => void;
}) {
  const [asking, setAsking] = useState(false);
  const entry = guideEntry(timer.guide);
  const last = lastDose(timer);
  const since = (now - last) / MIN;
  const phase = phaseAt(entry, since);
  const marks = entry ? phaseMarks(entry) : undefined;
  const name = timer.label || entry?.name || 'Stopwatch';
  const doses = timer.doses?.length ?? 0;

  const more = () => {
    const log = () => {
      haptic.tap();
      onTookMore();
    };
    if (tooSoon(entry, since))
      showAlert('Wait a bit longer?', tooSoonLine(entry, since), [
        { text: 'I’ll wait', style: 'cancel' },
        { text: 'Log it anyway', style: 'destructive', onPress: log },
      ]);
    else
      showAlert('Log taking more?', 'The stopwatch keeps running; the timing starts again from now.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log it', onPress: log },
      ]);
  };

  return (
    <View style={[styles.card, phase?.phase === 'after' && styles.cardDone]}>
      <View
        accessible
        accessibilityLabel={`${name}. ${elapsed(now - timer.startedAt)} since you started, at ${clock(timer.startedAt)}.${doses ? ` Took more ${doses} ${doses === 1 ? 'time' : 'times'}, last at ${clock(last)}.` : ''}${phase ? ` ${phase.title}. ${phase.line}` : ''}`}
      >
        <View style={styles.top}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {phase ? <Text style={[styles.phase, phase.phase === 'peak' && { color: PINK }, phase.phase === 'coming-up' && { color: AMBER }]}>{phase.title}</Text> : null}
        </View>
        <Text style={styles.clock}>{stopwatchText(now - timer.startedAt)}</Text>
        <Text style={styles.sub}>
          Started {clock(timer.startedAt)}
          {doses ? ` · took more at ${clock(last)}${doses > 1 ? ` (${doses} times)` : ''}` : ''}
        </Text>

        {phase && marks ? (
          <View style={styles.barWrap}>
            <View style={styles.bar}>
              <View style={[styles.seg, { flex: marks.onset, backgroundColor: 'rgba(255,255,255,0.12)' }]} />
              <View style={[styles.seg, { flex: marks.peak - marks.onset, backgroundColor: 'rgba(255,184,107,0.55)' }]} />
              <View style={[styles.seg, { flex: marks.end - marks.peak, backgroundColor: 'rgba(255,126,182,0.7)' }]} />
              <View style={[styles.seg, { flex: 1 - marks.end, backgroundColor: glowA(0.4) }]} />
            </View>
            <View style={[styles.marker, { left: `${Math.min(99, phase.progress * 100)}%` }]}>
              <LinearGradient colors={['#FFFFFF', '#E9DFFF']} style={styles.markerDot} />
            </View>
            <View style={styles.legend}>
              <Text style={styles.legendText}>Starts</Text>
              <Text style={styles.legendText}>Strongest</Text>
              <Text style={styles.legendText}>Wears off</Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.line}>{phase ? phase.line : 'Some things take up to 2 hours to start. Wait before taking any more.'}</Text>
        {entry?.tips[0] && phase?.phase !== 'after' ? <Text style={styles.tip}>{entry.tips[0]}</Text> : null}
      </View>

      {/* How you've felt since you started, against the time. */}
      <View style={styles.feel}>
        <View style={styles.feelHead}>
          <Text style={styles.feelTitle}>How you’ve felt</Text>
          <Pressable
            onPress={() => {
              haptic.select();
              setAsking((a) => !a);
            }}
            accessibilityRole="button"
            accessibilityLabel={asking ? 'Close' : `How do you feel now? Log it on ${name}`}
            hitSlop={8}
          >
            <Text style={styles.feelLink}>{asking ? 'Close' : '+ How do you feel now?'}</Text>
          </Pressable>
        </View>
        {asking ? (
          <FeelingChips
            compact
            onPick={(m) => {
              onFeel(m);
              setAsking(false);
            }}
          />
        ) : null}
        <FeelingGraph start={timer.startedAt} now={now} points={feelings} entry={entry} doses={timer.doses} />
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={more}
          accessibilityRole="button"
          accessibilityLabel={`I took more ${name}`}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>Took more</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            showAlert('Stop this stopwatch?', `${name}, started ${clock(timer.startedAt)}.`, [
              { text: 'Keep it', style: 'cancel' },
              { text: 'Stop', style: 'destructive', onPress: onStop },
            ])
          }
          accessibilityRole="button"
          accessibilityLabel={`Stop the ${name} stopwatch`}
          style={({ pressed }) => [styles.action, styles.stop, pressed && styles.pressed]}
        >
          <Text style={styles.stopText}>Stop</Text>
        </Pressable>
      </View>
    </View>
  );
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const styles = StyleSheet.create({
  card: {
    padding: space.lg,
    marginBottom: space.sm,
    gap: space.sm,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.45),
  },
  cardDone: { borderColor: color.hairline, opacity: 0.85 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { ...type.headline, color: color.moon, flex: 1 },
  phase: { ...type.label, color: color.glow },
  clock: { fontSize: 52, lineHeight: 58, fontWeight: '200', color: color.moon, fontVariant: ['tabular-nums'], letterSpacing: -1 },
  sub: { ...type.caption, color: color.moonDim },
  barWrap: { marginTop: space.sm },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 },
  seg: { height: 8 },
  marker: { position: 'absolute', top: -4, marginLeft: -8 },
  markerDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: color.night },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  legendText: { ...type.caption, fontSize: 11, color: color.moonFaint },
  line: { ...type.body, color: color.moon },
  tip: { ...type.caption, color: color.moonDim },
  feel: { marginTop: space.sm, paddingTop: space.md, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  feelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feelTitle: { ...type.label, color: color.moonDim },
  feelLink: { ...type.label, color: color.glow },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  action: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: glowA(0.18), borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.45) },
  actionText: { ...type.label, color: color.moon },
  stop: { backgroundColor: 'transparent', borderColor: color.hairline },
  stopText: { ...type.label, color: color.moonDim },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
