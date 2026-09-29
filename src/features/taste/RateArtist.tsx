import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Artist } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useRatings } from '../../state/ratings';
import { color, radius, space, type } from '../../theme/tokens';
import { HeartIcon } from '../discover/icons';

/**
 * Tell Afterglow about an artist directly, without a clip: "Love their sound"
 * or "Not for me". Tap again to take it back. Feeds the taste engine.
 */
export function RateArtist({ artist }: { artist: Artist }) {
  const { ratings, rate } = useRatings();
  const current = ratings[artist.id];
  const loved = current === 'love';
  const passed = current === 'pass';

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => {
          if (loved) haptic.select();
          else haptic.tap();
          rate(artist.id, loved ? undefined : 'love');
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: loved }}
        accessibilityLabel={loved ? `You love ${artist.name}'s sound. Tap to undo.` : `Love ${artist.name}'s sound`}
        style={({ pressed }) => [styles.pill, loved && styles.on, pressed && styles.pressed]}
      >
        <HeartIcon color={loved ? color.glow : color.moonDim} filled={loved} size={16} />
        <Text style={[styles.text, loved && styles.textOn]}>{loved ? 'You love their sound' : 'Love their sound'}</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          haptic.select();
          rate(artist.id, passed ? undefined : 'pass');
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: passed }}
        accessibilityLabel={passed ? `${artist.name} is not for you. Tap to undo.` : `${artist.name} is not for me`}
        style={({ pressed }) => [styles.pill, passed && styles.passOn, pressed && styles.pressed]}
      >
        <Text style={[styles.text, passed && styles.textOn]}>Not for me</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm, marginTop: space.lg },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  on: { backgroundColor: 'rgba(169,124,255,0.18)', borderColor: 'rgba(169,124,255,0.4)' },
  passOn: { backgroundColor: color.glass, borderColor: 'rgba(255,255,255,0.22)' },
  pressed: { opacity: 0.7 },
  text: { ...type.label, color: color.moonDim },
  textOn: { color: color.moon },
});
