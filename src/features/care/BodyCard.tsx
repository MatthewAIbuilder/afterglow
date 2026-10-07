import { Pedometer } from 'expo-sensors';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type } from '../../theme/tokens';
import { unitsFor } from '../festivals/near';
import { bpmFromTaps, currentTaps, PULSE_ROUNDS, PULSE_TAPS, pulseAverage, pulseNote, stepsLine } from './body';
import { nightStart } from './care';

const locale = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
};

/**
 * Your body tonight: steps from the phone's own motion counter (asked for
 * only when you tap), a pulse check you tap along to, and where heart rate
 * from Apple Health will go. Nothing leaves the phone.
 */
export function BodyCard({ now }: { now: number }) {
  return (
    <View style={styles.wrap}>
      {Platform.OS !== 'web' ? <Steps now={now} /> : null}
      <Pulse now={now} />
      <View style={styles.soon} accessible accessibilityLabel={t('Heart rate from Apple Health comes with the full version of the app.')}>
        <Text style={styles.soonTitle}>{t('Heart rate from your watch')}</Text>
        <Text style={styles.soonBody}>{t('Comes with the full version of the app, through Apple Health. Until then, check your pulse above.')}</Text>
      </View>
    </View>
  );
}

type StepsState = { kind: 'checking' } | { kind: 'ask' } | { kind: 'off' } | { kind: 'on'; base: number; live: number; since: 'tonight' | 'open' };

function Steps({ now }: { now: number }) {
  const [state, setState] = useState<StepsState>({ kind: 'checking' });
  const [asked, setAsked] = useState(0);
  const miles = unitsFor(locale()) === 'mi';
  const night = nightStart(now);

  useEffect(() => {
    let live = true;
    let sub: { remove: () => void } | undefined;
    (async () => {
      try {
        if (!(await Pedometer.isAvailableAsync())) return live && setState({ kind: 'off' });
        const perm = await Pedometer.getPermissionsAsync();
        if (!perm.granted) return live && setState(perm.canAskAgain ? { kind: 'ask' } : { kind: 'off' });
        // iPhone can say how many since tonight began; Android only counts from now.
        let base = 0;
        let since: 'tonight' | 'open' = 'open';
        if (Platform.OS === 'ios') {
          base = (await Pedometer.getStepCountAsync(new Date(night), new Date())).steps;
          since = 'tonight';
        }
        if (!live) return;
        setState({ kind: 'on', base, live: 0, since });
        sub = Pedometer.watchStepCount((r) => live && setState((s) => (s.kind === 'on' ? { ...s, live: r.steps } : s)));
      } catch {
        if (live) setState({ kind: 'off' });
      }
    })();
    return () => {
      live = false;
      sub?.remove();
    };
  }, [night, asked]);

  if (state.kind === 'checking' || state.kind === 'off') return null;
  if (state.kind === 'ask')
    return (
      <Pressable
        onPress={() => {
          haptic.select();
          void Pedometer.requestPermissionsAsync()
            .catch(() => undefined)
            .then(() => setAsked((n) => n + 1));
        }}
        accessibilityRole="button"
        accessibilityLabel={t("Count my steps tonight. Uses the phone's motion counter; nothing leaves the phone.")}
        style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      >
        <Text style={styles.label}>{t('Steps tonight')}</Text>
        <Text style={styles.ask}>{t('Count my steps')}</Text>
        <Text style={styles.small}>{t('From your phone’s motion counter. Stays on this phone.')}</Text>
      </Pressable>
    );
  const steps = state.base + state.live;
  return (
    <View style={styles.tile} accessible accessibilityLabel={state.since === 'tonight' ? t('Steps tonight: {steps}', { steps: stepsLine(steps, miles) }) : t('Steps since you opened this page: {steps}', { steps: stepsLine(steps, miles) })}>
      <Text style={styles.label}>{state.since === 'tonight' ? t('Steps tonight') : t('Steps since you opened this')}</Text>
      <Text style={styles.big}>{steps.toLocaleString('en-US')}</Text>
      <Text style={styles.small}>{t('{distance}. Rest your feet now and then.', { distance: stepsLine(steps, miles).split(' · ')[1] })}</Text>
    </View>
  );
}

function Pulse({ now }: { now: number }) {
  const [taps, setTaps] = useState<number[]>([]);
  // One reading per round; three make the result.
  const [readings, setReadings] = useState<number[]>([]);
  const done = readings.length >= PULSE_ROUNDS;
  const counting = done ? 0 : currentTaps(taps, now).length;
  const avg = pulseAverage(readings);
  const note = done && avg ? pulseNote(avg.bpm) : undefined;

  const tap = () => {
    if (done) return;
    haptic.select();
    const t = Date.now();
    const next = currentTaps([...taps, t], t);
    const bpm = bpmFromTaps(next);
    if (bpm) {
      // A reading: on to the next round, starting fresh.
      haptic.settle();
      setReadings((r) => [...r, bpm]);
      setTaps([]);
    } else setTaps(next);
  };
  const again = () => {
    haptic.select();
    setTaps([]);
    setReadings([]);
  };

  return (
    <View style={styles.tile}>
      <View style={styles.head}>
        <Text style={styles.label}>{t('Check your pulse')}</Text>
        {readings.length ? (
          <Pressable onPress={again} accessibilityRole="button" accessibilityLabel={t('Check your pulse again from the start')} hitSlop={8}>
            <Text style={styles.link}>{t('Check again')}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.small}>
        {done
          ? t('Average of {n} readings.', { n: PULSE_ROUNDS })
          : t('Find it on your wrist or neck, then tap the heart with each beat. {n} short readings make it more accurate.', { n: PULSE_ROUNDS })}
      </Text>
      <View style={styles.pulseRow}>
        <Pressable
          onPress={tap}
          disabled={done}
          accessibilityRole="button"
          accessibilityLabel={done ? t('Pulse checked') : t('Tap with each heartbeat. Reading {n} of {total}', { n: readings.length + 1, total: PULSE_ROUNDS })}
          accessibilityHint={done ? undefined : t('Tap at least {n} times in time with your pulse', { n: PULSE_TAPS })}
          style={({ pressed }) => [styles.heart, done && styles.heartDone, pressed && { transform: [{ scale: 0.92 }] }]}
        >
          <Text style={styles.heartText}>♥</Text>
        </Pressable>
        <View style={{ flex: 1, gap: 4 }} accessibilityLiveRegion="polite">
          {done && avg ? (
            <>
              <Text style={styles.big}>
                {avg.bpm} <Text style={styles.unit}>{t('beats a minute')}</Text>
              </Text>
              <Text style={[styles.small, note?.tone === 'help' && styles.danger, note?.tone === 'watch' && styles.amber]}>{note?.line}</Text>
              {!avg.steady ? <Text style={styles.small}>{t('Your readings were quite far apart. Sit still for a minute and check again.')}</Text> : null}
            </>
          ) : (
            <>
              <Text style={styles.round}>{t('Reading {n} of {total}', { n: readings.length + 1, total: PULSE_ROUNDS })}</Text>
              <View style={styles.taps} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {Array.from({ length: PULSE_TAPS }, (_, i) => (
                  <View key={i} style={[styles.tapDot, i < counting && styles.tapDotOn]} />
                ))}
              </View>
              <Text style={styles.small}>{counting ? t('{n} of {total} taps…', { n: counting, total: PULSE_TAPS }) : readings.length ? t('Now again, in time with your pulse.') : t('Ready when you are.')}</Text>
            </>
          )}
          {readings.length ? (
            <View style={styles.readings}>
              {readings.map((r, i) => (
                <Text key={i} style={styles.reading}>
                  {r}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  tile: { padding: space.lg, gap: space.xs, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  label: { ...type.label, color: color.moonDim },
  big: { ...type.largeTitle, color: color.moon, fontVariant: ['tabular-nums'] },
  unit: { ...type.body, color: color.moonDim },
  small: { ...type.caption, color: color.moonDim },
  ask: { ...type.headline, color: color.glow, marginTop: space.xs },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.sm },
  heart: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,126,182,0.22)', borderWidth: 1, borderColor: 'rgba(255,126,182,0.6)' },
  heartText: { fontSize: 30, color: '#FF7EB6' },
  heartDone: { opacity: 0.5 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { ...type.label, color: color.glow },
  round: { ...type.headline, color: color.moon },
  taps: { flexDirection: 'row', gap: 5 },
  tapDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.12)' },
  tapDotOn: { backgroundColor: '#FF7EB6' },
  readings: { flexDirection: 'row', gap: space.sm },
  reading: { ...type.caption, color: color.moonDim, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  danger: { color: 'rgba(255,150,150,0.95)' },
  amber: { color: '#FFB86B' },
  soon: { padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', borderColor: color.hairline },
  soonTitle: { ...type.label, color: color.moonDim },
  soonBody: { ...type.caption, color: color.moonFaint, marginTop: 2 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
