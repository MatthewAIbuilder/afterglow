import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronIcon } from '../../components/TabIcons';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type } from '../../theme/tokens';
import { FlameIcon, QUEST_GOLD, QuestRing } from './QuestRing';
import { useDailyQuests } from './useDailyQuests';

/** Your glow level, today's quests and your streak in one row. Opens your quests. */
export function GlowLevelCard() {
  const q = useDailyQuests();
  const of = q.rows.length || 3;
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push('/quests');
      }}
      accessibilityRole="button"
      accessibilityLabel={`Glow level ${q.level.level}, ${q.level.name}. ${q.doneToday} of ${of} quests done today.${q.streak ? ` ${q.streak}-day streak.` : ''} Opens your quests.`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      testID="glow-level-card"
    >
      <View style={styles.ring}>
        <QuestRing size={52} stroke={4} progress={q.level.progress} />
        <Text style={styles.num}>{q.level.level}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>Glow level</Text>
        <Text style={styles.name}>{q.level.name}</Text>
        <Text style={styles.sub}>
          {q.doneToday} of {of} quests today
        </Text>
      </View>
      {q.streak > 0 ? (
        <View style={styles.streak}>
          <FlameIcon size={18} />
          <Text style={styles.streakText}>{q.streak}</Text>
        </View>
      ) : null}
      <ChevronIcon color={color.moonFaint} size={12} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.lg,
    marginBottom: space.lg,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,211,110,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,211,110,0.4)',
  },
  ring: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  num: { position: 'absolute', ...type.headline, color: color.moon },
  kicker: { ...type.caption, fontSize: 10, color: QUEST_GOLD, letterSpacing: 1, textTransform: 'uppercase' },
  name: { ...type.headline, color: color.moon },
  sub: { ...type.caption, color: color.moonDim },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  streakText: { ...type.label, color: '#FF9F5A' },
});
