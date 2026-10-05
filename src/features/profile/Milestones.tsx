import { useEffect, useId, useState } from 'react';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { haptic } from '../../lib/haptics';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { color, radius, space, type } from '../../theme/tokens';
import { type Milestone, type MilestoneId, nextMilestone, progressLine } from './milestones';
import type { QuestId } from '../quests/quests';

/** Each milestone's two colours (top left to bottom right). */
const COLORS: Record<MilestoneId | QuestId, [string, string]> = {
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
  streak7: ['#FFB86B', '#C2477E'],
  streak30: ['#FFD36E', '#E0567A'],
  neon: ['#FF7EF0', '#5B3BC4'],
  green: ['#8FF0B4', '#1E8F4A'],
  giver: ['#9EF2C0', '#C2477E'],
  gardener: ['#C2F0A0', '#1F7F6E'],
  scout: ['#8FE3FF', '#5B3BC4'],
  // Side quests.
  plur: ['#FF7EB6', '#7A3CC8'],
  wavelength: ['#6FC3FF', '#7A3CC8'],
  fam: ['#FFB86B', '#C2477E'],
  crew4: ['#7DE3C6', '#3B5BC4'],
  sync: ['#B98CFF', '#2C8FB8'],
  lookout: ['#FF9E9E', '#B23A5A'],
  beacon: ['#FFE38A', '#D2742A'],
  sunrise: ['#FFD27A', '#E0567A'],
  everynight: ['#8FA2FF', '#3A2A8C'],
  stages: ['#9EF0A8', '#2F8A6E'],
  sproutswap: ['#8FF0B4', '#7A3CC8'],
  sproutlove: ['#9EF2C0', '#E0567A'],
};
const LOCKED: [string, string] = ['#4A4760', '#26243A'];
/** A milestone's two colours, for its unlock. */
export const medalColors = (id: MilestoneId | QuestId): [string, string] => COLORS[id];

/** The glyph in the middle of a medal, drawn on a 24-unit grid. */
function Glyph({ id, stroke }: { id: MilestoneId | QuestId; stroke: string }) {
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
    case 'streak7':
    case 'streak30':
      // A flame.
      return (
        <G>
          <Path d="M12 3 C12.8 7 18 9.6 18 14.5 A6 6 0 0 1 6 14.5 C6 11.8 7.4 10.2 8.6 9 C8.8 10.8 9.6 12 10.8 12.4 C10.2 9.2 11.2 6.2 12 3 Z" {...p} />
          {id === 'streak30' ? <Path d="M12 13 C13.6 14.4 14.6 15.6 14.6 17 A2.6 2.6 0 0 1 9.4 17 C9.4 15.6 10.4 14.4 12 13 Z" {...p} /> : null}
        </G>
      );
    case 'neon':
      // A four-pointed spark.
      return <Path d="M12 3 C12.6 8 16 11.4 21 12 C16 12.6 12.6 16 12 21 C11.4 16 8 12.6 3 12 C8 11.4 11.4 8 12 3 Z" {...p} />;
    case 'green':
      // A sprout: a stem and two leaves.
      return (
        <G>
          <Path d="M12 21 L12 11" {...p} />
          <Path d="M12 12 C12 7 7 5 4 6 C4 10 8 12.5 12 12 Z" {...p} />
          <Path d="M12 14 C12 10 16 8 20 9 C20 12.5 16.5 14.5 12 14 Z" {...p} />
        </G>
      );
    case 'giver':
      // A heart with a leaf on top.
      return (
        <G>
          <Path d="M12 21 C6.5 17 4 14 4 11 A3.8 3.8 0 0 1 12 9.5 A3.8 3.8 0 0 1 20 11 C20 14 17.5 17 12 21 Z" {...p} />
          <Path d="M12 9.5 C12 6 14 3.5 17 3.5 C17 6.5 15 8.5 12 9.5" {...p} />
        </G>
      );
    case 'gardener':
      // Three sprouts in a row.
      return (
        <G>
          <Path d="M3 20 L21 20" {...p} />
          {[6, 12, 18].map((x) => (
            <G key={x}>
              <Path d={`M${x} 20 L${x} ${x === 12 ? 9 : 13}`} {...p} />
              <Path d={`M${x} ${x === 12 ? 11 : 15} C${x} ${x === 12 ? 8 : 12.5} ${x - 3} ${x === 12 ? 7 : 11.5} ${x - 3.5} ${x === 12 ? 8 : 12}`} {...p} />
              <Path d={`M${x} ${x === 12 ? 10 : 14} C${x} ${x === 12 ? 7 : 11.5} ${x + 3} ${x === 12 ? 6 : 10.5} ${x + 3.5} ${x === 12 ? 7 : 11}`} {...p} />
            </G>
          ))}
        </G>
      );
    case 'scout':
      // A timetable with a clock on it.
      return (
        <G>
          <Rect x={3.5} y={4.5} width={13} height={15} rx={2} {...p} />
          <Path d="M6.5 9 H13.5 M6.5 12.5 H11" {...p} />
          <Circle cx={16.5} cy={16} r={4.5} {...p} />
          <Path d="M16.5 13.8 V16 L18 17" {...p} />
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
    case 'plur':
      // Two hands making a heart.
      return <Path d="M12 20 C6 15.5 3.5 12.5 3.5 9.2 A4.2 4.2 0 0 1 12 7.2 A4.2 4.2 0 0 1 20.5 9.2 C20.5 12.5 18 15.5 12 20 Z" {...p} />;
    case 'wavelength':
      // Two waves in step.
      return (
        <G>
          <Path d="M3 9 C5.5 5.5 8 5.5 10.5 9 S15.5 12.5 18 9 S21 7 21 7" {...p} />
          <Path d="M3 15 C5.5 11.5 8 11.5 10.5 15 S15.5 18.5 18 15 S21 13 21 13" {...p} />
        </G>
      );
    case 'fam':
      // Three faces.
      return (
        <G>
          <Circle cx={12} cy={8} r={2.6} {...p} />
          <Circle cx={5.5} cy={10.5} r={2.1} {...p} />
          <Circle cx={18.5} cy={10.5} r={2.1} {...p} />
          <Path d="M7.5 19.5 C8 15.5 16 15.5 16.5 19.5 M2.5 18 C3 15.5 6 14.5 8 15 M21.5 18 C21 15.5 18 14.5 16 15" {...p} />
        </G>
      );
    case 'crew4':
      // Four dots in a ring, linked.
      return (
        <G>
          <Circle cx={12} cy={4.5} r={2} {...p} />
          <Circle cx={19.5} cy={12} r={2} {...p} />
          <Circle cx={12} cy={19.5} r={2} {...p} />
          <Circle cx={4.5} cy={12} r={2} {...p} />
          <Path d="M13.5 6 L18 10.5 M18 13.5 L13.5 18 M10.5 18 L6 13.5 M6 10.5 L10.5 6" {...p} />
        </G>
      );
    case 'sync':
      // Two pins on one spot.
      return (
        <G>
          <Path d="M8.5 20 C5 15.5 3.5 12.8 3.5 10.5 A5 5 0 0 1 13.5 10.5 C13.5 12.8 12 15.5 8.5 20 Z" {...p} />
          <Path d="M15.5 20 C12 15.5 10.5 12.8 10.5 10.5 A5 5 0 0 1 20.5 10.5 C20.5 12.8 19 15.5 15.5 20 Z" {...p} />
        </G>
      );
    case 'lookout':
      // A hand holding a heart.
      return (
        <G>
          <Path d="M12 12.5 C9.5 10.7 8.3 9.4 8.3 8 A1.9 1.9 0 0 1 12 7.3 A1.9 1.9 0 0 1 15.7 8 C15.7 9.4 14.5 10.7 12 12.5 Z" {...p} />
          <Path d="M3 15 L7 15 L10.5 17 L16 17 C17 17 17 15.5 16 15.5 L12.5 15.5 M7 15 L7 20 M3 20 L7 20 M10.5 17 L19 13.5 C20.5 13 21.3 14.6 20 15.5 L13 20 L7 20" {...p} />
        </G>
      );
    case 'beacon':
      // A lighthouse beam.
      return (
        <G>
          <Path d="M10 21 L11 9 L13 9 L14 21 Z M10.5 9 L12 5.5 L13.5 9" {...p} />
          <Path d="M14.5 7 L21 4.5 M14.5 9.5 L21 11 M9.5 7 L3 4.5 M9.5 9.5 L3 11" {...p} />
        </G>
      );
    case 'sunrise':
      // The sun over the horizon.
      return (
        <G>
          <Path d="M6 16 A6 6 0 0 1 18 16" {...p} />
          <Path d="M2.5 19 L21.5 19 M12 5 L12 7.5 M5 8 L6.7 9.7 M19 8 L17.3 9.7 M2.5 13 L4.5 13 M21.5 13 L19.5 13" {...p} />
        </G>
      );
    case 'everynight':
      // A moon and stars.
      return (
        <G>
          <Path d="M15.5 4.5 A7.5 7.5 0 1 0 19.5 15 A6 6 0 0 1 15.5 4.5 Z" {...p} />
          <Path d="M19 4 L19 7 M17.5 5.5 L20.5 5.5" {...p} />
        </G>
      );
    case 'sproutswap':
      // Two sprouts leaning together.
      return (
        <G>
          <Path d="M8 21 C8 16 9 13 11 11" {...p} />
          <Path d="M16 21 C16 16 15 13 13 11" {...p} />
          <Path d="M10 13 C7 12 5 9 5 6.5 C8 6.5 10 9 10 13" {...p} />
          <Path d="M14 13 C17 12 19 9 19 6.5 C16 6.5 14 9 14 13" {...p} />
        </G>
      );
    case 'sproutlove':
      // A sprout with a heart for a bloom.
      return (
        <G>
          <Path d="M12 21 L12 12" {...p} />
          <Path d="M12 16 C9 16 6.5 14.5 6 12 C9 11.8 11 13.5 12 16" {...p} />
          <Path d="M12 9.5 C9.2 7.6 8 6.3 8 5 A2 2 0 0 1 12 4.4 A2 2 0 0 1 16 5 C16 6.3 14.8 7.6 12 9.5 Z" {...p} />
        </G>
      );
    case 'stages':
      // Three stages, stepping up.
      return <Path d="M3 20 L3 15 L8.5 15 L8.5 11 L14.5 11 L14.5 6.5 L21 6.5 L21 20 Z M3 20 L21 20" {...p} />;
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
 * its progress, then every milestone in a row to swipe. Each opens a short
 * description; one you've earned but not claimed glows "New" and claims.
 */
export function MilestonesSection({
  list,
  isNew,
  onClaim,
  title = 'Milestones',
  intro,
  showNext = true,
}: {
  list: Milestone[];
  isNew?: (m: Milestone) => boolean;
  onClaim?: (m: Milestone) => void;
  title?: string;
  /** A line under the title. */
  intro?: string;
  showNext?: boolean;
}) {
  const [open, setOpen] = useState<Milestone | undefined>();
  const next = showNext ? nextMilestone(list) : undefined;
  const earned = list.filter((m) => m.earned).length;
  const tap = (m: Milestone) => {
    haptic.select();
    if (isNew?.(m) && onClaim) onClaim(m);
    else setOpen(m);
  };
  return (
    <View style={styles.root}>
      <Text style={styles.head} accessibilityRole="header">
        {title} · {earned} of {list.length}
      </Text>
      {intro ? <Text style={styles.intro}>{intro}</Text> : null}
      {next ? (
        <Pressable
          onPress={() => tap(next)}
          style={({ pressed }) => [styles.next, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={`Your next badge: ${next.title}. ${next.how}. ${progressLine(next)}`}
        >
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
        </Pressable>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={{ marginTop: space.lg }}>
        {list.map((m) => {
          const fresh = !!isNew?.(m);
          return (
            <Pressable
              key={m.id}
              onPress={() => tap(m)}
              style={({ pressed }) => [styles.item, !m.earned && { opacity: 0.8 }, pressed && { transform: [{ scale: 0.95 }] }]}
              accessibilityRole="button"
              accessibilityLabel={`${m.title}. ${fresh ? 'New badge, tap to claim' : m.earned ? 'Earned' : `${m.how}, ${progressLine(m)}`}`}
            >
              <Medal milestone={m} />
              {fresh ? <NewTag /> : null}
              <Text style={[styles.itemTitle, !m.earned && { color: color.moonDim }]} numberOfLines={2}>
                {m.title}
              </Text>
              <Text style={[styles.itemDetail, fresh && { color: '#FFE38A' }]} numberOfLines={1}>
                {fresh ? 'Tap to claim' : m.earned ? (m.id === 'og' ? m.how.split(' · ')[1] : 'Earned') : progressLine(m)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <MilestoneSheet milestone={open} onClose={() => setOpen(undefined)} />
    </View>
  );
}

/** A small glowing "New" tag on a badge waiting to be claimed. */
export function NewTag({ inline }: { inline?: boolean } = {}) {
  const reduce = useReducedMotion();
  const beat = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    beat.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(beat);
  }, [reduce, beat]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.08 * beat.get() }] }));
  return (
    <Animated.View style={[styles.newTag, inline && styles.newInline, style]} pointerEvents="none">
      <Text style={styles.newText}>NEW</Text>
    </Animated.View>
  );
}

/** What a milestone is: the medal big, its name, a sentence about it, and how far along you are. */
function MilestoneSheet({ milestone, onClose }: { milestone: Milestone | undefined; onClose: () => void }) {
  return (
    <Modal visible={!!milestone} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.sheetScrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
        {milestone ? (
          <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
            <Medal milestone={milestone} size={120} />
            <Text style={[styles.sheetKicker, milestone.earned && { color: '#FFE38A' }]}>{milestone.earned ? 'Earned' : 'Still to earn'}</Text>
            <Text style={styles.sheetTitle} accessibilityRole="header">
              {milestone.title}
            </Text>
            <Text style={styles.sheetAbout}>{milestone.about}</Text>
            {milestone.earned ? null : (
              <View style={styles.sheetProgress}>
                <View style={styles.barRow}>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.round((milestone.current / milestone.target) * 100)}%` }]} />
                  </View>
                  <Text style={styles.count}>{progressLine(milestone)}</Text>
                </View>
                <Text style={styles.nextHow}>{milestone.how}</Text>
              </View>
            )}
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              style={({ pressed }) => [styles.sheetButton, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.sheetButtonText}>Done</Text>
            </Pressable>
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { paddingTop: space.lg },
  newTag: { position: 'absolute', top: -2, right: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: '#FFE38A', shadowColor: '#FFE38A', shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  intro: { ...type.caption, color: color.moonDim, marginTop: -space.sm, marginBottom: space.sm, marginHorizontal: space.lg + space.xs },
  newInline: { position: 'relative', top: 0, right: 0 },
  newText: { ...type.caption, fontSize: 9, fontWeight: '800', color: color.night, letterSpacing: 0.6 },
  sheetScrim: { flex: 1, backgroundColor: 'rgba(6,5,16,0.75)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  sheet: { width: '100%', maxWidth: 380, alignItems: 'center', padding: space.xl, borderRadius: radius.lg + 4, backgroundColor: '#151230', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(169,124,255,0.45)' },
  sheetKicker: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: space.md },
  sheetTitle: { ...type.title, color: color.moon, marginTop: 2, textAlign: 'center' },
  sheetAbout: { ...type.body, color: color.moonDim, textAlign: 'center', marginTop: space.sm },
  sheetProgress: { alignSelf: 'stretch', marginTop: space.md, gap: 4 },
  sheetButton: { marginTop: space.lg, alignSelf: 'stretch', minHeight: 46, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  sheetButtonText: { ...type.headline, color: color.moon },
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
  head: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: space.md, marginHorizontal: space.lg + space.xs },
  row: { paddingHorizontal: space.lg, gap: space.md },
  item: { width: 76, alignItems: 'center' },
  itemTitle: { ...type.caption, color: color.moon, textAlign: 'center', marginTop: 6, fontWeight: '600' },
  itemDetail: { ...type.caption, fontSize: 11, color: color.moonFaint, textAlign: 'center' },
});
