import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronIcon } from '../../components/TabIcons';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type } from '../../theme/tokens';
import { goersLine } from './going';
import type { Profile } from './models';
import { useGoers } from './useGoers';
import { t } from '../../i18n';

/** How many faces the row shows. */
const FACES = 4;

/**
 * "Maya and 2 others you follow are going, plus 12 others on Afterglow" on a
 * festival page, with their faces (people you follow first). Opens the full
 * list. Nothing when no one else shows the festival, or you're signed out.
 */
export function FriendsGoing({ festivalId }: { festivalId: string }) {
  const goers = useGoers(festivalId);
  const line = goers ? goersLine(goers) : undefined;
  if (!goers || !line) return null;
  const faces = [...goers.friends, ...goers.others].slice(0, FACES);
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push({ pathname: '/going/[id]', params: { id: festivalId } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${line}. ${t('See who.')}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.faces}>
        {faces.map((p, i) => (
          <Face key={p.uid} profile={p} first={i === 0} />
        ))}
      </View>
      <Text style={styles.line} numberOfLines={2}>
        {line}
      </Text>
      <ChevronIcon color={color.moonFaint} size={12} />
    </Pressable>
  );
}

function Face({ profile: p, first }: { profile: Profile; first: boolean }) {
  return (
    <View style={[styles.face, !first && styles.overlap]}>
      {p.avatarUrl ? <Image source={{ uri: p.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={styles.initial}>{p.displayName.slice(0, 1).toUpperCase()}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  pressed: { opacity: 0.75 },
  faces: { flexDirection: 'row' },
  face: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', backgroundColor: color.haze, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: color.night },
  overlap: { marginLeft: -8 },
  initial: { ...type.caption, color: color.moon, fontWeight: '700' },
  line: { ...type.label, color: color.moon, flex: 1 },
});
