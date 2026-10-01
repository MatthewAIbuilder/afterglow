import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FilterChips } from '../../components/FilterChips';
import { stageName } from '../../data/festival';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { shareMessage } from '../../lib/share';
import { useCatalog } from '../../state/catalog';
import { useTaste } from '../../state/taste';
import { color, radius, space, type } from '../../theme/tokens';
import { formatTime } from '../festivals/format';
import { clockTime, stintLabel } from '../plan/route';
import { crewRoute, type CrewDay, namesLine } from './crewRoute';

const at = (min: number) => formatTime(clockTime(min));

/**
 * "Our route": one set-to-set plan for the crew once set times are out, from
 * your taste pulled towards everyone's stars, with who splits off where.
 */
export function CrewRouteSection({
  festival,
  me,
  members,
  stars,
  nameOf,
  crewName,
}: {
  festival: Festival;
  me: string;
  members: readonly string[];
  stars: Record<string, readonly string[]>;
  nameOf: (uid: string) => string;
  crewName: string;
}) {
  const { taste, informed } = useTaste();
  const { artists } = useCatalog();
  const days = useMemo(
    () => crewRoute({ festival, artists, taste, informed, me, stars, members }),
    [festival, artists, taste, informed, me, stars, members],
  );
  const withSets = days.filter((d) => d.stops.length);
  const [picked, setPicked] = useState<string | undefined>();
  const day = withSets.find((d) => d.day === picked) ?? withSets[0];
  if (!day) return null;

  const share = () => {
    haptic.select();
    void shareMessage(crewRouteText(festival, crewName, withSets, me, nameOf), `${crewName} at ${festival.name}`);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.section}>Our route</Text>
        <Pressable onPress={share} accessibilityRole="button" accessibilityLabel="Share our route" hitSlop={8}>
          <Text style={styles.link}>Share</Text>
        </Pressable>
      </View>
      <Text style={styles.note}>Set to set for the whole crew: your taste, pulled towards everyone’s stars. Sets half of you starred are must-sees.</Text>
      {withSets.length > 1 ? (
        <FilterChips
          chips={withSets.map((d) => ({ key: d.day, label: d.day, accessibilityLabel: `${d.day}, ${d.stops.filter((s) => s.kind === 'set').length} sets` }))}
          value={day.day}
          onChange={(k) => setPicked(k ?? withSets[0].day)}
          inset={0}
        />
      ) : null}
      <DayList festival={festival} day={day} me={me} nameOf={nameOf} />
    </View>
  );
}

function DayList({ festival, day, me, nameOf }: { festival: Festival; day: CrewDay; me: string; nameOf: (uid: string) => string }) {
  return (
    <View style={styles.list}>
      {day.stops.map((stop) =>
        stop.kind === 'break' ? (
          <Text key={`break-${stop.from}`} style={styles.break}>
            {stop.to - stop.from <= 20 ? `${stop.to - stop.from} min break` : `Break until ${at(stop.to)}`}
          </Text>
        ) : (
          <Pressable
            key={`${stop.artist.id}-${stop.from}`}
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/artist/[id]', params: { id: stop.artist.id, festival: festival.id } });
            }}
            accessibilityRole="button"
            accessibilityLabel={`${at(stop.from)}, ${stop.artist.name}, ${stageName(festival, stop.set.stageId)}, ${stintLabel(stop).toLowerCase()}${stop.pinned ? ', a must-see for the crew' : ''}${day.starredBy[stop.artist.id] ? `, starred by ${namesLine(day.starredBy[stop.artist.id], me, nameOf)}` : ''}`}
            style={({ pressed }) => [styles.stop, stop.pinned && styles.must, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.time}>{at(stop.from)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {stop.artist.name}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {stageName(festival, stop.set.stageId)} · {stintLabel(stop)}
              </Text>
              {day.starredBy[stop.artist.id] ? (
                <Text style={styles.stars} numberOfLines={1}>
                  ★ {namesLine(day.starredBy[stop.artist.id], me, nameOf)}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ),
      )}
      {day.splits.map((s) => (
        <View
          key={`split-${s.artist.id}-${s.set.start}`}
          style={styles.split}
          accessible
          accessibilityLabel={`${namesLine(s.who, me, nameOf)} could split off for ${s.artist.name} at ${formatTime(s.set.start)}, ${stageName(festival, s.set.stageId)}${s.during ? `, while the crew is at ${s.during.name}` : ''}. Meet up at ${formatTime(s.backAt)}.`}
        >
          <Text style={styles.splitHead}>Split off</Text>
          <Text style={styles.splitText}>
            {namesLine(s.who, me, nameOf)} → {s.artist.name}, {formatTime(s.set.start)}, {stageName(festival, s.set.stageId)}
            {s.during ? ` (crew at ${s.during.name})` : ''}. Meet up at {formatTime(s.backAt)}.
          </Text>
        </View>
      ))}
    </View>
  );
}

/** The crew's route as a message. */
export function crewRouteText(festival: Festival, crewName: string, days: CrewDay[], me: string, nameOf: (uid: string) => string): string {
  const parts = [`${crewName} at ${festival.name}, set to set`];
  for (const d of days) {
    parts.push('', d.day);
    for (const s of d.stops) {
      if (s.kind !== 'set') continue;
      parts.push(`${at(s.from)}  ${s.pinned ? '★ ' : ''}${s.artist.name}, ${stageName(festival, s.set.stageId)}`);
    }
    for (const s of d.splits) parts.push(`Split: ${namesLine(s.who, me, nameOf)} to ${s.artist.name} at ${formatTime(s.set.start)}`);
  }
  parts.push('', 'Made with Afterglow');
  return parts.join('\n');
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8 },
  link: { ...type.label, color: color.glow },
  note: { ...type.caption, color: color.moonFaint },
  list: { gap: space.sm, marginTop: space.xs },
  stop: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  must: { borderColor: 'rgba(169,124,255,0.55)', backgroundColor: 'rgba(169,124,255,0.1)' },
  time: { ...type.label, color: color.moonDim, width: 64, fontVariant: ['tabular-nums'] },
  name: { ...type.headline, color: color.moon },
  meta: { ...type.caption, color: color.moonDim, marginTop: 2 },
  stars: { ...type.caption, color: color.glow, marginTop: 2 },
  break: { ...type.caption, color: color.moonFaint, paddingLeft: 64 + space.md + space.md },
  split: { padding: space.md, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: color.hairline, gap: 2 },
  splitHead: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8 },
  splitText: { ...type.body, color: color.moon },
});
