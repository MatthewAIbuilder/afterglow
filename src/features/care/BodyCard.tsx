import { Pedometer } from 'expo-sensors';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type } from '../../theme/tokens';
import { unitsFor } from '../festivals/near';
import { bpmFromTaps, currentTaps, PULSE_TAPS, pulseNote, stepsLine } from './body';
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
      <View style={styles.soon} accessible accessibilityLabel="Heart rate from Apple Health comes with the full version of the app.">
        <Text style={styles.soonTitle}>Heart rate from your watch</Text>
        <Text style={styles.soonBody}>Comes with the full version of the app, through Apple Health. Until then, check your pulse above.</Text>
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
        accessibilityLabel="Count my steps tonight. Uses the phone's motion counter; nothing leaves the phone."
        style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      >
        <Text style={styles.label}>Steps tonight</Text>
        <Text style={styles.ask}>Count my steps</Text>
        <Text style={styles.small}>From your phone’s motion counter. Stays on this phone.</Text>
      </Pressable>
    );
  const steps = state.base + state.live;
  return (
    <View style={styles.tile} accessible accessibilityLabel={`Steps ${state.since === 'tonight' ? 'tonight' : 'since you opened this page'}: ${stepsLine(steps, miles)}`}>
      <Text style={styles.label}>{state.since === 'tonight' ? 'Steps tonight' : 'Steps since you opened this'}</Text>
      <Text style={styles.big}>{steps.toLocaleString('en-US')}</Text>
      <Text style={styles.small}>{stepsLine(steps, miles).split(' · ')[1]}. Rest your feet now and then.</Text>
    </View>
  );
}

function Pulse({ now }: { now: number }) {
  const [taps, setTaps] = useState<number[]>([]);
  const [result, setResult] = useState<number | undefined>();
  const counting = currentTaps(taps, now).length;

  const tap = () => {
    haptic.select();
    const t = Date.now();
    const next = currentTaps([...taps, t], t);
    setTaps(next);
    const bpm = bpmFromTaps(next);
    if (bpm) setResult(bpm);
  };
  const note = result ? pulseNote(result) : undefined;

  return (
    <View style={styles.tile}>
      <Text style={styles.label}>Check your pulse</Text>
      <Text style={styles.small}>Find it on your wrist or neck, then tap the circle with each beat for about 10 seconds.</Text>
      <View style={styles.pulseRow}>
        <Pressable
          onPress={tap}
          accessibilityRole="button"
          accessibilityLabel="Tap with each heartbeat"
          accessibilityHint={`Tap at least ${PULSE_TAPS} times in time with your pulse`}
          style={({ pressed }) => [styles.heart, pressed && { transform: [{ scale: 0.92 }] }]}
        >
          <Text style={styles.heartText}>♥</Text>
        </Pressable>
        <View style={{ flex: 1 }} accessibilityLiveRegion="polite">
          {result ? (
            <>
              <Text style={styles.big}>
                {result} <Text style={styles.unit}>beats a minute</Text>
              </Text>
              <Text style={[styles.small, note?.tone === 'help' && styles.danger, note?.tone === 'watch' && styles.amber]}>{note?.line}</Text>
            </>
          ) : (
            <Text style={styles.small}>{counting ? `${counting} of ${PULSE_TAPS} taps…` : 'Ready when you are.'}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  tile: { padding: space.lg, gap: space.xs, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  label: { ...type.label, color: color.moonDim },
  big: { ...type.largeTitle, color: color.moon, fontVariant: ['tabular-nums'] },
  unit: { ...type.body, color: color.moonDim },
  small: { ...type.caption, color: color.moonDim },
  ask: { ...type.headline, color: color.glow, marginTop: space.xs },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.sm },
  heart: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,126,182,0.22)', borderWidth: 1, borderColor: 'rgba(255,126,182,0.6)' },
  heartText: { fontSize: 30, color: '#FF7EB6' },
  danger: { color: 'rgba(255,150,150,0.95)' },
  amber: { color: '#FFB86B' },
  soon: { padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', borderColor: color.hairline },
  soonTitle: { ...type.label, color: color.moonDim },
  soonBody: { ...type.caption, color: color.moonFaint, marginTop: 2 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
