import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Artist } from '../data/types';
import { haptic } from '../lib/haptics';
import { color, space, type } from '../theme/tokens';
import { ArtistAvatar } from './ArtistAvatar';
import { ChevronIcon } from './TabIcons';

/** `festivalId` opens the artist in that festival's context, so must-see stars apply there. */
type Props = { artist: Artist; affinity: number; detail?: string; festivalId?: string };

/** A lineup row: avatar, name, optional detail line, match. Opens the artist. */
export function ArtistRow({ artist, affinity, detail, festivalId }: Props) {
  const pct = Math.round(affinity * 100);
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push({ pathname: '/artist/[id]', params: { id: artist.id, festival: festivalId } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${artist.name}, ${pct} percent match${detail ? `, ${detail}` : ''}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      <ArtistAvatar artist={artist} size={48} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {artist.name}
        </Text>
        {detail ? (
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.pct, pct >= 80 && { color: color.glow }]}>{pct}%</Text>
      <ChevronIcon color={color.moonFaint} size={14} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, gap: space.md },
  text: { flex: 1 },
  name: { ...type.headline, color: color.moon },
  detail: { ...type.caption, color: color.moonDim, marginTop: 2 },
  pct: { ...type.label, color: color.moonDim, fontVariant: ['tabular-nums'] },
});
