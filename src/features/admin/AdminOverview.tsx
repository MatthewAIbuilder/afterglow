import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useSocial } from '../../state/social';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { isOver } from '../festivals/shelves';
import type { AdminActivity, AdminCounts, AdminPresence } from '../social/models';
import { FOUNDERS_MAX } from '../social/models';
import { byDay, daysAgo, weekLine, weeks } from './admin';
import { Bars, CohortTable, GrowthLine, HourStrip, RankList, Section, ShareBars, Tile, Tiles } from './AdminCharts';
import {
  activeIn,
  alerts,
  contentStats,
  dailyActive,
  growth,
  HISTORY_DAYS,
  hourLabel,
  peopleStats,
  RANGE_LABEL,
  RANGES,
  type Range,
  retention,
  trend,
  trendLabel,
} from './metrics';

/** The festivals compared on the dashboard: those not over, soonest first, at most this many. */
const FESTIVALS_SHOWN = 12;
/** Records read back per kind for the charts (newest first). */
const READ_MAX = 5000;

type View_ = 'glance' | 'people' | 'content' | 'festivals';
const VIEWS: { key: View_; label: string }[] = [
  { key: 'glance', label: 'At a glance' },
  { key: 'people', label: 'People' },
  { key: 'content', label: 'Content' },
  { key: 'festivals', label: 'Festivals' },
];

type Data = {
  counts: AdminCounts;
  activity: AdminActivity;
  presence: AdminPresence[];
  /** The last-active records couldn't be read (rules not deployed yet). */
  presenceMissing: boolean;
  festivals: { festival: Festival; going: number; videos: number }[];
  at: Date;
};

/**
 * The dashboard's numbers: who's active and who's drifted away, who joined
 * and who came back, what people shared and when, and each festival's
 * crowd, over 7, 30 or 90 days. Counts come from the server; the charts
 * are worked out here from the records Afterglow already keeps.
 */
export function AdminOverview() {
  const { service } = useSocial();
  const catalog = useCatalog();
  const [data, setData] = useState<Data | undefined>();
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<Range>(30);
  const [view, setView] = useState<View_>('glance');

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const now = new Date();
      const fests = catalog.festivals
        .filter((f) => !isOver(f, now))
        .sort((a, b) => (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999'))
        .slice(0, FESTIVALS_SHOWN);
      let presenceMissing = false;
      const [counts, activity, presence, perFestival] = await Promise.all([
        service.adminCounts(daysAgo(now, 7)),
        service.adminActivity(daysAgo(now, HISTORY_DAYS), READ_MAX),
        service.adminPresence(READ_MAX).catch(() => {
          presenceMissing = true;
          return [] as AdminPresence[];
        }),
        service.adminFestivals(fests.map((f) => f.id)),
      ]);
      setData({
        counts,
        activity,
        presence,
        presenceMissing,
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

  const stats = useMemo(() => {
    if (!data) return undefined;
    const { at: now, activity: a, presence: p } = data;
    const videoTimes = a.videos.map((v) => v.createdAt);
    const people = peopleStats(p, now);
    const signups = trend(a.signups, range, now);
    return {
      people,
      signups,
      daily: dailyActive(p, range, now),
      dailyAverage: Math.round(dailyActive(p, range, now).reduce((x, d) => x + d.n, 0) / range),
      newPeople: byDay(a.signups, range, now),
      videos: byDay(videoTimes, range, now),
      likes: byDay(a.likes, range, now),
      comments: byDay(a.comments, range, now),
      totalPeople: growth(data.counts.people, a.signups, range, now),
      totalVideos: growth(data.counts.videos, videoTimes, range, now),
      cohorts: retention(p, now),
      content: contentStats(a, activeIn(p, range, now), range, now),
      week: {
        people: weekLine({ one: 'new person', many: 'new people' }, weeks(byDay(a.signups, 14, now))),
        videos: weekLine({ one: 'video shared', many: 'videos shared' }, weeks(byDay(videoTimes, 14, now))),
      },
      alerts: alerts({ supportOpen: data.counts.supportOpen, reportsOpen: data.counts.reportsOpen, people: p.length ? people : undefined, signups, days: range }),
      capped: [a.signups, a.videos, a.likes, a.comments, a.follows].some((x) => x.length >= READ_MAX),
    };
  }, [data, range]);

  if (!data || !stats) {
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
  const pp = stats.people;
  const ct = stats.content;
  const rl = RANGE_LABEL[range];
  const hasPresence = data.presence.length > 0;
  const name = {
    artist: (id: string) => catalog.artist(id)?.name ?? id,
    festival: (id: string) => catalog.festival(id)?.name ?? id,
  };

  return (
    <View style={styles.wrap}>
      <Segmented items={VIEWS} value={view} onChange={setView} label="Dashboard section" />
      {view !== 'festivals' ? <Segmented items={RANGES.map((r) => ({ key: r, label: RANGE_LABEL[r] }))} value={range} onChange={setRange} label="Time range" small /> : null}

      {view === 'glance' ? (
        <>
          <View style={styles.summary} accessibilityRole="summary">
            <Text style={styles.summaryKicker}>Right now</Text>
            {hasPresence ? (
              <Text style={styles.summaryLine}>
                {pp.onlineHour} {pp.onlineHour === 1 ? 'person' : 'people'} in the last hour · {pp.today} today
              </Text>
            ) : null}
            <Text style={styles.summaryLine}>{stats.week.people}</Text>
            <Text style={styles.summaryLine}>{stats.week.videos}</Text>
            {stats.alerts.map((x) => (
              <Text key={x.text} style={[styles.summaryLine, x.tone === 'warn' ? { color: '#FFB86B' } : { color: color.moonDim }]}>
                {x.text}
              </Text>
            ))}
          </View>
          {!hasPresence ? <ActiveNote missing={data.presenceMissing} /> : null}
          <Tiles>
            <Tile label="Active today" value={hasPresence ? pp.today : undefined} tone="glow" sub={pp.onlineHour ? `${pp.onlineHour} in the last hour` : undefined} />
            <Tile label="Active this week" value={hasPresence ? pp.week : undefined} tone="glow" sub={hasPresence ? `${pp.newThisWeek} new, ${pp.returningThisWeek} returning` : undefined} />
            <Tile label="Active this month" value={hasPresence ? pp.month : undefined} sub={pp.stickiness !== undefined ? `${pp.stickiness}% of them use it daily` : undefined} />
            <Tile label="Inactive (30+ days)" value={hasPresence ? pp.inactive : undefined} sub={hasPresence && pp.accounts ? `${Math.round((pp.inactive / pp.accounts) * 100)}% of accounts` : undefined} />
            <Tile label={`New people, ${rl}`} value={stats.signups.now} sub={trendLabel(stats.signups, range) || undefined} />
            <Tile label={`Videos shared, ${rl}`} value={ct.videos.now} sub={trendLabel(ct.videos, range) || undefined} />
            <Tile label="People with a profile" value={c.people} sub={`+${c.peopleThisWeek} this week`} />
            <Tile label="Videos shared in all" value={c.videos} sub={`+${c.videosThisWeek} this week`} />
          </Tiles>
          {hasPresence ? <Bars title={`People who opened the app, last ${rl}`} days={stats.daily} total="last" note={`Signed-in accounts, each counted once a day. ${stats.dailyAverage} a day on average.`} /> : null}
          <Bars title={`New people, last ${rl}`} days={stats.newPeople} />
          <Bars title={`Videos shared, last ${rl}`} days={stats.videos} />

          <Section title="Support and safety" />
          <Tiles>
            <Tile label="Support waiting" value={c.supportOpen} tone={c.supportOpen ? 'warn' : undefined} sub={`${c.supportTotal} messages in all`} />
            <Tile label="Reports to look at" value={c.reportsOpen} tone={c.reportsOpen ? 'warn' : undefined} sub={`${c.reports} reports in all`} />
            <Tile label="Founders" value={c.founders} tone="gold" sub={`of ${FOUNDERS_MAX} spots`} />
            <Tile label="Crews" value={c.crews} sub={`${c.crewInvites} invites sent`} />
          </Tiles>
        </>
      ) : null}

      {view === 'people' ? (
        <>
          {!hasPresence ? <ActiveNote missing={data.presenceMissing} /> : null}
          <Tiles>
            <Tile label="Accounts" value={hasPresence ? pp.accounts : undefined} tone="glow" sub="Signed in at least once" />
            <Tile label="With a profile" value={c.people} tone="glow" sub={hasPresence ? `${Math.max(0, pp.accounts - pp.withProfile)} accounts without one` : undefined} />
            <Tile label="Online, last hour" value={hasPresence ? pp.onlineHour : undefined} />
            <Tile label="Daily share" value={pp.stickiness} suffix="%" sub="Of this month’s people, active today" />
            <Tile label="Days active a month" value={pp.daysPerMonth} sub="On average, this month’s people" />
            <Tile label={`New people, ${rl}`} value={stats.signups.now} sub={trendLabel(stats.signups, range) || undefined} />
            <Tile label="New this week" value={hasPresence ? pp.newThisWeek : undefined} sub="First opened the app this week" />
            <Tile label="Returning this week" value={hasPresence ? pp.returningThisWeek : undefined} sub="Had been before" />
          </Tiles>
          <GrowthLine title="People with a profile" days={stats.totalPeople} />
          <Bars title={`New people, last ${rl}`} days={stats.newPeople} />
          {hasPresence ? (
            <>
              <Bars title={`People who opened the app, last ${rl}`} days={stats.daily} total="last" note={`Signed-in accounts, each counted once a day. ${stats.dailyAverage} a day on average.`} />
              <ShareBars title="When accounts last opened the app" items={pp.buckets} note="Active: today to 30 days. Inactive: longer than that." />
              <CohortTable cohorts={stats.cohorts} />
              <ShareBars title="Phones and website" items={pp.platforms} note="People active this month." />
              <ShareBars title="App versions" items={pp.versions} note="People active this month. Old versions miss newer features." />
            </>
          ) : null}
        </>
      ) : null}

      {view === 'content' ? (
        <>
          <Tiles>
            <Tile label={`Videos, ${rl}`} value={ct.videos.now} tone="glow" sub={trendLabel(ct.videos, range) || `${c.videos} in all`} />
            <Tile label={`People sharing, ${rl}`} value={ct.creators} tone="glow" sub={ct.creatorShare !== undefined ? `${ct.creatorShare}% of active people` : undefined} />
            <Tile label="Videos a day" value={ct.perDay} sub={`Average over ${rl}`} />
            <Tile label="Average length" value={ct.avgLength} suffix=" s" />
            <Tile label={`Likes, ${rl}`} value={ct.likes.now} sub={trendLabel(ct.likes, range) || `${c.likes} in all`} />
            <Tile label={`Comments, ${rl}`} value={ct.comments.now} sub={trendLabel(ct.comments, range) || `${c.comments} in all`} />
            <Tile label={`New follows, ${rl}`} value={ct.follows.now} sub={trendLabel(ct.follows, range) || `${c.follows} in all`} />
            <Tile label={`New crews, ${rl}`} value={ct.crews.now} sub={trendLabel(ct.crews, range) || `${c.crews} in all`} />
            <Tile label="Likes per video" value={ct.likesPerVideo} sub={`Videos and likes in ${rl}`} />
            <Tile label="Comments per video" value={ct.commentsPerVideo} sub={`Videos and comments in ${rl}`} />
          </Tiles>
          <GrowthLine title="Videos shared in all" days={stats.totalVideos} />
          <Bars title={`Videos shared, last ${rl}`} days={stats.videos} />
          <Bars title={`Likes, last ${rl}`} days={stats.likes} />
          <Bars title={`Comments, last ${rl}`} days={stats.comments} />
          <HourStrip title="When people share" hours={ct.hours} note={`Videos shared in the last ${rl}, by hour (your phone’s time).${ct.busiestHour !== undefined ? ` Busiest around ${hourLabel(ct.busiestHour)}.` : ''}`} />
          <RankList
            title={`Top sharers, ${rl}`}
            unit="videos"
            empty="No videos shared in this time."
            rows={ct.topCreators.map((r) => ({ key: r.key, label: r.handle ? `@${r.handle}` : 'Someone', n: r.n, onPress: r.handle ? () => router.push(`/u/${r.handle}`) : undefined }))}
          />
          <RankList title={`Most filmed artists, ${rl}`} unit="videos" empty="No tagged videos in this time." rows={ct.topArtists.map((r) => ({ key: r.key, label: name.artist(r.key), n: r.n, onPress: () => router.push(`/artist/${r.key}`) }))} />
          <RankList title={`Most filmed festivals, ${rl}`} unit="videos" empty="No festival videos in this time." rows={ct.topFestivals.map((r) => ({ key: r.key, label: name.festival(r.key), n: r.n, onPress: () => router.push(`/festival/${r.key}`) }))} />
        </>
      ) : null}

      {view === 'festivals' ? (
        <>
          <Text style={styles.sectionNote}>People who show they’re going, and videos shared there. Soonest festivals, most people first. Tap one to open it.</Text>
          <View style={styles.table}>
            <View style={styles.rowHead}>
              <Text style={[styles.rowHeadText, { flex: 1 }]} />
              <Text style={styles.rowHeadText}>going</Text>
              <Text style={styles.rowHeadText}>videos</Text>
            </View>
            {data.festivals.map(({ festival, going, videos }) => {
              const max = Math.max(1, ...data.festivals.map((x) => x.going));
              return (
                <Pressable
                  key={festival.id}
                  onPress={() => router.push(`/festival/${festival.id}`)}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${festival.name}: ${going} going, ${videos} videos`}
                >
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
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <Text style={styles.updated}>
        Updated {data.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.{stats.capped ? ` Charts use the newest ${READ_MAX.toLocaleString('en-US')} of each kind.` : ''} Only counts and open times: nothing about what anyone watches is
        collected.
      </Text>
      <Refresh onPress={load} loading={loading} />
    </View>
  );
}

function ActiveNote({ missing }: { missing: boolean }) {
  return (
    <View style={styles.activeNote}>
      <Text style={styles.activeNoteTitle}>{missing ? 'Active and inactive counts need the new database rules' : 'Active counts start now'}</Text>
      <Text style={styles.activeNoteBody}>
        {missing
          ? 'Deploy the latest rules (docs/firebase-setup.md, step 5) and this fills in as people open the app.'
          : 'Each signed-in account is counted from the first time it opens this version of the app, so these numbers grow over the next few days.'}
      </Text>
    </View>
  );
}

/** A row of pills where exactly one is chosen. */
function Segmented<K extends string | number>({ items, value, onChange, label, small }: { items: { key: K; label: string }[]; value: K; onChange: (k: K) => void; label: string; small?: boolean }) {
  return (
    <View style={[styles.seg, small && styles.segSmall]} accessibilityRole="tablist" accessibilityLabel={label}>
      {items.map((i) => {
        const on = i.key === value;
        return (
          <Pressable
            key={String(i.key)}
            onPress={() => {
              if (on) return;
              haptic.select();
              onChange(i.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.segItem, on && styles.segOn]}
          >
            <Text style={[small ? styles.segTextSmall : styles.segText, on && styles.segTextOn]} numberOfLines={1}>
              {i.label}
            </Text>
          </Pressable>
        );
      })}
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

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, gap: space.md },
  seg: { flexDirection: 'row', padding: 3, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  segSmall: { alignSelf: 'center', minWidth: 260 },
  segItem: { flexGrow: 1, flexBasis: 0, minHeight: 34, paddingHorizontal: space.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  segOn: { backgroundColor: glowA(0.28) },
  segText: { ...type.label, color: color.moonDim },
  segTextSmall: { ...type.caption, color: color.moonDim, paddingHorizontal: space.xs },
  segTextOn: { color: color.moon },
  summary: { padding: space.lg, gap: 4, borderRadius: radius.lg, backgroundColor: glowA(0.12), borderWidth: 1, borderColor: glowA(0.35) },
  summaryKicker: { ...type.label, color: color.glow, textTransform: 'uppercase', letterSpacing: 1 },
  summaryLine: { ...type.headline, color: color.moon },
  activeNote: { padding: space.md, gap: 2, borderRadius: radius.lg, backgroundColor: 'rgba(255,184,107,0.08)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,184,107,0.45)' },
  activeNoteTitle: { ...type.label, color: color.moon },
  activeNoteBody: { ...type.caption, color: color.moonDim },
  sectionNote: { ...type.caption, color: color.moonDim },
  table: { borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim, paddingVertical: space.xs },
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
