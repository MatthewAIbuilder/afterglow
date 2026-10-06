import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { haptic } from '../../lib/haptics';
import { color, space, type, glowA } from '../../theme/tokens';
import { HeartIcon } from '../discover/icons';
import { mixColor, withAlpha } from '../sound-map/colors';
import type { Favourite } from './identity';
import { ShelfHead } from './ShelfHead';
import { t } from '../../i18n';

const FACE = 66;
const WHY: Record<Favourite['why'], string> = { love: t('you love them'), like: t('you like them'), follow: t('you follow them'), match: t('a strong match') };

/**
 * Your artists: the ones you love, like and follow, big faces in a row to
 * swipe, with where the next of them plays ("Next: SUBTRONICS · Sat 18 Oct · Denver").
 */
export function YourArtistsRow({ favourites, hidden, onToggle, next }: { favourites: Favourite[]; hidden: boolean; onToggle: () => void; next?: string }) {
  if (!favourites.length) return null;
  return (
    <View style={styles.root}>
      <ShelfHead title={t('Your artists')} hidden={hidden} onToggle={onToggle} link={t('Where they play')} onLink={() => router.push('/your-artists')} />
      {!hidden && next ? (
        <Pressable
          onPress={() => {
            haptic.select();
            router.push('/your-artists');
          }}
          accessibilityRole="button"
          accessibilityLabel={t('{next}. See where they play.', { next })}
          style={({ pressed }) => [styles.next, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.nextText} numberOfLines={1}>
            {next}
          </Text>
        </Pressable>
      ) : null}
      {hidden ? null : (
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
              accessibilityLabel={t('{artist}, {why}. {pct} percent match', { artist: f.artist.name, why: WHY[f.why], pct: Math.round(f.match * 100) })}
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: space.xl },
  next: { alignSelf: 'flex-start', marginTop: -space.xs, marginBottom: space.sm, paddingHorizontal: space.xl },
  nextText: { ...type.caption, color: color.moonDim },
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
    borderColor: glowA(0.6),
  },
  name: { ...type.caption, color: color.moon, marginTop: 6, textAlign: 'center' },
});
