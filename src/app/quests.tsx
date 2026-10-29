import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { ChevronIcon } from '../components/TabIcons';
import { ALL_DONE_BONUS, dayLetter, glowShareText, LEVELS, MILESTONE_GLOW, SIDE_QUEST_GLOW } from '../features/quests/daily';
import { FlameIcon, LaneIcon, QUEST_AMBER, QUEST_GOLD, QuestRing, SparkIcon } from '../features/quests/QuestRing';
import { QUESTS } from '../features/quests/quests';
import { type QuestRow, useDailyQuests, useQuestRoute } from '../features/quests/useDailyQuests';
import { haptic } from '../lib/haptics';
import { shareMessage } from '../lib/share';
import { WEB_URL } from '../config/app';
import { useQuests } from '../state/quests';
import { revealSecret, useSecrets } from '../state/secrets';
import { setQuestReminder, useQuestReminder } from '../state/questReminder';
import { markQuestTipDone } from '../state/questTip';
import { secretsLine } from '../features/secrets/secrets';
import { t, tc } from '../i18n';
import { color, motion, radius, space, type, pageColumn } from '../theme/tokens';
import { PageFeedback } from '../components/PageFeedback';

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
  const secrets = useSecrets();
  const nudge = useQuestReminder();
  // Opening your quests is the last first-time tip done.
  useEffect(() => markQuestTipDone(), []);
  const next = LEVELS[q.level.level] ?? undefined;
  const toNext = q.level.to - q.level.glow;
  const go = (to: string | undefined) => {
    if (!to) return;
    haptic.select();
    // Stargazer is about the bubble map, so it opens there.
    if (to === '/sound') router.navigate({ pathname: '/sound', params: { view: 'map' } });
    else if (to === '/' || to === '/festivals') router.navigate(to);
    else router.push(to as never);
  };

  return (
    <View style={styles.root}>
      <PageTitle title={t('Quests')} />
      <NightSky />
      <ScrollView contentContainerStyle={[pageColumn, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]} showsVerticalScrollIndicator={false}>
        {/* Hidden (its room kept) until your level is known, so it never shows a stand-in. */}
        <View style={!q.ready && styles.waiting} accessibilityElementsHidden={!q.ready} importantForAccessibility={q.ready ? 'auto' : 'no-hide-descendants'}>
          <LevelHero level={q.level.level} name={q.level.name} progress={q.level.progress} />
          <Text style={styles.toNext}>
            {next ? t('{glow} glow · {left} to {name}', { glow: q.level.glow, left: toNext, name: next.name }) : t('{glow} glow · {left} to level {level}', { glow: q.level.glow, left: toNext, level: q.level.level + 1 })}
          </Text>
        </View>

        <View style={styles.card} accessible accessibilityLabel={streakLabel(q.streak, q.doneToday, q.rows.length)}>
          <View style={styles.streakHead}>
            <FlameIcon size={28} lit={q.streak > 0} />
            <View style={{ flex: 1 }}>
              <Text style={styles.streakTitle}>{q.streak === 1 ? tc('one', '{n}-day streak', { n: 1 }) : q.streak > 0 ? t('{n}-day streak', { n: q.streak }) : t('Start a streak')}</Text>
              <Text style={styles.sub}>{q.streak > 0 ? t('Days in a row you finished all three.') : t('Finish all three quests today to light the first day.')}</Text>
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
            {t('Today')}
          </Text>
          <Text style={styles.turns}>{q.turnsOver}</Text>
        </View>
        {q.rows.map((row) => (
          <QuestCard key={row.spec.id} row={row} onGo={() => go(route(row.spec.go))} />
        ))}
        {q.rows.length && q.doneToday === q.rows.length ? (
          <Text style={styles.allDone}>{t('All three done. +{n} glow, and your streak lives on.', { n: ALL_DONE_BONUS })}</Text>
        ) : (
          <Text style={styles.bonus}>{t('Finish all three for +{n} glow.', { n: ALL_DONE_BONUS })}</Text>
        )}

        {/* An evening nudge, if you'd like one (phones only). */}
        {Platform.OS !== 'web' ? (
          <View style={styles.nudge}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t('Remind me at 8 PM')}</Text>
              <Text style={styles.sub}>{t('Only on days you haven’t finished them.')}</Text>
            </View>
            <Switch
              value={nudge.on}
              onValueChange={(on) => {
                haptic.select();
                setQuestReminder(on);
              }}
              trackColor={{ true: QUEST_AMBER, false: 'rgba(243,240,255,0.18)' }}
              accessibilityLabel={t('Remind me about my quests at 8 PM')}
              testID="quest-reminder"
            />
          </View>
        ) : null}

        {q.weekly ? (
          <>
            <Text style={[styles.section, styles.sectionGap]} accessibilityRole="header">
              {t('This week')}
            </Text>
            <Pressable
              onPress={() => go(route(q.weekly!.spec.go))}
              disabled={!q.weekly.spec.go || q.weekly.done}
              accessibilityRole="button"
              accessibilityLabel={
                q.weekly.done
                  ? t('Weekly quest: {title}. {how}. Done. {glow} glow.', { title: q.weekly.spec.title, how: q.weekly.spec.how, glow: q.weekly.spec.glow })
                  : t('Weekly quest: {title}. {how}. {current} of {target}. {glow} glow.', {
                      title: q.weekly.spec.title,
                      how: q.weekly.spec.how,
                      current: q.weekly.current,
                      target: q.weekly.spec.target,
                      glow: q.weekly.spec.glow,
                    })
              }
              style={({ pressed }) => [styles.weekly, q.weekly!.done && styles.weeklyDone, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.weeklyTop}>
                <Text style={styles.weeklyKicker}>{q.weekly.done ? t('Done this week') : t('Weekly quest')}</Text>
                <Text style={styles.reward}>+{q.weekly.spec.glow}</Text>
              </View>
              <Text style={styles.weeklyTitle}>{q.weekly.spec.title}</Text>
              <Text style={styles.sub}>{q.weekly.spec.how}</Text>
              <Bar value={q.weekly.current / q.weekly.spec.target} />
              <Text style={styles.count}>{t('{current} of {target}', { current: q.weekly.current, target: q.weekly.spec.target })}</Text>
            </Pressable>
          </>
        ) : null}

        <Pressable
          onPress={() => {
            haptic.select();
            router.navigate({ pathname: '/profile', params: { tab: 'badges' } });
          }}
          accessibilityRole="button"
          accessibilityLabel={t('Side quests at festivals, {done} of {total} done. See your badges.', { done: sideDone, total: QUESTS.length })}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t('Side quests at festivals')}</Text>
            <Text style={styles.sub}>{t('{done} of {total} done · {glow} glow each', { done: sideDone, total: QUESTS.length, glow: SIDE_QUEST_GLOW })}</Text>
          </View>
          <ChevronIcon color={color.moonFaint} size={12} />
        </Pressable>

        <Pressable
          onPress={() => {
            haptic.select();
            router.push('/secrets');
          }}
          accessibilityRole="button"
          accessibilityLabel={t('Secrets, {line}', { line: secretsLine(Object.keys(secrets.found).length) })}
          style={({ pressed }) => [styles.row, styles.rowTight, pressed && { opacity: 0.7 }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t('Secrets')}</Text>
            <Text style={styles.sub}>{secretsLine(Object.keys(secrets.found).length)}</Text>
          </View>
          <ChevronIcon color={color.moonFaint} size={12} />
        </Pressable>

        <View style={styles.how}>
          <Text style={styles.howTitle}>{t('How glow works')}</Text>
          <Text style={styles.howText}>
            {t(
              'Daily quests give 10 to 25 glow, finishing all three adds {bonus}, the weekly quest 150, each side quest {side} and each badge you claim {badge} and each secret 50. Quests are counted on this phone, and a new set arrives at 4 AM.',
              { bonus: ALL_DONE_BONUS, side: SIDE_QUEST_GLOW, badge: MILESTONE_GLOW },
            )}
          </Text>
        </View>
        <PageFeedback />
      </ScrollView>
      <PageActions
        shareLabel={t('Share your glow level')}
        onShare={() => void shareMessage(glowShareText(q.level.level, q.level.name, q.streak, WEB_URL))}
      />
    </View>
  );
}

const streakLabel = (streak: number, done: number, of: number) =>
  streak > 0
    ? t('{streak}-day streak. {done} of {total} quests done today.', { streak, done, total: of })
    : t('No streak yet. {done} of {total} quests done today.', { done, total: of });

/** The big ring with your level. Tapping it wobbles it; keep tapping and something happens. */
function LevelHero({ level, name, progress }: { level: number; name: string; progress: number }) {
  const reduced = useReducedMotion();
  const taps = useRef(0);
  const spin = useSharedValue(0);
  const pop = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }, { scale: pop.get() }] }));
  const tap = () => {
    taps.current += 1;
    if (taps.current >= SECRET_TAPS) {
      taps.current = 0;
      revealSecret('ringspin');
      if (reduced) return;
      spin.set(withSequence(withTiming(spin.get() + 720, { duration: 1400 })));
      pop.set(withSequence(withSpring(1.18, motion.bloom), withSpring(1, motion.gentle)));
      return;
    }
    haptic.soft();
    if (reduced) return;
    pop.set(withSequence(withTiming(0.94, { duration: 80 }), withSpring(1, motion.bloom)));
  };
  return (
    <View style={styles.hero}>
      <Pressable onPress={tap} accessibilityRole="image" accessibilityLabel={t('Glow level {level}, {name}. {percent} percent of the way to the next level.', { level, name, percent: Math.round(progress * 100) })}>
        <Animated.View style={[styles.ring, style]}>
          <QuestRing size={148} stroke={7} progress={progress} />
          <View style={styles.ringInside} pointerEvents="none">
            <SparkIcon size={20} />
            <Text style={styles.levelNum}>{level}</Text>
          </View>
        </Animated.View>
      </Pressable>
      <Text style={styles.levelKicker}>{t('Glow level')}</Text>
      <Text style={styles.levelName}>{name}</Text>
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
      accessibilityLabel={
        done
          ? t('{title}. {how}. Done. {glow} glow.', { title: spec.title, how: spec.how, glow: spec.glow })
          : spec.target > 1
            ? t('{title}. {how}. {current} of {target}. {glow} glow.', { title: spec.title, how: spec.how, current, target: spec.target, glow: spec.glow })
            : t('{title}. {how}. Not done yet. {glow} glow.', { title: spec.title, how: spec.how, glow: spec.glow })
      }
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
          <Text style={styles.goText}>{t('Go')}</Text>
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
  waiting: { opacity: 0 },
  root: { flex: 1, backgroundColor: color.night },
  hero: { alignItems: 'center' },
  ring: { width: 148, height: 148, alignItems: 'center', justifyContent: 'center' },
  ringInside: { position: 'absolute', alignItems: 'center' },
  levelNum: { fontSize: 44, lineHeight: 50, fontWeight: '800', color: color.moon, letterSpacing: -1 },
  levelKicker: { ...type.caption, color: QUEST_GOLD, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: space.md },
  levelName: { ...type.largeTitle, color: color.moon },
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
    borderTopColor: color.rim,
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
  rowTight: { marginTop: space.sm },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginHorizontal: space.lg, marginTop: space.md, padding: space.lg, borderRadius: radius.md, backgroundColor: color.glass },
  rowTitle: { ...type.headline, color: color.moon },
  how: { marginHorizontal: space.lg, marginTop: space.xl },
  howTitle: { ...type.label, color: color.moonDim },
  howText: { ...type.caption, color: color.moonFaint, marginTop: space.xs, lineHeight: 17 },
});
