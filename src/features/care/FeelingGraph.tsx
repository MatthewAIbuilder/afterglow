import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { color, space, type } from '../../theme/tokens';
import { elapsed, type FeelingPoint, MOOD_LABEL } from './care';
import { LEVEL_COLOR } from './feelings';
import type { GuideEntry } from './guide';

const MIN = 60_000;
const TICK_W = 36;
const HEIGHT = 96;
const PAD_Y = 10;
const AXIS_W = 54;

/**
 * How you felt over time on one stopwatch: each check-in a dot at its level
 * (great at the top, not great at the bottom), joined in order, against the
 * time since you started, with the usual timing window (waiting, coming up,
 * strongest, wearing off) shaded behind when it follows the guide, and a
 * line for now.
 */
export function FeelingGraph({ start, now, points, entry, doses }: { start: number; now: number; points: FeelingPoint[]; entry?: GuideEntry; doses?: number[] }) {
  const [width, setWidth] = useState(0);
  // The span: until now, at least the usual window (or two hours), a little room on the right.
  const spanMin = Math.max((now - start) / MIN, entry ? entry.total[1] : 120, 30) * 1.04;
  const x = (min: number) => (Math.max(0, min) / spanMin) * width;
  const y = (level: number) => PAD_Y + ((5 - level) / 4) * (HEIGHT - PAD_Y * 2);
  const at = points.map((p) => ({ ...p, min: (p.at - start) / MIN }));
  const nowX = x((now - start) / MIN);
  const hours = Math.floor(spanMin / 60);
  const step = hours > 6 ? 2 : 1;
  const summary = points.length
    ? `How you felt since you started: ${at.map((p) => `${elapsed(p.at - start)} in, ${MOOD_LABEL[p.mood].toLowerCase()}`).join('; ')}.`
    : 'No check-ins on this stopwatch yet.';
  return (
    <View accessible accessibilityLabel={summary}>
      <View style={styles.row}>
      <View style={styles.axis}>
        <Text style={styles.axisText}>Great</Text>
        <Text style={styles.axisText}>Okay</Text>
        <Text style={styles.axisText}>Not great</Text>
      </View>
      <View style={styles.chart} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width ? (
          <Svg width={width} height={HEIGHT}>
            {entry ? (
              <>
                <Rect x={x(entry.onset[0])} y={0} width={Math.max(0, x(entry.onset[1]) - x(entry.onset[0]))} height={HEIGHT} fill="rgba(255,184,107,0.10)" />
                <Rect x={x(entry.onset[1])} y={0} width={Math.max(0, x(entry.peak[1]) - x(entry.onset[1]))} height={HEIGHT} fill="rgba(255,126,182,0.13)" />
                <Rect x={x(entry.peak[1])} y={0} width={Math.max(0, x(entry.total[1]) - x(entry.peak[1]))} height={HEIGHT} fill="rgba(169,124,255,0.10)" />
              </>
            ) : null}
            {[1, 3, 5].map((l) => (
              <Line key={l} x1={0} x2={width} y1={y(l)} y2={y(l)} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
            ))}
            {(doses ?? []).map((d) => (
              <Rect key={d} x={x((d - start) / MIN) - 1.5} y={HEIGHT - 10} width={3} height={10} rx={1.5} fill="#FF7EB6" />
            ))}
            <Line x1={nowX} x2={nowX} y1={0} y2={HEIGHT} stroke="rgba(255,255,255,0.45)" strokeWidth={1} strokeDasharray="3 3" />
            {at.length > 1 ? (
              <Polyline points={at.map((p) => `${x(p.min)},${y(p.level)}`).join(' ')} fill="none" stroke="rgba(233,223,255,0.55)" strokeWidth={2} strokeLinejoin="round" />
            ) : null}
            {at.map((p) => (
              <Circle key={p.at} cx={x(p.min)} cy={y(p.level)} r={5} fill={LEVEL_COLOR[p.level]} stroke={color.night} strokeWidth={2} />
            ))}
          </Svg>
        ) : (
          <View style={{ height: HEIGHT }} />
        )}
      </View>
      </View>
      <View style={[styles.ticks, { marginLeft: AXIS_W }]}>
        {Array.from({ length: Math.floor(hours / step) + 1 }, (_, i) => i * step).map((h) => (
          <Text key={h} numberOfLines={1} style={[styles.tick, x(h * 60) > width - TICK_W / 2 ? { left: x(h * 60) - TICK_W, textAlign: 'right' } : h ? { left: x(h * 60) - TICK_W / 2, textAlign: 'center' } : { left: 0 }]}>
            {h ? `${h} h` : 'Start'}
          </Text>
        ))}
      </View>
      {!points.length ? <Text style={styles.empty}>Log how you feel and it shows here against the time.</Text> : null}
      {entry || doses?.length ? (
        <View style={styles.legend}>
          {entry ? (
            <>
              <Key fill="rgba(255,184,107,0.45)" label="Coming up" />
              <Key fill="rgba(255,126,182,0.5)" label="Strongest" />
              <Key fill="rgba(169,124,255,0.45)" label="Wearing off" />
            </>
          ) : null}
          {doses?.length ? <Key fill="#FF7EB6" label="Took more" thin /> : null}
        </View>
      ) : null}
    </View>
  );
}

function Key({ fill, label, thin }: { fill: string; label: string; thin?: boolean }) {
  return (
    <View style={styles.key}>
      <View style={[styles.swatch, { backgroundColor: fill }, thin && styles.swatchThin]} />
      <Text style={styles.keyText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.xs, marginLeft: AXIS_W },
  key: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  swatchThin: { width: 3, borderRadius: 1.5 },
  keyText: { ...type.caption, fontSize: 11, color: color.moonFaint },
  row: { flexDirection: 'row' },
  axis: { width: AXIS_W, height: HEIGHT, justifyContent: 'space-between', paddingVertical: PAD_Y - 6 },
  axisText: { ...type.caption, fontSize: 10, color: color.moonFaint },
  chart: { flex: 1, height: HEIGHT, borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)' },
  ticks: { height: 16, marginTop: 4 },
  tick: { ...type.caption, fontSize: 10, color: color.moonFaint, position: 'absolute', width: TICK_W },
  empty: { ...type.caption, color: color.moonFaint, marginTop: space.xs, marginLeft: AXIS_W },
});
