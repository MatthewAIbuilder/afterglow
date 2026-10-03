import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { ChevronIcon } from '../../components/TabIcons';
import { haptic } from '../../lib/haptics';
import { color, space, type } from '../../theme/tokens';
import { HeartIcon } from '../discover/icons';
import { mixColor, withAlpha } from '../sound-map/colors';
import type { Favourite } from './identity';

const FACE = 66;
const WHY: Record<Favourite['why'], string> = { love: 'you love them', like: 'you like them', follow: 'you follow them', match: 'a strong match' };

/** Your artists: the ones you love, like and follow, big faces in a row to swipe. */
export function YourArtistsRow({ favourites }: { favourites: Favourite[] }) {
  if (!favourites.length) return null;
  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          Your artists
        </Text>
        <Pressable
          onPress={() => {
            haptic.select();
            router.push('/your-artists');
          }}
          accessibilityRole="button"
          accessibilityLabel="See all your artists and where they play next"
          hitSlop={8}
          style={({ pressed }) => [styles.all, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.allText}>Where they play</Text>
          <ChevronIcon color={color.moonFaint} size={10} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {favourites.map((f) => {
          const ring = f.artist.color ?? mixColor(f.artist.sound);
          return (
            <Pressable
              key={f.artist.id}
              onPress={() => {
                haptic.select();
                router.push(`/artist/${f.artist.id}`);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${f.artist.name}, ${WHY[f.why]}. ${Math.round(f.match * 100)} percent match`}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] }]}
            >
              <View style={[styles.ring, { borderColor: withAlpha(ring, 0.85), shadowColor: ring }]}>
                <ArtistAvatar artist={f.artist} size={FACE} />
              </View>
              {f.why === 'love' || f.why === 'like' ? (
                <View style={styles.heart}>
                  <HeartIcon color={color.glow} size={10} filled={f.why === 'love'} />
                </View>
              ) : null}
              <Text style={styles.name} numberOfLines={1}>
                {f.artist.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: space.xl },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, marginBottom: space.sm },
  title: { ...type.headline, color: color.moon },
  all: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  allText: { ...type.caption, color: color.moonDim },
  row: { paddingHorizontal: space.xl, gap: space.md },
  item: { width: FACE + 10, alignItems: 'center' },
  ring: { borderRadius: (FACE + 6) / 2, borderWidth: 2, padding: 1, shadowOpacity: 0.55, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  heart: {
    position: 'absolute',
    top: FACE - 14,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.night,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.6)',
  },
  name: { ...type.caption, color: color.moon, marginTop: 6, textAlign: 'center' },
});
