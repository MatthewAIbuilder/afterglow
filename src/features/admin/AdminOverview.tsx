import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { isOver } from '../festivals/shelves';
import type { AdminCounts } from '../social/models';
import { FOUNDERS_MAX } from '../social/models';
import { byDay, type DayCount, daysAgo, weekLine, weeks } from './admin';

/** The festivals compared on the dashboard: those not over, soonest first, at most this many. */
const FESTIVALS_SHOWN = 12;

type Data = {
  counts: AdminCounts;
  signups: DayCount[];
  videos: DayCount[];
  festivals: { festival: Festival; going: number; videos: number }[];
  at: Date;
};

/**
 * The dashboard's first page: how Afterglow is doing, in plain words and
 * big numbers. Who joined and what was shared over the last two weeks as
 * bars, and each festival's people going and videos shared. Everything is
 * counted on the server from Afterglow's own data.
 */
export function AdminOverview() {
  const { service } = useSocial();
  const catalog = useCatalog();
  const [data, setData] = useState<Data | undefined>();
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const now = new Date();
      const fests = catalog.festivals
        .filter((f) => !isOver(f, now))
        .sort((a, b) => (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999'))
        .slice(0, FESTIVALS_SHOWN);
      const [counts, activity, perFestival] = await Promise.all([
        service.adminCounts(daysAgo(now, 7)),
        service.adminActivity(daysAgo(now, 14), 3000),
        service.adminFestivals(fests.map((f) => f.id)),
      ]);
      setData({
        counts,
        signups: byDay(activity.signups, 14, now),
        videos: byDay(activity.videos, 14, now),
        festivals: fests.map((f) => ({ festival: f, ...(perFestival[f.id] ?? { going: 0, videos: 0 }) })).sort((a, b) => b.going - a.going || b.videos - a.videos),
        at: now,
      });
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [service, catalog.festivals]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const people = useMemo(() => (data ? weekLine({ one: 'new person', many: 'new people' }, weeks(data.signups)) : ''), [data]);
  const shared = useMemo(() => (data ? weekLine({ one: 'video shared', many: 'videos shared' }, weeks(data.videos)) : ''), [data]);

  if (!data) {
    return failed ? (
      <View style={styles.note}>
        <Text style={styles.noteTitle}>Couldn’t load the numbers</Text>
        <Text style={styles.noteBody}>Check the signal, then try again. If it keeps happening, the newest database rules may not be deployed yet.</Text>
        <Refresh onPress={load} loading={loading} />
      </View>
    ) : (
      <ActivityIndicator color={color.glow} style={{ marginTop: space.xxl }} />
    );
  }
  const c = data.counts;
  return (
    <View style={styles.wrap}>
      {/* In a sentence or two first. */}
      <View style={styles.summary} accessibilityRole="summary">
        <Text style={styles.summaryKicker}>This week</Text>
        <Text style={styles.summaryLine}>{people}</Text>
        <Text style={styles.summaryLine}>{shared}</Text>
        {c.supportOpen ? <Text style={[styles.summaryLine, { color: '#FFB86B' }]}>{c.supportOpen} support {c.supportOpen === 1 ? 'message is' : 'messages are'} waiting for a reply.</Text> : null}
      </View>

      <View style={styles.tiles}>
        <Tile label="People" value={c.people} sub={`+${c.peopleThisWeek} this week`} glow />
        <Tile label="Videos shared" value={c.videos} sub={`+${c.videosThisWeek} this week`} glow />
        <Tile label="Crews" value={c.crews} />
        <Tile label="Founders" value={c.founders} sub={`of ${FOUNDERS_MAX}`} gold />
        <Tile label="Follows" value={c.follows} />
        <Tile label="Likes" value={c.likes} />
        <Tile label="Comments" value={c.comments} />
        <Tile label="Reports" value={c.reports} />
      </View>

      <Bars title="New people, last 14 days" days={data.signups} />
      <Bars title="Videos shared, last 14 days" days={data.videos} />

      <Text style={styles.section}>Festivals</Text>
      <Text style={styles.sectionNote}>People who show they’re going, and videos shared there. Soonest festivals, most people first.</Text>
      <View style={styles.table}>
        <View style={styles.rowHead}>
          <Text style={[styles.rowHeadText, { flex: 1 }]} />
          <Text style={styles.rowHeadText}>going</Text>
          <Text style={styles.rowHeadText}>videos</Text>
        </View>
        {data.festivals.map(({ festival, going, videos }) => {
          const max = Math.max(1, ...data.festivals.map((x) => x.going));
          return (
            <View key={festival.id} style={styles.row} accessible accessibilityLabel={`${festival.name}: ${going} going, ${videos} videos`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {festival.name}
                </Text>
                <View style={styles.meter}>
                  <View style={[styles.meterFill, { width: `${(going / max) * 100}%` }]} />
                </View>
              </View>
              <Text style={styles.rowNum}>{going}</Text>
              <Text style={styles.rowNumDim}>{videos}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.updated}>
        Updated {data.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Counts only: nothing extra is collected about anyone.
      </Text>
      <Refresh onPress={load} loading={loading} />
    </View>
  );
}

function Refresh({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel="Refresh the numbers"
      style={({ pressed }) => [styles.refresh, pressed && { opacity: 0.8 }]}
    >
      <Text style={styles.refreshText}>{loading ? 'Refreshing…' : 'Refresh'}</Text>
    </Pressable>
  );
}

function Tile({ label, value, sub, glow, gold }: { label: string; value: number; sub?: string; glow?: boolean; gold?: boolean }) {
  return (
    <View style={[styles.tile, glow && styles.tileGlow, gold && styles.tileGold]} accessible accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ''}`}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, gold && { color: '#FFE38A' }]}>{value.toLocaleString('en-US')}</Text>
      {sub ? <Text style={styles.tileSub}>{sub}</Text> : null}
    </View>
  );
}

/** A day-by-day bar chart: one bar a day, today on the right, the busiest day labelled. */
function Bars({ title, days }: { title: string; days: DayCount[] }) {
  const max = Math.max(1, ...days.map((d) => d.n));
  const total = days.reduce((a, d) => a + d.n, 0);
  const best = days.reduce((a, d) => (d.n > a.n ? d : a), days[0]);
  return (
    <View style={styles.chart} accessible accessibilityLabel={`${title}: ${total} in all${best?.n ? `, most on ${best.label} with ${best.n}` : ''}.`}>
      <View style={styles.chartHead}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Text style={styles.chartTotal}>{total}</Text>
      </View>
      <View style={styles.bars}>
        {days.map((d, i) => (
          <View key={d.key} style={styles.barCol}>
            {d.n ? <Text style={styles.barN}>{d.n}</Text> : null}
            <View style={[styles.bar, { height: Math.max(2, (d.n / max) * 90) }, i === days.length - 1 && styles.barToday]} />
          </View>
        ))}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>{days[0]?.label}</Text>
        <Text style={styles.axisText}>Today</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, gap: space.md },
  summary: { padding: space.lg, gap: 4, borderRadius: radius.lg, backgroundColor: 'rgba(169,124,255,0.12)', borderWidth: 1, borderColor: 'rgba(169,124,255,0.35)' },
  summaryKicker: { ...type.label, color: color.glow, textTransform: 'uppercase', letterSpacing: 1 },
  summaryLine: { ...type.headline, color: color.moon },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '47%', flexGrow: 1, padding: space.md, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  tileGlow: { borderColor: 'rgba(169,124,255,0.45)' },
  tileGold: { borderColor: 'rgba(245,194,75,0.5)', backgroundColor: 'rgba(245,194,75,0.07)' },
  tileLabel: { ...type.caption, color: color.moonDim },
  tileValue: { fontSize: 30, lineHeight: 36, fontWeight: '700', color: color.moon, fontVariant: ['tabular-nums'] },
  tileSub: { ...type.caption, color: color.glow },
  chart: { padding: space.lg, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.md },
  chartTitle: { ...type.label, color: color.moon },
  chartTotal: { ...type.headline, color: color.glow, fontVariant: ['tabular-nums'] },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 3 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 3, backgroundColor: 'rgba(169,124,255,0.55)' },
  barToday: { backgroundColor: color.glow },
  barN: { fontSize: 9, color: color.moonDim, marginBottom: 2 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisText: { ...type.caption, fontSize: 11, color: color.moonFaint },
  section: { ...type.headline, color: color.moon, marginTop: space.md },
  sectionNote: { ...type.caption, color: color.moonDim, marginTop: -space.sm },
  table: { borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  rowName: { ...type.label, color: color.moon },
  meter: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 5, overflow: 'hidden' },
  meterFill: { height: 4, borderRadius: 2, backgroundColor: color.glow },
  rowNum: { ...type.headline, color: color.moon, width: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
  rowNumDim: { ...type.label, color: color.moonDim, width: 48, textAlign: 'right', fontVariant: ['tabular-nums'] },
  rowHead: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.md, paddingTop: space.xs },
  rowHeadText: { ...type.caption, fontSize: 11, color: color.moonFaint, width: 46, textAlign: 'right' },
  updated: { ...type.caption, color: color.moonFaint, textAlign: 'center', marginTop: space.md },
  refresh: { alignSelf: 'center', paddingHorizontal: space.xl, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  refreshText: { ...type.label, color: color.moonDim },
  note: { margin: space.lg, padding: space.xl, gap: space.sm, borderRadius: radius.lg, backgroundColor: color.glass },
  noteTitle: { ...type.headline, color: color.moon },
  noteBody: { ...type.body, color: color.moonDim },
});
