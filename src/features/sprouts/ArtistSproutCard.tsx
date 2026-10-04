import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Artist } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useSprouts } from '../../state/sprouts';
import { color, radius, space, type } from '../../theme/tokens';
import { artistLook } from './artistLook';
import { tierLabel, tierLine } from './artistSprouts';
import { Sprout } from './Sprout';

/**
 * An artist's collectible on their page: yours with its level and what's
 * next, or a grey figure and how to earn it (film their set). Opens your garden.
 */
export function ArtistSproutCard({ artist }: { artist: Pick<Artist, 'id' | 'name' | 'sound' | 'color'> }) {
  const { artists } = useSprouts();
  const mine = artists.find((a) => a.artistId === artist.id);
  const look = artistLook(artist);
  const label = mine
    ? `Your ${artist.name} collectible, ${look.name}: ${look.theme.toLowerCase()}. ${tierLabel(mine)}. ${tierLine(mine.videos)}. Opens your garden.`
    : `${artist.name}'s collectible, ${look.name}: ${look.theme.toLowerCase()}. Film their set to earn it. Opens your garden.`;
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push('/garden');
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.card, mine && { borderColor: `${look.accent}66` }, pressed && styles.pressed]}
    >
      <Sprout artist={look} tier={mine?.tier ?? 0} stage={3} size={68} locked={!mine} still={!mine} />
      <View style={styles.text}>
        <Text style={[styles.kicker, { color: mine ? look.accent : color.moonFaint }]}>{mine ? 'YOUR COLLECTIBLE' : 'THEIR COLLECTIBLE'}</Text>
        <Text style={styles.title}>{look.name}</Text>
        <Text style={styles.sub}>{look.theme}</Text>
        <Text style={styles.sub}>{mine ? `${tierLabel(mine)} · ${tierLine(mine.videos)}` : 'Film their set to earn it for your garden.'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  text: { flex: 1, minWidth: 0, gap: 2 },
  kicker: { ...type.caption, fontSize: 11, letterSpacing: 1.2, fontWeight: '700' },
  title: { ...type.headline, color: color.moon },
  sub: { ...type.caption, color: color.moonDim },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
