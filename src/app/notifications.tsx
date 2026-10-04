import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../components/GlassCircleButton';
import { NightSky } from '../components/NightSky';
import { ChevronIcon } from '../components/TabIcons';
import { haptic } from '../lib/haptics';
import { useNotices } from '../state/notices';
import { useSocial } from '../state/social';
import { color, radius, space, type } from '../theme/tokens';
import { goBack } from '../lib/nav';

/** Notifications: news about the festivals you're going to, new followers and likes on your videos. Opening it marks everything read. */
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { list, read, markRead, hydrated, refresh } = useNotices();
  const social = useSocial();
  // Fresh activity each time you look.
  useEffect(() => refresh(), [refresh]);
  // What was new when you opened this keeps its glow for this visit.
  const [fresh, setFresh] = useState<ReadonlySet<string> | undefined>();
  if (hydrated && !fresh) setFresh(new Set(list.filter((n) => !read.has(n.id)).map((n) => n.id)));
  useEffect(() => {
    if (fresh) markRead(list.map((n) => n.id));
  }, [fresh, list, markRead]);

  return (
    <View style={styles.root}>
      <NightSky />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pad}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.meta}>{social.user ? 'Your festivals, lineup news, new sets, new followers and likes on your videos.' : 'Your festivals, artists you’d love added to lineups, and their new sets.'}</Text>
        </View>
        <View style={[styles.pad, styles.list]}>
          {list.length === 0 ? (
            <Text style={styles.empty}>
              Nothing new. Tap “I’m going” on a festival and you’ll hear here when its set times come out and when
              it’s nearly time, and whenever an artist you’d love is added to a lineup.
            </Text>
          ) : null}
          {list.map((n) => {
            const isNew = !!fresh?.has(n.id);
            return (
              <Pressable
                key={n.id}
                onPress={() => {
                  haptic.select();
                  // Discover is a tab: go back to it rather than stacking a second set of tabs.
                  if (n.href.startsWith('/?')) router.dismissTo(n.href as never);
                  else router.push(n.href as never);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${isNew ? 'New. ' : ''}${n.title}. ${n.body}`}
                style={({ pressed }) => [styles.row, isNew && styles.rowNew, pressed && styles.pressed]}
              >
                {isNew ? <View style={styles.dot} /> : null}
                <View style={styles.text}>
                  <Text style={styles.rowTitle}>{n.title}</Text>
                  <Text style={styles.body}>{n.body}</Text>
                </View>
                <ChevronIcon color={color.moonFaint} size={12} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label="Back" onPress={() => goBack()}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  pad: { paddingHorizontal: space.xl },
  back: { position: 'absolute', left: space.lg },
  title: { ...type.largeTitle, color: color.moon },
  meta: { ...type.body, color: color.moonDim, marginTop: space.xs },
  list: { marginTop: space.xl, gap: space.sm },
  empty: { ...type.body, color: color.moonDim },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  rowNew: { backgroundColor: 'rgba(169,124,255,0.14)', borderColor: 'rgba(169,124,255,0.4)' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.glow },
  text: { flex: 1 },
  rowTitle: { ...type.headline, color: color.moon },
  body: { ...type.caption, color: color.moonDim, marginTop: 2 },
});
