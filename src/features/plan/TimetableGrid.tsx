import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Festival } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { usePlan } from '../../state/plan';
import { useTaste } from '../../state/taste';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { formatTime } from '../festivals/format';
import { StarIcon } from './icons';
import { type GridBlock, gridDay, hourLabel } from './grid';
import type { DayRoute } from './route';

/** Points per minute: an hour is 96 points tall. */
const PER_MIN = 1.6;
const COLUMN = 118;
const GUTTER = 44;
const HEAD = 34;

/**
 * Every set of the day as a timetable: stages side by side (scroll across
 * when there are many), time running down. Your route's sets have a glowing
 * edge, must-sees glow, strong matches are brighter, and artists new to you
 * are dashed. Tap a set to open the artist.
 */
export function TimetableGrid({ festival, day, route }: { festival: Festival; day: string; route?: DayRoute }) {
  const { taste, informed } = useTaste();
  const catalog = useCatalog();
  const { mustSeesAt } = usePlan();
  const grid = useMemo(
    () => gridDay(festival, day, { artist: catalog.artist, taste, informed, pinned: mustSeesAt(festival.id), route }),
    [festival, day, catalog.artist, taste, informed, mustSeesAt, route],
  );
  if (!grid) return <Text style={styles.empty}>No set times on this day.</Text>;
  const height = (grid.to - grid.from) * PER_MIN;
  const y = (min: number) => (min - grid.from) * PER_MIN;

  return (
    <View style={styles.wrap}>
      <Text style={styles.legend}>Your route glows at the edge. Tap a set to see the artist.</Text>
      <View style={styles.row}>
        {/* The hours, fixed on the left. */}
        <View style={{ width: GUTTER, height: height + HEAD }} importantForAccessibility="no-hide-descendants">
          {grid.hours.map((h) => (
            <Text key={h} style={[styles.hour, { top: HEAD + y(h) - 7 }]}>
              {hourLabel(h)}
            </Text>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: space.lg }}>
          <View style={{ width: grid.stages.length * COLUMN, height: height + HEAD }}>
            {grid.stages.map((s, i) => (
              <Text key={s.id} style={[styles.stage, { left: i * COLUMN, width: COLUMN - 6 }]} numberOfLines={1}>
                {s.name}
              </Text>
            ))}
            {grid.hours.map((h) => (
              <View key={h} style={[styles.line, { top: HEAD + y(h), width: grid.stages.length * COLUMN }]} />
            ))}
            {grid.blocks.map((b) => (
              <Block key={`${b.set.artistId}-${b.set.stageId}-${b.set.start}`} festival={festival} block={b} top={HEAD + y(b.start)} height={(b.end - b.start) * PER_MIN} stage={grid.stages[b.column].name} />
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function Block({ festival, block: b, top, height, stage }: { festival: Festival; block: GridBlock; top: number; height: number; stage: string }) {
  const short = height < 44;
  const pct = `${Math.round(b.match * 100)}%`;
  const label = [
    b.artist.name,
    `${formatTime(b.set.start)} to ${formatTime(b.set.end)}`,
    stage,
    b.pinned ? 'your must-see' : b.known ? `${pct} match` : 'new to you',
    b.onRoute ? 'on your route' : '',
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push({ pathname: '/artist/[id]', params: { id: b.artist.id, festival: festival.id } });
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.block,
        TONE[b.tone],
        { top, height: Math.max(height - 2, 18), left: b.column * COLUMN },
        b.onRoute && styles.onRoute,
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={styles.nameRow}>
        {b.pinned ? <StarIcon color={color.glow} size={10} filled /> : null}
        <Text style={[styles.name, (b.tone === 'low' || b.tone === 'new') && { color: color.moonDim }]} numberOfLines={short ? 1 : 2}>
          {b.artist.name}
        </Text>
      </View>
      {!short && (
        <Text style={styles.meta} numberOfLines={1}>
          {formatTime(b.set.start).replace(/ (AM|PM)$/, '')}
          {b.known ? ` · ${pct}` : ' · New'}
        </Text>
      )}
    </Pressable>
  );
}

const TONE = StyleSheet.create({
  must: { backgroundColor: glowA(0.34), borderColor: glowA(0.8) },
  strong: { backgroundColor: glowA(0.2), borderColor: glowA(0.4) },
  some: { backgroundColor: color.glass, borderColor: color.hairline },
  new: { backgroundColor: 'transparent', borderColor: color.hairline, borderStyle: 'dashed' },
  low: { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'transparent' },
});

const styles = StyleSheet.create({
  wrap: { marginTop: space.lg },
  legend: { ...type.caption, color: color.moonDim, marginBottom: space.md },
  row: { flexDirection: 'row' },
  hour: { position: 'absolute', left: 0, width: GUTTER - 6, textAlign: 'right', ...type.caption, fontSize: 10, color: color.moonFaint, fontVariant: ['tabular-nums'] },
  stage: { position: 'absolute', top: 6, ...type.label, color: color.moonDim, paddingHorizontal: 4 },
  line: { position: 'absolute', left: 0, height: StyleSheet.hairlineWidth, backgroundColor: color.hairline },
  block: {
    position: 'absolute',
    width: COLUMN - 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  onRoute: { borderLeftWidth: 3, borderLeftColor: color.glow },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  name: { ...type.caption, fontWeight: '600', color: color.moon, flexShrink: 1 },
  meta: { ...type.caption, fontSize: 10, color: color.moonDim, marginTop: 2, fontVariant: ['tabular-nums'] },
  empty: { ...type.caption, color: color.moonDim, marginTop: space.lg },
});
