import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { haptic } from '../../lib/haptics';
import { color, motion } from '../../theme/tokens';
import { QUEST_GOLD, QuestRing, SparkIcon } from './QuestRing';
import { useDailyQuests } from './useDailyQuests';

const SIZE = 40;

/**
 * Today's quests at a glance: a glass button whose ring fills a third for
 * each quest done, gold all round when they're all done. It gives a little
 * hop whenever one is finished. Opens your quests.
 */
export function QuestButton() {
  const q = useDailyQuests();
  const reduced = useReducedMotion();
  const of = q.rows.length || 3;
  const all = q.ready && q.doneToday >= of;
  const hop = useSharedValue(1);
  const last = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!q.ready) return;
    const was = last.current;
    last.current = q.doneToday;
    if (was !== undefined && q.doneToday > was && !reduced) hop.set(withSequence(withTiming(1.22, { duration: 140 }), withSpring(1, motion.bloom)));
  }, [q.ready, q.doneToday, hop, reduced]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: hop.get() }] }));
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push('/quests');
      }}
      accessibilityRole="button"
      accessibilityLabel={q.ready ? `Today's quests, ${q.doneToday} of ${of} done${q.streak ? `, ${q.streak}-day streak` : ''}` : "Today's quests"}
      hitSlop={10}
      testID="quest-button"
      style={({ pressed }) => [pressed && { transform: [{ scale: 0.92 }] }]}
    >
      <Animated.View style={[styles.button, all && styles.lit, style]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.ring} pointerEvents="none">
          <QuestRing size={SIZE} stroke={2.5} parts={of} progress={q.ready ? q.doneToday / of : 0} done={all} track="rgba(243,240,255,0.16)" />
        </View>
        <View pointerEvents="none">
          <SparkIcon size={17} fill={all ? QUEST_GOLD : color.moon} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,16,38,0.4)',
  },
  lit: { shadowColor: QUEST_GOLD, shadowOpacity: 0.6, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  ring: { position: 'absolute', left: 0, top: 0 },
});
