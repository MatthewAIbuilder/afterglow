import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronIcon } from '../../components/TabIcons';
import { haptic } from '../../lib/haptics';
import { useQuests } from '../../state/quests';
import { t } from '../../i18n';
import { color, radius, space, type } from '../../theme/tokens';
import { Medal } from '../profile/Milestones';
import { openQuests, QUESTS } from './quests';

/**
 * Tonight's side quests: the next few you haven't done, with how far along
 * you are, so a festival night has a little game in it. Opens your badges.
 */
export function SideQuestsCard({ max = 3 }: { max?: number }) {
  const { log, progress, loaded } = useQuests();
  if (!loaded) return null;
  const open = openQuests(log, max);
  const done = QUESTS.length - QUESTS.filter((q) => !log[q.id]).length;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {t('Side quests')}
        </Text>
        <Text style={styles.count}>{t('{done} of {total} done', { done, total: QUESTS.length })}</Text>
      </View>
      {open.length ? (
        open.map((q) => {
          const p = progress[q.id];
          const current = Math.min(q.target, p?.current ?? 0);
          return (
            <View key={q.id} style={styles.row} accessible accessibilityLabel={q.target > 1 ? t('{title}. {how}, {current} of {target}', { title: q.title, how: q.how, current, target: q.target }) : `${q.title}. ${q.how}`}>
              <Medal milestone={{ id: q.id, title: q.title, how: q.how, about: q.about, current, target: q.target, earned: false, quest: true }} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{q.title}</Text>
                <Text style={styles.how}>
                  {q.how}
                  {q.target > 1 ? ` · ${current}/${q.target}` : ''}
                </Text>
              </View>
            </View>
          );
        })
      ) : (
        <Text style={styles.how}>{t('You’ve done every side quest. Legend.')}</Text>
      )}
      <Pressable
        onPress={() => {
          haptic.select();
          router.navigate({ pathname: '/profile', params: { tab: 'badges' } });
        }}
        accessibilityRole="button"
        accessibilityLabel={t('See all side quests and badges')}
        style={({ pressed }) => [styles.more, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.moreText}>{t('All side quests and badges')}</Text>
        <ChevronIcon color={color.glow} size={11} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.md, borderRadius: radius.lg, backgroundColor: 'rgba(255,227,138,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,227,138,0.4)' },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { ...type.headline, color: color.moon },
  count: { ...type.caption, color: '#FFE38A' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { ...type.label, color: color.moon },
  how: { ...type.caption, color: color.moonDim, marginTop: 1 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  moreText: { ...type.caption, color: color.glow },
});
