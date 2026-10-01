import { Pressable, StyleSheet, Text } from 'react-native';
import type { Artist } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useFollowedArtists } from '../../state/followedArtists';
import { color, radius, space, type } from '../../theme/tokens';

/**
 * Follow / Following for an artist: news when they're added to a lineup.
 * Kept on this phone; it never changes your match.
 */
export function FollowArtistButton({ artist, compact = false }: { artist: Artist; compact?: boolean }) {
  const { isFollowing, setFollowing } = useFollowedArtists();
  const on = isFollowing(artist.id);
  return (
    <Pressable
      onPress={() => {
        if (on) haptic.select();
        else haptic.tap();
        setFollowing(artist.id, !on);
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? `Following ${artist.name}. Tap to unfollow.` : `Follow ${artist.name}`}
      accessibilityHint={on ? undefined : 'Hear when they’re added to a lineup'}
      hitSlop={compact ? 6 : 0}
      style={({ pressed }) => [styles.pill, compact && styles.compact, on ? styles.on : styles.off, pressed && styles.pressed]}
    >
      <Text style={[styles.label, compact && styles.compactLabel, on && styles.onLabel]}>{on ? 'Following' : 'Follow'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { minWidth: 120, alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.sm + 2, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  compact: { minWidth: 92, paddingHorizontal: space.md, paddingVertical: 6 },
  off: { backgroundColor: color.glowDeep, borderColor: 'rgba(169,124,255,0.6)' },
  on: { backgroundColor: color.glass, borderColor: color.hairline },
  label: { ...type.headline, color: color.moon },
  compactLabel: { ...type.label },
  onLabel: { color: color.moonDim },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
