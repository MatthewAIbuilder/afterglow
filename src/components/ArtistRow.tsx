import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Artist } from '../data/types';
import { HeartIcon } from '../features/discover/icons';
import { RATING_SAID, type Rating } from '../features/taste/ratings';
import { haptic } from '../lib/haptics';
import { color, space, type } from '../theme/tokens';
import { ArtistAvatar } from './ArtistAvatar';
import { ChevronIcon } from './TabIcons';

/**
 * `festivalId` opens the artist in that festival's context, so must-see stars apply there.
 * `rating` shows how you rated them: a glowing heart for love, an outline for like, "Not really for you"
 * in the detail line, dimmed with "Not for you" for not for me (and said in full to screen readers).
 */
type Props = { artist: Artist; affinity: number; detail?: string; festivalId?: string; rating?: Rating; /** Runs before the artist opens (e.g. to remember a search). */ onOpen?: () => void };

/** A lineup row: avatar, name, optional detail line, match. Opens the artist. */
export function ArtistRow({ artist, affinity, detail, festivalId, rating, onOpen }: Props) {
  const pct = Math.round(affinity * 100);
  const passed = rating === 'pass';
  const cold = rating === 'pass' ? 'Not for you' : rating === 'meh' ? 'Not really for you' : undefined;
  const line = cold ? [detail, cold].filter(Boolean).join(' · ') : detail;
  const said = rating === 'love' || rating === 'like' || rating === 'ok' ? `, ${RATING_SAID[rating]}` : '';
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onOpen?.();
        router.push({ pathname: '/artist/[id]', params: { id: artist.id, festival: festivalId } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${artist.name}, ${pct} percent match${said}${line ? `, ${line}` : ''}`}
      style={({ pressed }) => [styles.row, passed && styles.passed, pressed && { opacity: 0.6 }]}
    >
      <ArtistAvatar artist={artist} size={48} />
      <View style={styles.text}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {artist.name}
          </Text>
          {rating === 'love' ? <HeartIcon color={color.glow} filled size={13} /> : rating === 'like' ? <HeartIcon color={color.moonDim} size={13} /> : null}
        </View>
        {line ? (
          <Text style={styles.detail} numberOfLines={1}>
            {line}
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
  passed: { opacity: 0.5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...type.headline, color: color.moon, flexShrink: 1 },
  detail: { ...type.caption, color: color.moonDim, marginTop: 2 },
  pct: { ...type.label, color: color.moonDim, fontVariant: ['tabular-nums'] },
});
