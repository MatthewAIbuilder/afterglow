import { useId } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { color, radius, space, type } from '../../theme/tokens';
import { type Milestone, type MilestoneId, nextMilestone, progressLine } from './milestones';

/** Each milestone's two colours (top left to bottom right). */
const COLORS: Record<MilestoneId, [string, string]> = {
  'first-festival': ['#A97CFF', '#5B3BC4'],
  hopper: ['#FF7EB6', '#A13A73'],
  ten: ['#FFD27A', '#B5781F'],
  'first-moment': ['#6FC3FF', '#2C5FB8'],
  moments: ['#7DE3C6', '#1F7F6E'],
  collector: ['#FFB86B', '#B85C2A'],
  crate: ['#C4A2FF', '#6A3FBF'],
  basshead: ['#5B8CFF', '#2A2F9C'],
  road: ['#FF9E7A', '#A33F2C'],
  og: ['#FFE38A', '#C9962B'],
};
const LOCKED: [string, string] = ['#4A4760', '#26243A'];

/** The glyph in the middle of a medal, drawn on a 24-unit grid. */
function Glyph({ id, stroke }: { id: MilestoneId; stroke: string }) {
  const p = { stroke, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (id) {
    case 'first-festival':
    case 'hopper':
      // A festival tent with a flag.
      return (
        <G>
          <Path d="M4 19 L12 7 L20 19 Z" {...p} />
          <Path d="M10 19 L12 14 L14 19" {...p} />
          <Line x1={12} y1={7} x2={12} y2={3.5} {...p} />
          <Path d="M12 3.5 L15.5 4.6 L12 5.8" {...p} />
          {id === 'hopper' ? <Path d="M2.5 19 L6 14 M21.5 19 L18 14" {...p} /> : null}
        </G>
      );
    case 'ten':
      return (
        <SvgText x={12} y={16.5} fontSize={12} fontWeight="800" fill={stroke} textAnchor="middle">
          10
        </SvgText>
      );
    case 'first-moment':
    case 'moments':
      // A camera.
      return (
        <G>
          <Rect x={3.5} y={7.5} width={12} height={10} rx={2.5} {...p} />
          <Path d="M15.5 11 L20.5 8.5 L20.5 16.5 L15.5 14" {...p} />
          {id === 'moments' ? <Circle cx={9.5} cy={12.5} r={2} {...p} /> : null}
        </G>
      );
    case 'collector':
      // A bookmark.
      return <Path d="M7 4 H17 V20 L12 16.5 L7 20 Z" {...p} />;
    case 'crate':
      // Stacked records.
      return (
        <G>
          <Circle cx={12} cy={12} r={7.5} {...p} />
          <Circle cx={12} cy={12} r={2} {...p} />
          <Path d="M12 4.5 A7.5 7.5 0 0 1 19.5 12" {...p} strokeOpacity={0.5} />
        </G>
      );
    case 'basshead':
      // A bass wave.
      return <Path d="M3 12 L6 12 L8 6 L11 18 L13.5 4 L16 20 L18 9 L19.5 12 L21 12" {...p} />;
    case 'road':
      // A winding road to a pin.
      return (
        <G>
          <Path d="M6 21 C6 16 14 16 14 12 C14 9 10 9 10 6" {...p} />
          <Circle cx={17} cy={7} r={2.6} {...p} />
          <Path d="M17 9.6 L17 12.5" {...p} />
        </G>
      );
    case 'og':
      // A star.
      return <Path d="M12 3.5 L14.4 9 L20.3 9.5 L15.8 13.4 L17.2 19.3 L12 16.2 L6.8 19.3 L8.2 13.4 L3.7 9.5 L9.6 9 Z" {...p} />;
  }
}

/** A round medal: a coloured disc with a bright rim and the glyph; grey until earned, with its progress as an arc. */
export function Medal({ milestone, size = 64 }: { milestone: Milestone; size?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [a, b] = milestone.earned ? COLORS[milestone.id] : LOCKED;
  const r = size / 2;
  const ring = r - 3;
  const done = milestone.earned ? 1 : milestone.current / milestone.target;
  const circ = 2 * Math.PI * ring;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {milestone.earned ? <View style={[styles.halo, { width: size, height: size, borderRadius: r, shadowColor: a }]} /> : null}
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={`m${id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={a} />
            <Stop offset="1" stopColor={b} />
          </LinearGradient>
          <LinearGradient id={`gl${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.35} />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Circle cx={r} cy={r} r={r - 6} fill={`url(#m${id})`} />
        <Circle cx={r} cy={r} r={r - 6} fill={`url(#gl${id})`} />
        <Circle cx={r} cy={r} r={ring} stroke="rgba(243,240,255,0.14)" strokeWidth={2.5} fill="none" />
        {done > 0 ? (
          <Circle
            cx={r}
            cy={r}
            r={ring}
            stroke={milestone.earned ? '#FFF6D8' : color.glow}
            strokeWidth={2.5}
            fill="none"
            strokeDasharray={`${circ * done} ${circ}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${r} ${r})`}
          />
        ) : null}
        <G transform={`translate(${r - size * 0.22} ${r - size * 0.22}) scale(${(size * 0.44) / 24})`}>
          <Glyph id={milestone.id} stroke={milestone.earned ? '#FFFFFF' : 'rgba(243,240,255,0.45)'} />
        </G>
      </Svg>
    </View>
  );
}

/**
 * Milestones on your Badges tab: the one you're closest to as a card with
 * its progress, then every milestone in a row to swipe.
 */
export function MilestonesSection({ list }: { list: Milestone[] }) {
  const next = nextMilestone(list);
  const earned = list.filter((m) => m.earned).length;
  return (
    <View style={styles.root}>
      {next ? (
        <View style={styles.next} accessible accessibilityLabel={`Your next badge: ${next.title}. ${next.how}. ${progressLine(next)}`}>
          <Medal milestone={next} size={58} />
          <View style={{ flex: 1 }}>
            <Text style={styles.nextKicker}>Your next badge</Text>
            <Text style={styles.nextTitle}>{next.title}</Text>
            <Text style={styles.nextHow}>{next.how}</Text>
            <View style={styles.barRow}>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round((next.current / next.target) * 100)}%` }]} />
              </View>
              <Text style={styles.count}>
                {next.current}/{next.target}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
      <Text style={styles.head}>
        Milestones · {earned} of {list.length}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {list.map((m) => (
          <View
            key={m.id}
            style={[styles.item, !m.earned && { opacity: 0.8 }]}
            accessible
            accessibilityLabel={`${m.title}. ${m.earned ? 'Earned' : `${m.how}, ${progressLine(m)}`}`}
          >
            <Medal milestone={m} />
            <Text style={[styles.itemTitle, !m.earned && { color: color.moonDim }]} numberOfLines={2}>
              {m.title}
            </Text>
            <Text style={styles.itemDetail} numberOfLines={1}>
              {m.earned ? (m.id === 'og' ? m.how.split(' · ')[1] : 'Earned') : progressLine(m)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingTop: space.lg },
  halo: { position: 'absolute', shadowOpacity: 0.75, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, backgroundColor: 'rgba(0,0,0,0.01)' },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(169,124,255,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.45)',
  },
  nextKicker: { ...type.caption, color: color.glow, textTransform: 'uppercase', letterSpacing: 0.8 },
  nextTitle: { ...type.headline, color: color.moon, marginTop: 2 },
  nextHow: { ...type.caption, color: color.moonDim },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  track: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(243,240,255,0.10)', overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3, backgroundColor: color.glow },
  count: { ...type.caption, color: color.moonDim, fontVariant: ['tabular-nums'] },
  head: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.xl, marginBottom: space.sm, marginHorizontal: space.xl },
  row: { paddingHorizontal: space.lg, gap: space.md },
  item: { width: 76, alignItems: 'center' },
  itemTitle: { ...type.caption, color: color.moon, textAlign: 'center', marginTop: 6, fontWeight: '600' },
  itemDetail: { ...type.caption, fontSize: 11, color: color.moonFaint, textAlign: 'center' },
});
