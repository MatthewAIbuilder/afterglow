import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { artistColors } from '../../components/ArtistAvatar';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type } from '../../theme/tokens';
import type { Memory } from './models';
import { clipLength } from './organize';

/** A memory as a tall still, 9:16, with its length and a light when it's on your profile. */
export function MemoryTile({
  memory,
  thumbUri,
  width,
  label,
  badge,
  onPress,
}: {
  memory: Memory;
  thumbUri?: string;
  width: number;
  /** What a screen reader hears. */
  label: string;
  /** A small pill over the still ("Tag"). */
  badge?: string;
  onPress: () => void;
}) {
  const [from, to] = artistColors(memory.artistId ?? memory.id);
  const length = clipLength(memory.durationSec);
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, { width, height: Math.round((width * 16) / 9) }, pressed && styles.pressed]}
    >
      <LinearGradient colors={[to, from]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      {thumbUri ? <Image source={{ uri: thumbUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(3,2,10,0.7)']} style={styles.scrim} pointerEvents="none" />
      {length ? <Text style={styles.length}>{length}</Text> : null}
      {memory.sharedId ? <View style={styles.shared} accessibilityElementsHidden /> : null}
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.nightRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%' },
  length: { ...type.caption, color: color.moon, position: 'absolute', left: space.sm, bottom: space.sm, fontVariant: ['tabular-nums'] },
  shared: {
    position: 'absolute',
    right: space.sm,
    top: space.sm,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.glow,
    shadowColor: color.glow,
    shadowOpacity: 0.9,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  badge: {
    position: 'absolute',
    right: space.sm,
    bottom: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(169,124,255,0.85)',
  },
  badgeText: { ...type.caption, color: color.night, fontWeight: '700' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
