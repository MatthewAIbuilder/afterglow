import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { ChevronIcon } from '../components/TabIcons';
import { ALL_DONE_BONUS, dayLetter, LEVELS, MILESTONE_GLOW, SIDE_QUEST_GLOW } from '../features/quests/daily';
import { FlameIcon, LaneIcon, QUEST_AMBER, QUEST_GOLD, QuestRing, SparkIcon } from '../features/quests/QuestRing';
import { QUESTS } from '../features/quests/quests';
import { type QuestRow, useDailyQuests, useQuestRoute } from '../features/quests/useDailyQuests';
import { haptic } from '../lib/haptics';
import { useQuests } from '../state/quests';
import { color, motion, radius, space, type } from '../theme/tokens';

/** Taps on the level ring that wake the secret. */
const SECRET_TAPS = 7;

/**
 * Your quests: your glow level, your streak, today's three quests, this
 * week's big one, and a way to your side quests. Each quest takes you where
 * it's done.
 */
export default function QuestsScreen() {
  const insets = useSafeAreaInsets();
  const q = useDailyQuests();
  const route = useQuestRoute();
  const { log } = useQuests();
  const sideDone = QUESTS.filter((x) => log[x.id]).length;
  const next = LEVELS[q.level.level] ?? undefined;
  const toNext = q.level.to - q.level.glow;
  const go = (to: string | undefined) => {
    if (!to) return;
    haptic.select();
    if (to === '/' || to === '/sound' || to === '/festivals') router.navigate(to);
    else router.push(to as never);
  };

  return (
    <View style={styles.root}>
      <PageTitle title="Quests" />
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }} showsVerticalScrollIndicator={false}>
        <LevelHero level={q.level.level} name={q.level.name} progress={q.level.progress} glow={q.level.glow} />
        <Text style={styles.toNext}>
          {q.level.glow} glow · {toNext} to {next ? next.name : `level ${q.level.level + 1}`}
        </Text>

        <View style={styles.card} accessible accessibilityLabel={streakLabel(q.streak, q.doneToday, q.rows.length)}>
          <View style={styles.streakHead}>
            <FlameIcon size={28} lit={q.streak > 0} />
            <View style={{ flex: 1 }}>
              <Text style={styles.streakTitle}>{q.streak > 0 ? `${q.streak}-day streak` : 'Start a streak'}</Text>
              <Text style={styles.sub}>{q.streak > 0 ? 'Days in a row you finished all three.' : 'Finish all three quests today to light the first day.'}</Text>
            </View>
          </View>
          <View style={styles.weekRow} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {q.week.map((d) => (
              <View key={d.day} style={styles.dayCol}>
                <View style={[styles.dayDot, d.lit && styles.dayLit, d.today && !d.lit && styles.dayToday]}>{d.lit ? <FlameIcon size={14} fill={color.night} /> : null}</View>
                <Text style={[styles.dayLetter, d.today && { color: color.moon }]}>{dayLetter(d.day)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.head}>
          <Text style={styles.section} accessibilityRole="header">
            Today
          </Text>
          <Text style={styles.turns}>{q.turnsOver}</Text>
        </View>
        {q.rows.map((row) => (
          <QuestCard key={row.spec.id} row={row} onGo={() => go(route(row.spec.go))} />
        ))}
        {q.rows.length && q.doneToday === q.rows.length ? (
          <Text style={styles.allDone}>All three done. +{ALL_DONE_BONUS} glow, and your streak lives on.</Text>
        ) : (
          <Text style={styles.bonus}>Finish all three for +{ALL_DONE_BONUS} glow.</Text>
        )}

        {q.weekly ? (
          <>
            <Text style={[styles.section, styles.sectionGap]} accessibilityRole="header">
              This week
            </Text>
            <Pressable
              onPress={() => go(route(q.weekly!.spec.go))}
              disabled={!q.weekly.spec.go || q.weekly.done}
              accessibilityRole="button"
              accessibilityLabel={`Weekly quest: ${q.weekly.spec.title}. ${q.weekly.spec.how}. ${q.weekly.done ? 'Done.' : `${q.weekly.current} of ${q.weekly.spec.target}.`} ${q.weekly.spec.glow} glow.`}
              style={({ pressed }) => [styles.weekly, q.weekly!.done && styles.weeklyDone, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.weeklyTop}>
                <Text style={styles.weeklyKicker}>{q.weekly.done ? 'Done this week' : 'Weekly quest'}</Text>
                <Text style={styles.reward}>+{q.weekly.spec.glow}</Text>
              </View>
              <Text style={styles.weeklyTitle}>{q.weekly.spec.title}</Text>
              <Text style={styles.sub}>{q.weekly.spec.how}</Text>
              <Bar value={q.weekly.current / q.weekly.spec.target} />
              <Text style={styles.count}>
                {q.weekly.current} of {q.weekly.spec.target}
              </Text>
            </Pressable>
          </>
        ) : null}

        <Pressable
          onPress={() => {
            haptic.select();
            router.navigate({ pathname: '/profile', params: { tab: 'badges' } });
          }}
          accessibilityRole="button"
          accessibilityLabel={`Side quests at festivals, ${sideDone} of ${QUESTS.length} done. See your badges.`}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Side quests at festivals</Text>
            <Text style={styles.sub}>
              {sideDone} of {QUESTS.length} done · {SIDE_QUEST_GLOW} glow each
            </Text>
          </View>
          <ChevronIcon color={color.moonFaint} size={12} />
        </Pressable>

        <View style={styles.how}>
          <Text style={styles.howTitle}>How glow works</Text>
          <Text style={styles.howText}>
            Daily quests give 10 to 25 glow, finishing all three adds {ALL_DONE_BONUS}, the weekly quest 150, each side quest {SIDE_QUEST_GLOW} and each badge you claim {MILESTONE_GLOW}. Quests
            are counted on this phone, and a new set arrives at 4 AM.
          </Text>
        </View>
      </ScrollView>
      <PageActions />
    </View>
  );
}

const streakLabel = (streak: number, done: number, of: number) =>
  `${streak > 0 ? `${streak}-day streak.` : 'No streak yet.'} ${done} of ${of} quests done today.`;

/** The big ring with your level. Tapping it wobbles it; keep tapping and something happens. */
function LevelHero({ level, name, progress, glow }: { level: number; name: string; progress: number; glow: number }) {
  const reduced = useReducedMotion();
  const taps = useRef(0);
  const [secret, setSecret] = useState(false);
  const spin = useSharedValue(0);
  const pop = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }, { scale: pop.get() }] }));
  const tap = () => {
    taps.current += 1;
    if (reduced) return;
    if (taps.current >= SECRET_TAPS) {
      taps.current = 0;
      haptic.celebrate();
      setSecret(true);
      spin.set(withSequence(withTiming(spin.get() + 720, { duration: 1400 })));
      pop.set(withSequence(withSpring(1.18, motion.bloom), withSpring(1, motion.gentle)));
      return;
    }
    haptic.soft();
    pop.set(withSequence(withTiming(0.94, { duration: 80 }), withSpring(1, motion.bloom)));
  };
  return (
    <View style={styles.hero}>
      <Pressable onPress={tap} accessibilityRole="image" accessibilityLabel={`Glow level ${level}, ${name}. ${Math.round(progress * 100)} percent of the way to the next level.`}>
        <Animated.View style={[styles.ring, style]}>
          <QuestRing size={148} stroke={7} progress={progress} />
          <View style={styles.ringInside} pointerEvents="none">
            <SparkIcon size={20} />
            <Text style={styles.levelNum}>{level}</Text>
          </View>
        </Animated.View>
      </Pressable>
      <Text style={styles.levelKicker}>Glow level</Text>
      <Text style={styles.levelName}>{name}</Text>
      {secret ? <Text style={styles.secret}>You found the light inside the light. {glow} and counting.</Text> : null}
    </View>
  );
}

/** One of today's quests: what to do, how far along, its glow, and Go. */
function QuestCard({ row, onGo }: { row: QuestRow; onGo: () => void }) {
  const { spec, current, done } = row;
  return (
    <Pressable
      onPress={onGo}
      disabled={done || !spec.go}
      accessibilityRole="button"
      accessibilityLabel={`${spec.title}. ${spec.how}. ${done ? 'Done.' : spec.target > 1 ? `${current} of ${spec.target}.` : 'Not done yet.'} ${spec.glow} glow.`}
      testID={`quest-${spec.id}`}
      style={({ pressed }) => [styles.quest, done && styles.questDone, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      <View style={[styles.medal, done && styles.medalDone]}>{done ? <Text style={styles.check}>✓</Text> : <LaneIcon lane={spec.lane} size={18} />}</View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.questTitle, done && { color: QUEST_GOLD }]}>{spec.title}</Text>
        <Text style={styles.sub}>{spec.how}</Text>
        {spec.target > 1 && !done ? <Bar value={current / spec.target} slim /> : null}
      </View>
      <View style={styles.questEnd}>
        <Text style={[styles.reward, done && { opacity: 0.6 }]}>+{spec.glow}</Text>
        {!done && spec.target > 1 ? (
          <Text style={styles.count}>
            {current}/{spec.target}
          </Text>
        ) : !done && spec.go ? (
          <Text style={styles.goText}>Go</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function Bar({ value, slim }: { value: number; slim?: boolean }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={[styles.bar, slim && styles.barSlim]}>
      <View style={[styles.barFill, { width: `${v * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  hero: { alignItems: 'center' },
  ring: { width: 148, height: 148, alignItems: 'center', justifyContent: 'center' },
  ringInside: { position: 'absolute', alignItems: 'center' },
  levelNum: { fontSize: 44, lineHeight: 50, fontWeight: '800', color: color.moon, letterSpacing: -1 },
  levelKicker: { ...type.caption, color: QUEST_GOLD, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: space.md },
  levelName: { ...type.largeTitle, color: color.moon },
  secret: { ...type.caption, color: QUEST_GOLD, marginTop: space.xs, textAlign: 'center', paddingHorizontal: space.xl },
  toNext: { ...type.label, color: color.moonDim, textAlign: 'center', marginTop: space.xs, marginBottom: space.xl },
  card: {
    marginHorizontal: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,159,90,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,159,90,0.4)',
    gap: space.md,
  },
  streakHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  streakTitle: { ...type.headline, color: color.moon },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 4 },
  dayDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: color.glass, alignItems: 'center', justifyContent: 'center' },
  dayLit: { backgroundColor: QUEST_AMBER, shadowColor: QUEST_AMBER, shadowOpacity: 0.7, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  dayToday: { borderWidth: 1.5, borderColor: QUEST_AMBER },
  dayLetter: { ...type.caption, color: color.moonFaint },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: space.lg, marginTop: space.xl, marginBottom: space.sm },
  section: { ...type.title, color: color.moon },
  sectionGap: { paddingHorizontal: space.lg, marginTop: space.xl, marginBottom: space.sm },
  turns: { ...type.caption, color: color.moonDim },
  quest: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  questDone: { borderColor: 'rgba(255,211,110,0.5)', backgroundColor: 'rgba(255,211,110,0.06)' },
  medal: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,211,110,0.12)' },
  medalDone: { backgroundColor: QUEST_GOLD },
  check: { fontSize: 20, fontWeight: '800', color: color.night },
  questTitle: { ...type.headline, color: color.moon },
  questEnd: { alignItems: 'flex-end', gap: 2 },
  reward: { ...type.label, color: QUEST_GOLD },
  count: { ...type.caption, color: color.moonDim },
  goText: { ...type.caption, color: color.glow },
  sub: { ...type.caption, color: color.moonDim, marginTop: 2 },
  bar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(243,240,255,0.1)', overflow: 'hidden', marginTop: space.sm },
  barSlim: { height: 4 },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: QUEST_GOLD },
  bonus: { ...type.caption, color: color.moonFaint, paddingHorizontal: space.lg, marginTop: space.xs },
  allDone: { ...type.label, color: QUEST_GOLD, paddingHorizontal: space.lg, marginTop: space.xs },
  weekly: {
    marginHorizontal: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,211,110,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,211,110,0.45)',
  },
  weeklyDone: { borderColor: QUEST_GOLD, backgroundColor: 'rgba(255,211,110,0.12)' },
  weeklyTop: { flexDirection: 'row', justifyContent: 'space-between' },
  weeklyKicker: { ...type.caption, color: QUEST_GOLD, letterSpacing: 1, textTransform: 'uppercase' },
  weeklyTitle: { ...type.title, color: color.moon, marginTop: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: space.lg,
    marginTop: space.xl,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.glass,
  },
  rowTitle: { ...type.headline, color: color.moon },
  how: { marginHorizontal: space.lg, marginTop: space.xl },
  howTitle: { ...type.label, color: color.moonDim },
  howText: { ...type.caption, color: color.moonFaint, marginTop: space.xs, lineHeight: 17 },
});
