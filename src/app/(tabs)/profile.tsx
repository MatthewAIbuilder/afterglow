import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { ChevronIcon, ProfileIcon } from '../../components/TabIcons';
import { yourClipCount, yourClips } from '../../features/discover/saved';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useGoing } from '../../state/going';
import { useRatings } from '../../state/ratings';
import { useReactions } from '../../state/reactions';
import { color, radius, space, type } from '../../theme/tokens';

/**
 * Profile: a placeholder for now. Shows what you've built so far (festivals,
 * ratings, clips) and what's coming: a profile to share, friends and followers.
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const catalog = useCatalog();
  const { going } = useGoing();
  const { ratings } = useRatings();
  const { reactions } = useReactions();
  const clips = yourClipCount(yourClips(catalog.clips, reactions));
  const rated = Object.keys(ratings).length;
  const festivals = going.filter((id) => catalog.festival(id)).length;

  const stats = [
    { n: festivals, label: festivals === 1 ? 'festival' : 'festivals' },
    { n: rated, label: rated === 1 ? 'artist rated' : 'artists rated' },
    { n: clips, label: clips === 1 ? 'clip kept' : 'clips kept' },
  ];

  return (
    <View style={styles.root}>
      <NightSky />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.xxl, paddingBottom: tabSpace + space.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.center}>
          <View style={styles.avatar}>
            <ProfileIcon color={color.moonDim} size={40} />
          </View>
          <Text style={styles.title}>You</Text>
          <Text style={styles.meta}>Your festivals and your sound, in one place.</Text>
        </View>

        <View style={styles.stats} accessibilityRole="summary">
          {stats.map((s) => (
            <View key={s.label} style={styles.stat} accessible accessibilityLabel={`${s.n} ${s.label}`}>
              <Text style={styles.statN}>{s.n}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.pad}>
          <Pressable
            onPress={() => {
              haptic.select();
              router.push('/saved');
            }}
            accessibilityRole="button"
            accessibilityLabel={`Your clips, ${clips}`}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.rowText}>Your clips</Text>
            <Text style={styles.rowCount}>{clips}</Text>
            <ChevronIcon color={color.moonFaint} size={12} />
          </Pressable>

          <View style={styles.soon}>
            <Text style={styles.soonKicker}>Coming soon</Text>
            <Text style={styles.soonTitle}>Your festival profile</Text>
            <Text style={styles.soonBody}>
              Share your plan and the sets you love, follow friends, and see who else is going.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  pad: { paddingHorizontal: space.xl },
  center: { alignItems: 'center', paddingHorizontal: space.xl },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.45)',
  },
  title: { ...type.largeTitle, color: color.moon, marginTop: space.lg },
  meta: { ...type.body, color: color.moonDim, marginTop: space.xs, textAlign: 'center' },
  stats: { flexDirection: 'row', marginHorizontal: space.xl, marginVertical: space.xxl, gap: space.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.glass,
  },
  statN: { ...type.title, color: color.moon, fontVariant: ['tabular-nums'] },
  statLabel: { ...type.caption, color: color.moonDim, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  rowText: { ...type.headline, color: color.moon, flex: 1 },
  rowCount: { ...type.caption, color: color.moonDim, fontVariant: ['tabular-nums'] },
  soon: {
    marginTop: space.xl,
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.35)',
    backgroundColor: 'rgba(169,124,255,0.08)',
  },
  soonKicker: { ...type.label, color: color.glow, textTransform: 'uppercase', letterSpacing: 0.8 },
  soonTitle: { ...type.headline, color: color.moon, marginTop: space.sm },
  soonBody: { ...type.body, color: color.moonDim, marginTop: space.xs },
});
