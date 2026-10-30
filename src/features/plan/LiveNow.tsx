import { StyleSheet, Text, View } from 'react-native';
import { stageName } from '../../data/festival';
import type { Festival } from '../../data/types';
import { useNow } from '../../lib/useNow';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { formatTime } from '../festivals/format';
import { breakLabel } from './hours';
import { liveNow, liveRoute } from './live';
import type { Schedule, TimedPick } from './plan';
import { clockTime, type DayRoute, type RouteStop } from './route';
import { dayWord, t } from '../../i18n';
import { AskCard } from '../seen/AskCard';

/**
 * During the festival, above your plan: what to watch right now and what's
 * next. Nothing outside the festival's nights.
 */
export function LiveNow({ festival, schedule, route }: { festival: Festival; schedule: Schedule; route?: DayRoute[] }) {
  const now = useNow();
  if (route)
    return (
      <>
        {/* How was the set you just left? */}
        <AskCard festival={festival} route={route} />
        <RouteNow festival={festival} route={route} now={now} />
      </>
    );
  const live = liveNow(festival, schedule, now);
  if (!live) return null;

  const names = (list: TimedPick[]) => list.map((p) => p.artist.name).join(t(' or '));
  const where = (p: TimedPick) => stageName(festival, p.set.stageId);
  const first = live.now[0];
  const nowLine = first
    ? `${live.nowIsDiscovery ? `${t('Something new')} · ` : ''}${t('{where}, until {time}', { where: live.now.length > 1 ? t('A close call, your pick') : where(first), time: formatTime(first.set.end) })}`
    : undefined;
  const upcoming = live.next?.[0];
  const nextLine = upcoming
    ? `${formatTime(upcoming.set.start)}  ${names(live.next!)}${live.next!.length > 1 ? '' : `, ${where(upcoming)}`}${live.nextIsDiscovery ? `  ·  ${t('something new')}` : ''}`
    : t('That’s everything on your plan tonight.');

  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={[
        t('{day} night.', { day: dayWord(live.night.day) }),
        first ? `${t('On now: {names}.', { names: names(live.now) })} ${nowLine}.` : t('Nothing on your plan right now.'),
        upcoming ? t('Next: {line}.', { line: nextLine.replace(/ {2}/g, ', ') }) : nextLine,
      ].join(' ')}
    >
      <View style={styles.head}>
        <View style={styles.dot} />
        <Text style={styles.label}>{t('Now · {day}', { day: t(live.night.day) })}</Text>
      </View>
      {first ? (
        <>
          <Text style={styles.name}>{names(live.now)}</Text>
          <Text style={styles.meta}>{nowLine}</Text>
        </>
      ) : (
        <Text style={styles.quiet}>{t('Nothing on your plan right now.')}</Text>
      )}
      <View style={styles.divider} />
      <Text style={styles.nextLabel}>{t('Next')}</Text>
      <Text style={styles.next}>{nextLine}</Text>
    </View>
  );
}

/** Live from the full-day route: the set to be at now (and when to leave), and where to go next. */
function RouteNow({ festival, route, now }: { festival: Festival; route: DayRoute[]; now: Date }) {
  const live = liveRoute(festival, route, now);
  if (!live) return null;
  const at = (min: number) => formatTime(clockTime(min));
  const where = (s: RouteStop) => stageName(festival, s.set.stageId);
  const cur = live.now;
  const next = live.next;
  // In one of your own breaks: say which, and until when.
  const quiet = live.pause ? t('{label} until {time}.', { label: live.pause.label != null ? breakLabel(live.pause.label) : t('Your break'), time: at(live.pause.to) }) : t('A break right now.');
  // Leaving before the set ends is worth saying out loud.
  const nowLine = cur
    ? `${cur.known ? '' : `${t('Something new')} · `}${cur.to < cur.setEnd ? t('{where}, leave at {time}', { where: where(cur), time: at(cur.to) }) : t('{where}, until {time}', { where: where(cur), time: at(cur.to) })}`
    : undefined;
  const move = next && cur && next.set.stageId !== cur.set.stageId ? ` (${t('head over')})` : '';
  const nextLine = next
    ? `${at(next.from)}  ${next.artist.name}, ${where(next)}${move}${next.known ? '' : `  ·  ${t('something new')}`}`
    : t('That’s everything on your plan tonight.');

  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={[
        t('{day} night.', { day: dayWord(live.night.day) }),
        cur ? `${t('On now: {names}.', { names: cur.artist.name })} ${nowLine}.` : quiet,
        next ? t('Next: {line}.', { line: nextLine.replace(/ {2}/g, ', ') }) : nextLine,
      ].join(' ')}
    >
      <View style={styles.head}>
        <View style={styles.dot} />
        <Text style={styles.label}>{t('Now · {day}', { day: t(live.night.day) })}</Text>
      </View>
      {cur ? (
        <>
          <Text style={styles.name}>{cur.artist.name}</Text>
          <Text style={styles.meta}>{nowLine}</Text>
        </>
      ) : (
        <Text style={styles.quiet}>{quiet}</Text>
      )}
      <View style={styles.divider} />
      <Text style={styles.nextLabel}>{t('Next')}</Text>
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
    backgroundColor: glowA(0.12),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.45),
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
