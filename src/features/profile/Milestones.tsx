import { useEffect, useId, useState } from 'react';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { haptic } from '../../lib/haptics';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
/** A milestone's two colours, for its unlock. */
export const medalColors = (id: MilestoneId): [string, string] => COLORS[id];

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
 * its progress, then every milestone in a row to swipe. Each opens a short
 * description; one you've earned but not claimed glows "New" and claims.
 */
export function MilestonesSection({ list, isNew, onClaim }: { list: Milestone[]; isNew?: (m: Milestone) => boolean; onClaim?: (m: Milestone) => void }) {
  const [open, setOpen] = useState<Milestone | undefined>();
  const next = nextMilestone(list);
  const earned = list.filter((m) => m.earned).length;
  const tap = (m: Milestone) => {
    haptic.select();
    if (isNew?.(m) && onClaim) onClaim(m);
    else setOpen(m);
  };
  return (
    <View style={styles.root}>
      <Text style={styles.head}>
        Milestones · {earned} of {list.length}
      </Text>
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
