import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type } from '../../theme/tokens';
import { type Badge, pinLook } from './badges';
import { EnamelPin } from './EnamelPin';

/**
 * A collection of festival pins, three across: earned ones in gold with the
 * festival and when, then (on your own profile) the festivals you're going
 * to as dim silver pins still to collect. Each opens the pin's own page.
 */
export function BadgesGrid({
  badges,
  toCollect = [],
  festivalOf,
  uid,
  width,
  mine,
}: {
  badges: Badge[];
  toCollect?: Festival[];
  festivalOf: (id: string) => Festival | undefined;
  uid?: string;
  width: number;
  mine?: boolean;
}) {
  const cols = 3;
  const cell = Math.floor((width - space.lg * 2 - space.md * (cols - 1)) / cols);
  const open = (festivalId: string) => {
    haptic.select();
    router.push({ pathname: '/badge/[id]', params: { id: festivalId, ...(uid ? { uid } : {}) } });
  };
  const earned = badges.map((b) => ({ b, f: festivalOf(b.festivalId) })).filter((x): x is { b: Badge; f: Festival } => !!x.f);
  return (
    <View style={styles.wrap}>
      {earned.length ? (
        <>
          <Text style={styles.head}>
            {earned.length} {earned.length === 1 ? 'badge' : 'badges'} collected
          </Text>
          <View style={styles.grid}>
            {earned.map(({ b, f }) => (
              <Pressable
                key={b.festivalId}
                onPress={() => open(b.festivalId)}
                accessibilityRole="button"
                accessibilityLabel={`${f.name} badge, collected. ${b.videos} ${b.videos === 1 ? 'video' : 'videos'} filmed there. Opens the badge`}
                style={({ pressed }) => [styles.cell, { width: cell }, pressed && styles.pressed]}
              >
                <EnamelPin look={pinLook(f)} size={cell} />
                <Text style={styles.name} numberOfLines={2}>
                  {f.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{mine ? 'Collect a badge for every festival' : 'No badges yet'}</Text>
          <Text style={styles.emptyBody}>
            {mine
              ? 'Film a video at a festival and share it, tagged with the festival: its badge joins your collection. Only videos filmed there, on its dates, count.'
              : 'Badges come from videos filmed at a festival, on its dates.'}
          </Text>
        </View>
      )}
      {mine && toCollect.length ? (
        <>
          <Text style={[styles.head, { marginTop: space.lg }]}>To collect</Text>
          <View style={styles.grid}>
            {toCollect.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => open(f.id)}
                accessibilityRole="button"
                accessibilityLabel={`${f.name} badge, not collected yet. Film a video there to collect it`}
                style={({ pressed }) => [styles.cell, { width: cell }, pressed && styles.pressed]}
              >
                <EnamelPin look={pinLook(f)} size={cell} locked />
                <Text style={[styles.name, styles.lockedName]} numberOfLines={2}>
                  {f.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, paddingTop: space.lg },
  head: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: space.md, paddingHorizontal: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cell: { alignItems: 'center', gap: space.xs },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  name: { ...type.caption, color: color.moon, textAlign: 'center', fontWeight: '600' },
  lockedName: { color: color.moonFaint },
  empty: { padding: space.xl, gap: space.sm, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  emptyTitle: { ...type.headline, color: color.moon },
  emptyBody: { ...type.body, color: color.moonDim },
});
