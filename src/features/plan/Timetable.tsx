import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LayoutAnimationConfig, useReducedMotion } from 'react-native-reanimated';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { stageName } from '../../data/festival';
import { formatTime } from '../festivals/format';
import type { Festival } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { CrewStarsLine, crewStarsSaid, useCrewStars } from './CrewStars';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { catchLine, exploreLine, matchLabel, TIER_LABEL, verdictLines } from './copy';
import { BoltIcon } from './icons';
import { MustSeeToggle } from './MustSeeToggle';
import { PickRow } from './MustSeeList';
import type { ClashVerdict, Schedule, ScheduleDay, ScheduleItem, TimedPick } from './plan';
import type { DayRoute } from './route';
import { RouteList } from './RouteList';
import { SetReminderToggle } from './SetReminderToggle';
import { TimetableGrid } from './TimetableGrid';

type Mode = 'route' | 'picks' | 'grid';

/** After set times: your picks as a day-by-day timeline, with clashes called out. */
export function Timetable({
  festival,
  schedule,
  route,
  initialDay,
}: {
  festival: Festival;
  schedule: Schedule;
  /** Each day's full set-to-set route (same days as the schedule). */
  route?: DayRoute[];
  /** Open on this day (tonight, during the festival) instead of the first day with something on. */
  initialDay?: string;
}) {
  const reduceMotion = useReducedMotion();
  // The full day, set to set, first; your picks and clashes one tap away.
  const [mode, setMode] = useState<Mode>(route ? 'route' : 'picks');
  const [day, setDay] = useState(
    () =>
      (initialDay && schedule.days.some((d) => d.day === initialDay)
        ? initialDay
        : (schedule.days.find((d) => d.items.length) ?? schedule.days[0])?.day),
  );
  const current = schedule.days.find((d) => d.day === day) ?? schedule.days[0];
  if (!current) return null;
  const dayRoute = route?.find((r) => r.day === current.day);

  return (
    <View>
      {route ? <ModePicker value={mode} onChange={setMode} /> : null}
      {route && mode === 'route' ? <SetReminderToggle festival={festival} /> : null}
      <DayPicker days={schedule.days} value={current.day} onChange={setDay} />
      <LayoutAnimationConfig skipEntering>
        <Animated.View key={`${mode}:${current.day}`} entering={reduceMotion ? undefined : FadeIn.duration(220)}>
          {mode === 'grid' ? (
            <TimetableGrid festival={festival} day={current.day} route={dayRoute} />
          ) : mode === 'route' && dayRoute ? (
            <RouteList festival={festival} route={dayRoute} />
          ) : (
            <>
              <Text style={styles.summary}>{daySummary(current)}</Text>
              {current.items.map((item, i) => (
                <TimelineRow key={itemKey(item)} item={item} last={i === current.items.length - 1}>
                  {item.kind === 'set' ? (
                    <SetCard festival={festival} item={item} />
                  ) : item.kind === 'clash' ? (
                    <ClashCard festival={festival} item={item} />
                  ) : (
                    <DiscoverCard festival={festival} item={item} />
                  )}
                </TimelineRow>
              ))}
            </>
          )}
        </Animated.View>
      </LayoutAnimationConfig>

      {schedule.unscheduled.length > 0 && (
        <View style={styles.unscheduled}>
          <Text style={styles.subhead}>No set time yet</Text>
          {schedule.unscheduled.map((p) => (
            <PickRow key={p.artist.id} festivalId={festival.id} pick={p} note={TIER_LABEL[p.tier]} />
          ))}
        </View>
      )}
    </View>
  );
}

const itemKey = (i: ScheduleItem) =>
  i.kind === 'clash' ? i.picks.map((p) => `${p.artist.id}@${p.start}`).join('+') : `${i.pick.artist.id}@${i.start}`;

function daySummary(d: ScheduleDay) {
  const planned = d.items.reduce((n, i) => n + (i.kind === 'set' ? 1 : i.kind === 'clash' ? i.picks.length : 0), 0);
  if (!d.items.length) return 'Nothing from your list today. A good day to wander.';
  if (!planned) return 'Nothing you love is on. A good night to try something new.';
  const sets = `${planned} ${planned === 1 ? 'set' : 'sets'} for you`;
  if (!d.clashes) return `${sets}, no clashes.`;
  return `${sets}, ${d.clashes} ${d.clashes === 1 ? 'clash' : 'clashes'} to decide.`;
}

/** Full day (the set-to-set route), your picks (with clashes called out), or every set as a timetable. */
function ModePicker({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  const options: { key: Mode; label: string; a11y: string }[] = [
    { key: 'route', label: 'Full day', a11y: 'Full day, set to set' },
    { key: 'picks', label: 'Your picks', a11y: 'Your picks and clashes' },
    { key: 'grid', label: 'All sets', a11y: 'All sets, as a timetable' },
  ];
  return (
    <View style={styles.modes} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.a11y}
            onPress={() => {
              if (on) return;
              haptic.select();
              onChange(o.key);
            }}
            style={[styles.modeItem, on && styles.modeOn]}
          >
            <Text style={[styles.dayText, on && { color: color.moon }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DayPicker({ days, value, onChange }: { days: ScheduleDay[]; value: string; onChange: (d: string) => void }) {
  return (
    <View style={styles.days} accessibilityRole="tablist">
      {days.map((d) => {
        const on = d.day === value;
        return (
          <Pressable
            key={d.day}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${d.day}${d.clashes ? `, ${d.clashes} ${d.clashes === 1 ? 'clash' : 'clashes'}` : ''}`}
            onPress={() => {
              if (on) return;
              haptic.select();
              onChange(d.day);
            }}
            style={[styles.dayItem, on && styles.dayOn]}
          >
            <Text style={[styles.dayText, on && { color: color.moon }]}>{d.day}</Text>
            <View style={[styles.dayDot, d.clashes > 0 && { backgroundColor: color.glow }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Time on the left, a quiet rail with a dot, the card on the right. */
function TimelineRow({ item, last, children }: { item: ScheduleItem; last: boolean; children: React.ReactNode }) {
  const start = item.kind === 'clash' ? item.picks.reduce((a, b) => (a.start <= b.start ? a : b)) : item.pick;
  const [time, ampm] = formatTime(start.set.start).split(' ');
  const strong = item.kind === 'clash' || (item.kind === 'set' && item.pick.tier === 'must-see');
  return (
    <View style={styles.tRow}>
      <View style={styles.tTime}>
        <Text style={styles.time}>{time}</Text>
        <Text style={styles.ampm}>{ampm}</Text>
      </View>
      <View style={styles.rail}>
        <View style={[styles.dot, strong && styles.dotStrong, item.kind === 'discover' && styles.dotHollow]} />
        {!last && <View style={styles.line} />}
      </View>
      <View style={styles.tCard}>{children}</View>
    </View>
  );
}

const where = (festival: Festival, p: TimedPick) =>
  `${stageName(festival, p.set.stageId)}, until ${formatTime(p.set.end)}`;

const openArtist = (festival: Festival, id: string) => {
  haptic.select();
  router.push({ pathname: '/artist/[id]', params: { id, festival: festival.id } });
};

/** Compact artist line used inside cards. */
function ArtistLine({
  festival,
  pick,
  label,
  labelGlow,
  dim,
}: {
  festival: Festival;
  pick: TimedPick;
  label?: string;
  labelGlow?: boolean;
  dim?: boolean;
}) {
  const match = matchLabel(pick);
  const friends = useCrewStars(festival.id, pick.artist.id);
  return (
    <Pressable
      onPress={() => openArtist(festival, pick.artist.id)}
      accessibilityRole="button"
      accessibilityLabel={`${label ? `${label}. ` : ''}${pick.artist.name}, ${pick.known ? `${match} match` : 'new to you'}, ${formatTime(pick.set.start)}, ${where(festival, pick)}${crewStarsSaid(friends)}`}
      style={({ pressed }) => [styles.aLine, dim && { opacity: 0.6 }, pressed && { opacity: 0.5 }]}
    >
      <ArtistAvatar artist={pick.artist} size={AVATAR} />
      <View style={{ flex: 1 }}>
        {label ? <Text style={[styles.label, labelGlow && { color: color.glow }]}>{label}</Text> : null}
        <Text style={styles.name} numberOfLines={1}>
          {pick.artist.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {where(festival, pick)}
        </Text>
        <CrewStarsLine names={friends} />
      </View>
      <View style={styles.side}>
        <Text style={[styles.match, pick.tier === 'must-see' && pick.known && { color: color.glow }]}>{match}</Text>
        <MustSeeToggle artist={pick.artist} festivalId={festival.id} size={18} />
      </View>
    </Pressable>
  );
}

/** An explore pick on at the same time as something on your plan. Offered, never pushed. */
function Alternatives({ festival, picks }: { festival: Festival; picks: TimedPick[] }) {
  if (!picks.length) return null;
  return (
    <View style={styles.alt}>
      <Text style={styles.altHead}>Or try something new at the same time</Text>
      {picks.map((p) => (
        <Pressable
          key={p.artist.id}
          onPress={() => openArtist(festival, p.artist.id)}
          accessibilityRole="button"
          accessibilityLabel={`${p.artist.name}, ${p.known ? `${matchLabel(p)} match` : 'new to you'}, ${where(festival, p)}`}
          style={({ pressed }) => [styles.altRow, pressed && { opacity: 0.6 }]}
        >
          <ArtistAvatar artist={p.artist} size={28} />
          <Text style={styles.altName} numberOfLines={1}>
            {p.artist.name}
          </Text>
          <Text style={styles.altMeta} numberOfLines={1}>
            {formatTime(p.set.start)}, {stageName(festival, p.set.stageId)}
          </Text>
          <Text style={styles.match}>{matchLabel(p)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SetCard({ festival, item }: { festival: Festival; item: Extract<ScheduleItem, { kind: 'set' }> }) {
  const { pick } = item;
  return (
    <View style={styles.card}>
      <ArtistLine festival={festival} pick={pick} label={TIER_LABEL[pick.tier]} labelGlow={pick.tier === 'must-see'} />
      <Alternatives festival={festival} picks={item.alternatives} />
    </View>
  );
}

const chosen = (v: ClashVerdict) => (v.kind === 'close' ? null : v.pick.artist.id);

function ClashCard({ festival, item }: { festival: Festival; item: Extract<ScheduleItem, { kind: 'clash' }> }) {
  const { verdict } = item;
  const pickId = chosen(verdict);
  const { head, sub } = verdictLines(verdict);
  const end = Math.max(...item.picks.map((p) => p.end));
  const last = item.picks.find((p) => p.end === end)!;
  const first = item.picks.reduce((a, b) => (a.start <= b.start ? a : b));

  return (
    <View style={[styles.card, styles.clash]}>
      <LinearGradient
        colors={[glowA(0.14), glowA(0)]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View
        style={styles.clashHead}
        accessible
        accessibilityLabel={`Clash between ${item.picks.map((p) => p.artist.name).join(' and ')}`}
      >
        <BoltIcon color={color.glow} />
        <Text style={styles.clashTitle}>Clash</Text>
        <Text style={styles.clashTime}>
          {formatTime(first.set.start)} to {formatTime(last.set.end)}
        </Text>
      </View>
      {item.picks.map((p, i) => (
        <View key={p.artist.id}>
          {i > 0 && (
            <View style={styles.vs}>
              <View style={styles.vsLine} />
              <Text style={styles.vsText}>vs</Text>
              <View style={styles.vsLine} />
            </View>
          )}
          <ArtistLine
            festival={festival}
            pick={p}
            label={pickId === p.artist.id ? 'Your pick' : undefined}
            labelGlow
            dim={!!pickId && pickId !== p.artist.id}
          />
        </View>
      ))}
      <View style={styles.verdict}>
        <Text style={styles.verdictHead}>{head}</Text>
        <Text style={styles.verdictSub}>{sub}</Text>
        {verdict.catch ? <Text style={styles.verdictSub}>{catchLine(verdict.catch)}</Text> : null}
      </View>
      <Alternatives festival={festival} picks={item.alternatives} />
    </View>
  );
}

function DiscoverCard({ festival, item }: { festival: Festival; item: Extract<ScheduleItem, { kind: 'discover' }> }) {
  return (
    <View style={[styles.card, styles.discover]}>
      <ArtistLine festival={festival} pick={item.pick} label="Discovery" />
      <Text style={styles.reason}>{exploreLine(item.reason, true)}</Text>
    </View>
  );
}

const RAIL = 20;
const AVATAR = 36;

const styles = StyleSheet.create({
  modes: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    marginTop: space.lg,
  },
  modeItem: { paddingHorizontal: space.lg, paddingVertical: 6, borderRadius: radius.pill },
  modeOn: { backgroundColor: glowA(0.22) },
  days: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    marginTop: space.lg,
  },
  dayItem: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.pill },
  dayOn: { backgroundColor: glowA(0.22) },
  dayText: { ...type.label, color: color.moonDim },
  dayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 4, backgroundColor: 'transparent' },
  summary: { ...type.caption, color: color.moonDim, marginTop: space.lg, marginBottom: space.md },

  tRow: { flexDirection: 'row' },
  tTime: { width: 50, paddingTop: space.md, alignItems: 'flex-end' },
  time: { ...type.label, color: color.moon, fontVariant: ['tabular-nums'] },
  ampm: { ...type.caption, fontSize: 10, color: color.moonFaint, marginTop: 1 },
  rail: { width: RAIL, alignItems: 'center', marginHorizontal: space.xs },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: space.md + 5, backgroundColor: color.moonDim },
  dotStrong: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: space.md + 4,
    backgroundColor: color.glow,
    shadowColor: color.glow,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  dotHollow: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: color.moonFaint },
  line: { flex: 1, width: StyleSheet.hairlineWidth * 2, backgroundColor: color.hairline, marginTop: space.xs },
  tCard: { flex: 1, paddingBottom: space.md },

  card: {
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    overflow: 'hidden',
  },
  clash: { borderColor: glowA(0.4), paddingTop: space.md },
  discover: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: color.hairline,
    paddingBottom: space.md,
  },

  aLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, paddingVertical: space.sm },
  side: { alignItems: 'center', marginRight: -6 },
  label: { ...type.caption, color: color.moonDim, marginBottom: 1 },
  name: { ...type.headline, color: color.moon },
  meta: { ...type.caption, color: color.moonDim, marginTop: 2 },
  match: { ...type.label, color: color.moonDim, fontVariant: ['tabular-nums'] },

  clashHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clashTitle: { ...type.label, color: color.glow, flex: 1 },
  clashTime: { ...type.caption, color: color.moonFaint, fontVariant: ['tabular-nums'] },
  vs: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: AVATAR + space.sm + 2 },
  vsLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: color.hairline },
  vsText: { ...type.caption, color: color.moonFaint },
  verdict: {
    marginTop: space.xs,
    paddingTop: space.md,
    paddingBottom: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairline,
    gap: 3,
  },
  verdictHead: { ...type.label, color: color.moon },
  verdictSub: { ...type.caption, color: color.moonDim },
  reason: { ...type.caption, color: color.moonDim, marginLeft: AVATAR + space.sm + 2 },

  alt: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline, paddingVertical: space.sm },
  altHead: { ...type.caption, color: color.moonFaint, marginBottom: 2 },
  altRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6 },
  altName: { ...type.label, color: color.moon, flexShrink: 1 },
  altMeta: { ...type.caption, color: color.moonDim, flex: 1 },

  unscheduled: { marginTop: space.xl },
  subhead: { ...type.label, color: color.moon, marginBottom: space.xs },
});
