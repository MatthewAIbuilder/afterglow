import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { stageName } from '../../data/festival';
import type { Festival } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useCrews } from '../../state/crews';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { formatTime } from '../festivals/format';
import { MustSeeToggle } from './MustSeeToggle';
import { usePickReasons } from './usePickReasons';
import { clockTime, type DayRoute, type RouteStop, stintLabel } from './route';
import { elsewhereDuring, meetUps, namesLine, type Elsewhere, type MeetUp, type StarsFor } from './withFriends';

const at = (min: number) => formatTime(clockTime(min));
/** A gap this short is just a breather between sets. */
const SHORT_BREAK = 20;

/**
 * The full-day route: where to be from the first set to the last, set to
 * set, with when to leave and where to walk. Must-sees glow; discoveries are
 * dashed; breaks are quiet.
 */
export function RouteList({ festival, route }: { festival: Festival; route: DayRoute }) {
  const reason = usePickReasons();
  const { crewStarsFor } = useCrews();
  const { artist: artistOf } = useCatalog();
  const starsFor: StarsFor = (id) => crewStarsFor(festival.id, id);
  if (!route.stops.length) return <Text style={styles.summary}>Nothing on this day.</Text>;
  const sets = route.stops.filter((s): s is RouteStop => s.kind === 'set');
  const first = route.stops[0];
  const last = route.stops[route.stops.length - 1];
  return (
    <View>
      <Text style={styles.summary}>
        {sets.length} {sets.length === 1 ? 'set' : 'sets'}, {at(first.from)} to {at(last.to)}. Where to be all day.
      </Text>
      <MeetUps festival={festival} meets={meetUps(route, starsFor)} />
      {route.stops.map((stop, i) => {
        const prev = [...route.stops.slice(0, i)].reverse().find((s): s is RouteStop => s.kind === 'set');
        const isLast = i === route.stops.length - 1;
        return (
          <View key={`${stop.from}-${stop.kind === 'set' ? stop.artist.id : 'break'}`} style={styles.row}>
            <View style={styles.timeCol}>
              <Text style={styles.time}>{at(stop.from).split(' ')[0]}</Text>
              <Text style={styles.ampm}>{at(stop.from).split(' ')[1]}</Text>
            </View>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  stop.kind === 'break' && styles.dotBreak,
                  stop.kind === 'set' && stop.pinned && styles.dotStrong,
                  stop.kind === 'set' && !stop.known && styles.dotHollow,
                ]}
              />
              {!isLast && <View style={styles.line} />}
            </View>
            <View style={styles.body}>
              {stop.kind === 'break' ? (
                <Text style={styles.breakText}>
                  {stop.to - stop.from <= SHORT_BREAK
                    ? `${stop.to - stop.from} min break`
                    : `Break until ${at(stop.to)}. Nothing on for you.`}
                </Text>
              ) : (
                <StopCard
                  festival={festival}
                  stop={stop}
                  reason={reason(stop)}
                  walkFrom={prev && prev.set.stageId !== stop.set.stageId ? prev : undefined}
                  friends={starsFor(stop.artist.id)}
                  elsewhere={elsewhereDuring(festival, artistOf, stop, starsFor)}
                />
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * The sets on this day you'll be at with your crew (they starred them too):
 * where to find each other. Only when there's at least one.
 */
function MeetUps({ festival, meets }: { festival: Festival; meets: MeetUp[] }) {
  if (!meets.length) return null;
  return (
    <View style={styles.meets} accessible accessibilityLabel={`With your crew today. ${meets.map((m) => `${at(m.stop.from)}, ${m.stop.artist.name} at ${stageName(festival, m.stop.set.stageId)}, with ${namesLine(m.names)}`).join('. ')}`}>
      <Text style={styles.meetsTitle}>With your crew today</Text>
      {meets.map((m) => (
        <View key={`${m.stop.from}-${m.stop.artist.id}`} style={styles.meetRow}>
          <Text style={styles.meetTime}>{at(m.stop.from)}</Text>
          <View style={styles.text}>
            <Text style={styles.meetName} numberOfLines={1}>
              {m.stop.artist.name}
              <Text style={styles.meetStage}>{`  ${stageName(festival, m.stop.set.stageId)}`}</Text>
            </Text>
            <Text style={styles.meetWho} numberOfLines={1}>
              with {namesLine(m.names)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function StopCard({
  festival,
  stop,
  reason,
  walkFrom,
  friends,
  elsewhere,
}: {
  festival: Festival;
  stop: RouteStop;
  reason: string;
  walkFrom?: RouteStop;
  friends: string[];
  elsewhere: Elsewhere[];
}) {
  const stage = stageName(festival, stop.set.stageId);
  const pct = `${Math.round(stop.match * 100)}%`;
  const stint = stintLabel(stop);
  const label = stop.pinned ? 'Must see' : stop.known ? undefined : 'New to you';
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push({ pathname: '/artist/[id]', params: { id: stop.artist.id, festival: festival.id } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${at(stop.from)} to ${at(stop.to)}, ${stop.artist.name} at ${stage}, ${stint.toLowerCase()}${
        stop.known ? `, ${pct} match` : ', new to you'
      }${stop.pinned ? ', one of your must sees' : ''}${walkFrom ? `. Walk over from ${stageName(festival, walkFrom.set.stageId)}` : ''}. ${reason}${friends.length ? `. With ${namesLine(friends)}` : ''}${elsewhere
        .map((e) => `. ${e.name} is at ${e.artist.name}, ${stageName(festival, e.stageId)}, until ${at(e.end)}`)
        .join('')}`}
      style={({ pressed }) => [styles.card, !stop.known && styles.discovery, stop.pinned && styles.mustSee, pressed && { opacity: 0.7 }]}
    >
      {walkFrom ? <Text style={styles.walk}>Head to {stage}{stop.walk ? ` · ${stop.walk} min walk` : ''}</Text> : null}
      <View style={styles.line1}>
        <ArtistAvatar artist={stop.artist} size={36} />
        <View style={styles.text}>
          {label ? <Text style={[styles.label, stop.pinned && { color: color.glow }]}>{label}</Text> : null}
          <Text style={styles.name} numberOfLines={1}>
            {stop.artist.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {stage}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {stint}, {stop.to < stop.setEnd ? 'leave at' : 'until'} {at(stop.to)}
          </Text>
          {/* Why it's on your day, in your own signals. */}
          <Text style={styles.reason} numberOfLines={2}>
            {reason}
          </Text>
          {/* Your crew: who's here with you, and who's off at something else meanwhile. */}
          {friends.length ? (
            <Text style={styles.with} numberOfLines={1}>
              ★ With {namesLine(friends)}
            </Text>
          ) : null}
          {elsewhere.length ? (
            <Text style={styles.elsewhere} numberOfLines={2}>
              Meanwhile {elsewhere.map((e) => `${e.name} at ${e.artist.name} (${stageName(festival, e.stageId)}, until ${at(e.end)})`).join(', ')}
            </Text>
          ) : null}
        </View>
        <View style={styles.side}>
          {stop.known ? <Text style={[styles.match, stop.match >= 0.9 && { color: color.glow }]}>{pct}</Text> : null}
          <MustSeeToggle artist={stop.artist} festivalId={festival.id} size={18} />
        </View>
      </View>
      {/* What you're trading off: others you'd enjoy on at the same time. Star one to switch. */}
      {stop.alsoOn?.length ? (
        <View style={styles.also}>
          {stop.alsoOn.map((o) => (
            <View key={o.artist.id} style={styles.alsoRow}>
              <Pressable
                onPress={() => {
                  haptic.select();
                  router.push({ pathname: '/artist/[id]', params: { id: o.artist.id, festival: festival.id } });
                }}
                accessibilityRole="button"
                accessibilityLabel={`Also on: ${o.artist.name} at ${stageName(festival, o.set.stageId)}${o.known ? `, ${Math.round(o.match * 100)} percent match` : ''}. Opens the artist.`}
                hitSlop={4}
                style={({ pressed }) => [styles.alsoMain, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.alsoText} numberOfLines={1}>
                  <Text style={styles.alsoLabel}>Also on  </Text>
                  {o.artist.name}
                  <Text style={styles.alsoLabel}>{`  ${stageName(festival, o.set.stageId)}`}</Text>
                </Text>
                {o.known ? <Text style={styles.alsoPct}>{Math.round(o.match * 100)}%</Text> : null}
              </Pressable>
              {/* Star them here to have the route switch to them. */}
              <MustSeeToggle artist={o.artist} festivalId={festival.id} size={14} />
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summary: { ...type.caption, color: color.moonDim, marginTop: space.lg, marginBottom: space.md },
  meets: {
    marginBottom: space.lg,
    padding: space.md,
    gap: space.sm,
    borderRadius: radius.md,
    backgroundColor: glowA(0.08),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.35),
  },
  meetsTitle: { ...type.label, color: color.glow },
  meetRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  meetTime: { ...type.label, color: color.moon, width: 64, fontVariant: ['tabular-nums'] },
  meetName: { ...type.label, color: color.moon },
  meetStage: { ...type.caption, color: color.moonFaint },
  meetWho: { ...type.caption, color: color.moonDim, marginTop: 1 },
  with: { ...type.caption, color: color.glow, marginTop: 4 },
  elsewhere: { ...type.caption, color: color.moonFaint, marginTop: 2 },
  row: { flexDirection: 'row' },
  timeCol: { width: 50, paddingTop: space.md, alignItems: 'flex-end' },
  time: { ...type.label, color: color.moon, fontVariant: ['tabular-nums'] },
  ampm: { ...type.caption, fontSize: 10, color: color.moonFaint, marginTop: 1 },
  rail: { width: 20, alignItems: 'center', marginHorizontal: space.xs },
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
  dotBreak: { backgroundColor: color.hairline },
  line: { flex: 1, width: StyleSheet.hairlineWidth * 2, backgroundColor: color.hairline, marginTop: space.xs },
  body: { flex: 1, paddingBottom: space.md },
  breakText: { ...type.caption, color: color.moonFaint, paddingTop: space.md + 1 },
  card: {
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  mustSee: { borderColor: glowA(0.45), backgroundColor: glowA(0.10) },
  discovery: { backgroundColor: 'transparent', borderStyle: 'dashed', borderWidth: 1 },
  walk: { ...type.caption, color: color.glow, marginBottom: space.xs },
  line1: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  text: { flex: 1 },
  label: { ...type.caption, color: color.moonDim, marginBottom: 1 },
  name: { ...type.headline, color: color.moon },
  meta: { ...type.caption, color: color.moonDim, marginTop: 2 },
  reason: { ...type.caption, color: color.moonFaint, marginTop: 4 },
  side: { alignItems: 'center', marginRight: -6 },
  match: { ...type.label, color: color.moonDim, fontVariant: ['tabular-nums'] },
  also: {
    marginTop: space.sm,
    paddingTop: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairline,
  },
  alsoRow: { flexDirection: 'row', alignItems: 'center', marginRight: -6 },
  alsoMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 4 },
  alsoText: { ...type.caption, color: color.moon, flex: 1 },
  alsoLabel: { color: color.moonFaint },
  alsoPct: { ...type.caption, color: color.moonDim, fontVariant: ['tabular-nums'] },
});
