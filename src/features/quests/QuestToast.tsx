import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfettiBurst } from '../../components/ConfettiBurst';
import { haptic } from '../../lib/haptics';
import { onQuestsFinished } from '../../state/dailyQuests';
import { color, motion, radius, space, type } from '../../theme/tokens';
import type { Finished } from './daily';
import { QUEST_GOLD, SparkIcon } from './QuestRing';
import { useDailyQuests } from './useDailyQuests';

type Toast = { key: number; title: string; line: string; glow: number; big?: boolean };

const SHOW_MS = 2800;
const SPARKS = 10;

/** Turns what was just finished into one or two toasts. */
export function toastsFor(finished: readonly Finished[], doneToday: number, of: number): Omit<Toast, 'key'>[] {
  const out: Omit<Toast, 'key'>[] = [];
  const daily = finished.filter((f): f is Extract<Finished, { kind: 'daily' }> => f.kind === 'daily');
  const all = finished.find((f): f is Extract<Finished, { kind: 'all' }> => f.kind === 'all');
  const weekly = finished.find((f): f is Extract<Finished, { kind: 'weekly' }> => f.kind === 'weekly');
  if (all) {
    out.push({ title: 'All three done today', line: 'Your streak glows on. See you tomorrow.', glow: daily.reduce((n, d) => n + d.spec.glow, 0) + all.glow, big: true });
  } else
    for (const d of daily) out.push({ title: d.spec.title, line: `${d.spec.how} · ${doneToday} of ${of} today`, glow: d.spec.glow });
  if (weekly) out.push({ title: `Weekly quest: ${weekly.spec.title}`, line: weekly.spec.how, glow: weekly.spec.glow, big: true });
  return out;
}

/**
 * A small gold toast from the top when you finish a quest, with sparks and a
 * haptic; a bigger one for all three, the weekly quest and a new glow level.
 * Tapping it opens your quests. Renders nothing the rest of the time.
 */
export function QuestToast() {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const quests = useDailyQuests();
  const [queue, setQueue] = useState<Toast[]>([]);
  const seq = useRef(0);
  const counts = useRef({ done: 0, of: 3 });
  useEffect(() => {
    counts.current = { done: quests.doneToday, of: quests.rows.length };
  }, [quests.doneToday, quests.rows.length]);

  useEffect(
    () =>
      onQuestsFinished((finished) => {
        const done = Math.min(counts.current.of, counts.current.done + finished.filter((f) => f.kind === 'daily').length);
        const add = toastsFor(finished, done, counts.current.of).map((t) => ({ ...t, key: ++seq.current }));
        if (add.length) setQueue((q) => [...q, ...add]);
      }),
    [],
  );

  // A new glow level gets its own toast (never on the first load, nor on signing in to another account).
  const lastLevel = useRef<{ owner: string; level: number } | undefined>(undefined);
  useEffect(() => {
    if (!quests.ready) return;
    const was = lastLevel.current?.owner === quests.owner ? lastLevel.current.level : undefined;
    lastLevel.current = { owner: quests.owner, level: quests.level.level };
    if (was !== undefined && quests.level.level > was) {
      const key = ++seq.current;
      setQueue((q) => [...q, { key, title: `Level ${quests.level.level} · ${quests.level.name}`, line: 'Your glow grew. Keep going.', glow: 0, big: true }]);
    }
  }, [quests.ready, quests.owner, quests.level.level, quests.level.name]);

  const current = queue[0];
  const y = useSharedValue(-140);
  const burst = useSharedValue(0);
  useEffect(() => {
    if (!current) return;
    if (current.big) haptic.celebrate();
    else haptic.tap();
    y.set(reduced ? 0 : withSpring(0, motion.snappy));
    burst.set(0);
    if (!reduced) burst.set(withDelay(120, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })));
    const t = setTimeout(() => {
      y.set(reduced ? -140 : withTiming(-140, { duration: 260 }));
      setTimeout(() => setQueue((q) => q.slice(1)), reduced ? 0 : 280);
    }, SHOW_MS);
    return () => clearTimeout(t);
  }, [current, y, burst, reduced]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }], opacity: reduced ? (y.get() < -100 ? 0 : 1) : 1 }));

  if (!current) return null;
  return (
    <Animated.View style={[styles.wrap, { top: insets.top + space.sm }, slide]} pointerEvents="box-none">
      <Pressable
        onPress={() => {
          haptic.select();
          setQueue([]);
          router.push('/quests');
        }}
        accessibilityRole="button"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${current.title}. ${current.line}.${current.glow ? ` Plus ${current.glow} glow.` : ''} Opens your quests.`}
        style={[styles.toast, current.big && styles.big]}
        testID="quest-toast"
      >
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.mark}>
          {Array.from({ length: SPARKS }, (_, i) => (
            <Spark key={`${current.key}-${i}`} i={i} burst={burst} />
          ))}
          <SparkIcon size={26} />
        </View>
        <View style={styles.text}>
          <Text style={styles.kicker}>{current.big ? 'Nice one' : 'Quest complete'}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {current.title}
          </Text>
          <Text style={styles.line} numberOfLines={1}>
            {current.line}
          </Text>
        </View>
        {current.glow ? <Text style={styles.glow}>+{current.glow}</Text> : null}
      </Pressable>
      {current.big ? <ConfettiBurst key={`c${current.key}`} spread={150} /> : null}
    </Animated.View>
  );
}

/** One spark flying out from the mark. */
function Spark({ i, burst }: { i: number; burst: { get: () => number } }) {
  const angle = (i / SPARKS) * Math.PI * 2;
  const reach = 22 + (i % 3) * 6;
  const style = useAnimatedStyle(() => {
    const b = burst.get();
    return {
      opacity: b > 0 ? 1 - b : 0,
      transform: [{ translateX: Math.cos(angle) * reach * b }, { translateY: Math.sin(angle) * reach * b }, { scale: 1 - b * 0.6 }],
    };
  });
  return <Animated.View style={[styles.spark, style]} />;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center', zIndex: 50 },
  toast: {
    width: '100%',
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(30,22,10,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,211,110,0.45)',
    shadowColor: QUEST_GOLD,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  big: { borderColor: QUEST_GOLD, backgroundColor: 'rgba(45,30,8,0.62)' },
  mark: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: QUEST_GOLD },
  text: { flex: 1, minWidth: 0 },
  kicker: { ...type.caption, fontSize: 10, letterSpacing: 1, color: QUEST_GOLD, textTransform: 'uppercase' },
  title: { ...type.headline, color: color.moon },
  line: { ...type.caption, color: color.moonDim },
  glow: { ...type.headline, color: QUEST_GOLD },
});
