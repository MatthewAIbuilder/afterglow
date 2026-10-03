import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { color, radius, space, type } from '../../theme/tokens';
import type { DayCount } from './admin';
import type { Bucket, Cohort, Share } from './metrics';
import { hourLabel } from './metrics';

/**
 * The dashboard's building blocks: number tiles, day-by-day bars you can
 * tap for a day's figure, a running-total line, share bars, an hour-of-day
 * strip, ranked lists and the comeback table. One glow colour throughout
 * (every chart has one series); words stay in the text colours.
 */

const GOLD = '#FFE38A';
const AMBER = '#FFB86B';
const fmt = (n: number) => n.toLocaleString('en-US');

export function Section({ title, note }: { title: string; note?: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
    </View>
  );
}

export function Tiles({ children }: { children: React.ReactNode }) {
  return <View style={styles.tiles}>{children}</View>;
}

/** A big number with a label and an optional line under it ("▲ 12% vs the 30 days before"). */
export function Tile({ label, value, sub, tone, suffix }: { label: string; value: number | string | undefined; sub?: string; tone?: 'glow' | 'gold' | 'warn'; suffix?: string }) {
  const shown = value === undefined ? '–' : typeof value === 'number' ? fmt(value) : value;
  return (
    <View style={[styles.tile, tone === 'glow' && styles.tileGlow, tone === 'gold' && styles.tileGold, tone === 'warn' && styles.tileWarn]} accessible accessibilityLabel={`${label}: ${shown}${suffix ?? ''}${sub ? `. ${sub}` : ''}`}>
      <Text style={styles.tileLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.tileValue, tone === 'gold' && { color: GOLD }]} numberOfLines={1} adjustsFontSizeToFit>
        {shown}
        {suffix && value !== undefined ? <Text style={styles.tileSuffix}>{suffix}</Text> : null}
      </Text>
      {sub ? (
        <Text style={[styles.tileSub, sub.startsWith('▼') && { color: AMBER }]} numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

function Card({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <View style={styles.card} accessible={!!label} accessibilityLabel={label}>
      {children}
    </View>
  );
}

/**
 * One bar a day, today on the right. Tap (or drag across) to read a day's
 * figure in the header; otherwise the header shows the total (or, for a
 * running total, the latest).
 */
export function Bars({ title, days, total = 'sum', note }: { title: string; days: DayCount[]; total?: 'sum' | 'last'; note?: string }) {
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | undefined>();
  const max = Math.max(1, ...days.map((d) => d.n));
  const sum = days.reduce((a, d) => a + d.n, 0);
  const best = days.reduce((a, d) => (d.n > a.n ? d : a), days[0]);
  const head = picked !== undefined ? days[picked] : undefined;
  const gap = days.length > 31 ? 1 : days.length > 14 ? 2 : 3;
  const pick = (x: number) => {
    if (!width || !days.length) return;
    setPicked(Math.max(0, Math.min(days.length - 1, Math.floor((x / width) * days.length))));
  };
  const totalShown = total === 'last' ? (days[days.length - 1]?.n ?? 0) : sum;
  return (
    <Card
      label={`${title}: ${total === 'last' ? `${fmt(totalShown)} now` : `${fmt(sum)} in all`}${best?.n && total === 'sum' ? `, most on ${best.label} with ${best.n}` : ''}.`}
    >
      <View style={styles.chartHead}>
        <Text style={styles.chartTitle}>{head ? head.label : title}</Text>
        <Text style={styles.chartTotal}>{fmt(head ? head.n : totalShown)}</Text>
      </View>
      {note && !head ? <Text style={styles.chartNote}>{note}</Text> : null}
      <Pressable
        onPressIn={(e) => pick(e.nativeEvent.locationX)}
        onPressOut={() => setPicked(undefined)}
        onTouchMove={(e) => pick(e.nativeEvent.locationX)}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.bars, { gap }]}
        accessible={false}
      >
        {days.map((d, i) => (
          <View key={d.key} style={styles.barCol} pointerEvents="none">
            {days.length <= 14 && d.n ? <Text style={styles.barN}>{d.n}</Text> : null}
            <View
              style={[
                styles.bar,
                { height: Math.max(2, (d.n / max) * 90), borderTopLeftRadius: days.length > 31 ? 1 : 3, borderTopRightRadius: days.length > 31 ? 1 : 3 },
                (i === days.length - 1 || i === picked) && styles.barToday,
                picked !== undefined && i !== picked && { opacity: 0.45 },
              ]}
            />
          </View>
        ))}
      </Pressable>
      <View style={styles.axis}>
        <Text style={styles.axisText}>{days[0]?.label}</Text>
        <Text style={styles.axisText}>Today</Text>
      </View>
    </Card>
  );
}

/** A running total as a soft line and area, latest figure in the header. */
export function GrowthLine({ title, days }: { title: string; days: DayCount[] }) {
  const [width, setWidth] = useState(0);
  const H = 96;
  const min = Math.min(...days.map((d) => d.n));
  const max = Math.max(...days.map((d) => d.n));
  const span = Math.max(1, max - min);
  const first = days[0]?.n ?? 0;
  const last = days[days.length - 1]?.n ?? 0;
  const pts = days.map((d, i) => [days.length > 1 ? (i / (days.length - 1)) * width : 0, H - 6 - ((d.n - min) / span) * (H - 14)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L${width},${H} L0,${H} Z` : '';
  return (
    <Card label={`${title}: ${fmt(last)} now, ${last - first >= 0 ? 'up' : 'down'} ${fmt(Math.abs(last - first))} since ${days[0]?.label}.`}>
      <View style={styles.chartHead}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Text style={styles.chartTotal}>{fmt(last)}</Text>
      </View>
      <Text style={styles.chartNote}>
        {last - first >= 0 ? '+' : '−'}
        {fmt(Math.abs(last - first))} since {days[0]?.label}
      </Text>
      <View style={{ height: H, marginTop: space.sm }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width ? (
          <Svg width={width} height={H}>
            <Defs>
              <LinearGradient id="growth" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color.glow} stopOpacity={0.35} />
                <Stop offset="1" stopColor={color.glow} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={area} fill="url(#growth)" />
            <Path d={line} stroke={color.glow} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          </Svg>
        ) : null}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>{days[0]?.label}</Text>
        <Text style={styles.axisText}>Today</Text>
      </View>
    </Card>
  );
}

/** Labelled horizontal bars, each to scale against the largest, with the figure and share at the end. */
export function ShareBars({ title, items, note, empty = 'Nothing yet.' }: { title: string; items: (Share | Bucket)[]; note?: string; empty?: string }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  const total = items.reduce((a, i) => a + i.n, 0);
  return (
    <Card>
      <Text style={[styles.chartTitle, { marginBottom: note ? 2 : space.md }]}>{title}</Text>
      {note ? <Text style={[styles.chartNote, { marginBottom: space.md }]}>{note}</Text> : null}
      {!items.length || !total ? <Text style={styles.chartNote}>{empty}</Text> : null}
      {total
        ? items.map((i, k) => {
            const share = 'pct' in i ? i.pct : Math.round((i.n / total) * 100);
            return (
              <View key={i.key} style={styles.shareRow} accessible accessibilityLabel={`${i.label}: ${i.n}, ${share} percent`}>
                <Text style={styles.shareLabel} numberOfLines={1}>
                  {i.label}
                </Text>
                <View style={styles.shareTrack}>
                  <View style={[styles.shareFill, { width: `${(i.n / max) * 100}%`, opacity: 1 - k * 0.12 }]} />
                </View>
                <Text style={styles.shareN}>{fmt(i.n)}</Text>
                <Text style={styles.sharePct}>{share}%</Text>
              </View>
            );
          })
        : null}
    </Card>
  );
}

/** Twenty-four thin bars, one per hour of the day, the busiest named. */
export function HourStrip({ title, hours, note }: { title: string; hours: number[]; note?: string }) {
  const max = Math.max(1, ...hours);
  const peak = hours.indexOf(Math.max(...hours));
  const any = hours.some((h) => h > 0);
  return (
    <Card label={any ? `${title}: busiest around ${hourLabel(peak)}.` : `${title}: nothing yet.`}>
      <View style={styles.chartHead}>
        <Text style={styles.chartTitle}>{title}</Text>
        {any ? <Text style={styles.chartTotalSmall}>Busiest {hourLabel(peak)}</Text> : null}
      </View>
      {note ? <Text style={styles.chartNote}>{note}</Text> : null}
      <View style={[styles.bars, { height: 64, gap: 2, marginTop: space.sm }]}>
        {hours.map((n, h) => (
          <View key={h} style={styles.barCol}>
            <View style={[styles.bar, { height: Math.max(2, (n / max) * 56) }, h === peak && any && styles.barToday]} />
          </View>
        ))}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>12 AM</Text>
        <Text style={styles.axisText}>6 AM</Text>
        <Text style={styles.axisText}>12 PM</Text>
        <Text style={styles.axisText}>6 PM</Text>
        <Text style={styles.axisText}>11 PM</Text>
      </View>
    </Card>
  );
}

/** A numbered list: name, a small meter, the count. */
export function RankList({ title, rows, empty, unit }: { title: string; rows: { key: string; label: string; n: number; onPress?: () => void }[]; empty: string; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <Card>
      <Text style={[styles.chartTitle, { marginBottom: space.sm }]}>{title}</Text>
      {!rows.length ? <Text style={styles.chartNote}>{empty}</Text> : null}
      {rows.map((r, i) => (
        <Pressable key={r.key} onPress={r.onPress} disabled={!r.onPress} style={({ pressed }) => [styles.rankRow, pressed && { opacity: 0.7 }]} accessibilityRole={r.onPress ? 'button' : undefined} accessibilityLabel={`${i + 1}. ${r.label}, ${r.n} ${unit}`}>
          <Text style={styles.rankNum}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.rankName} numberOfLines={1}>
              {r.label}
            </Text>
            <View style={styles.meter}>
              <View style={[styles.meterFill, { width: `${(r.n / max) * 100}%` }]} />
            </View>
          </View>
          <Text style={styles.rankN}>{fmt(r.n)}</Text>
        </Pressable>
      ))}
    </Card>
  );
}

/** Who came back, by the week they arrived. */
export function CohortTable({ cohorts }: { cohorts: Cohort[] }) {
  const cell = (v: number | undefined) => (v === undefined ? '–' : `${v}%`);
  const shade = (v: number | undefined) => (v === undefined ? 'transparent' : `rgba(169,124,255,${0.08 + (v / 100) * 0.5})`);
  return (
    <Card>
      <Text style={styles.chartTitle}>Who came back</Text>
      <Text style={[styles.chartNote, { marginBottom: space.sm }]}>By the week people first opened the app. “A week on” fills in once that week is 7 days old.</Text>
      <View style={styles.cohortHead}>
        <Text style={[styles.cohortHeadText, { flex: 1, textAlign: 'left' }]}>Arrived</Text>
        <Text style={styles.cohortHeadText}>people</Text>
        <Text style={styles.cohortHeadText}>came back</Text>
        <Text style={styles.cohortHeadText}>a week on</Text>
        <Text style={styles.cohortHeadText}>this week</Text>
      </View>
      {cohorts.map((c) => (
        <View
          key={c.label}
          style={styles.cohortRow}
          accessible
          accessibilityLabel={`Arrived ${c.label}: ${c.size} people${c.size ? `, ${cell(c.cameBack)} came back, ${cell(c.afterWeek)} a week on, ${cell(c.activeNow)} active this week` : ''}`}
        >
          <Text style={styles.cohortLabel} numberOfLines={1}>
            {c.label}
          </Text>
          <Text style={styles.cohortSize}>{c.size}</Text>
          {[c.cameBack, c.afterWeek, c.activeNow].map((v, i) => (
            <View key={i} style={[styles.cohortCell, { backgroundColor: c.size ? shade(v) : 'transparent' }]}>
              <Text style={styles.cohortCellText}>{c.size ? cell(v) : ''}</Text>
            </View>
          ))}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.lg, gap: 2 },
  sectionTitle: { ...type.title, color: color.moon },
  sectionNote: { ...type.caption, color: color.moonDim },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '47%', flexGrow: 1, padding: space.md, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, gap: 2 },
  tileGlow: { borderColor: 'rgba(169,124,255,0.45)' },
  tileGold: { borderColor: 'rgba(245,194,75,0.5)', backgroundColor: 'rgba(245,194,75,0.07)' },
  tileWarn: { borderColor: 'rgba(255,184,107,0.55)', backgroundColor: 'rgba(255,184,107,0.08)' },
  tileLabel: { ...type.caption, color: color.moonDim },
  tileValue: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: color.moon, fontVariant: ['tabular-nums'] },
  tileSuffix: { fontSize: 16, fontWeight: '600', color: color.moonDim },
  tileSub: { ...type.caption, color: color.glow },
  card: { padding: space.lg, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
  chartTitle: { ...type.label, color: color.moon, flexShrink: 1 },
  chartTotal: { ...type.headline, color: color.glow, fontVariant: ['tabular-nums'] },
  chartTotalSmall: { ...type.label, color: color.glow },
  chartNote: { ...type.caption, color: color.moonDim, marginTop: 2 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 110, marginTop: space.md },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: 'rgba(169,124,255,0.55)' },
  barToday: { backgroundColor: color.glow, opacity: 1 },
  barN: { fontSize: 9, color: color.moonDim, marginBottom: 2 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisText: { ...type.caption, fontSize: 11, color: color.moonFaint },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 5 },
  shareLabel: { ...type.label, color: color.moon, width: 112 },
  shareTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  shareFill: { height: 8, borderRadius: 4, backgroundColor: color.glow },
  shareN: { ...type.label, color: color.moon, width: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
  sharePct: { ...type.caption, color: color.moonDim, width: 36, textAlign: 'right', fontVariant: ['tabular-nums'] },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  rankNum: { ...type.label, color: color.moonFaint, width: 16, textAlign: 'center' },
  rankName: { ...type.label, color: color.moon },
  rankN: { ...type.headline, color: color.moon, minWidth: 36, textAlign: 'right', fontVariant: ['tabular-nums'] },
  meter: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 5, overflow: 'hidden' },
  meterFill: { height: 4, borderRadius: 2, backgroundColor: color.glow },
  cohortHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingBottom: 4 },
  cohortHeadText: { ...type.caption, fontSize: 10, color: color.moonFaint, width: 52, textAlign: 'center' },
  cohortRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3 },
  cohortLabel: { ...type.caption, color: color.moon, flex: 1 },
  cohortSize: { ...type.label, color: color.moon, width: 52, textAlign: 'center', fontVariant: ['tabular-nums'] },
  cohortCell: { width: 52, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  cohortCellText: { ...type.caption, color: color.moon, fontVariant: ['tabular-nums'] },
});
