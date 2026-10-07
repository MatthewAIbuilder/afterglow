import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { t } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { color, space, type } from '../../theme/tokens';
import { artistLook } from './artistLook';
import type { Tier } from './artistSprouts';
import { CollectibleCard } from './CollectibleCard';

export type ShowcaseCard = { artistId: string; name: string; tier: Tier; shiny?: boolean };

/** The widest a showcase row gets (it sits in a profile's column). */
const ROW_MAX = 600;

/**
 * A showcase on a profile: up to three collectible cards someone pinned,
 * side by side, small and still. A tap opens the card's own page (where it
 * tilts, and anyone can see how to earn their own). Nothing when none are
 * pinned.
 */
export function ShowcaseRow({ cards, handle, own }: { cards: readonly ShowcaseCard[]; handle?: string; own?: boolean }) {
  const catalog = useCatalog();
  const { width: ww } = useWindowDimensions();
  if (!cards.length) return null;
  const inner = Math.min(ROW_MAX, ww) - 2 * space.xl;
  const w = Math.floor((inner - 2 * space.sm) / 3);
  return (
    <View style={styles.wrap}>
      <Text style={styles.head} accessibilityRole="header">
        {own ? t('Your showcase') : t('Showcase')}
      </Text>
      <View style={styles.row}>
        {cards.map((c) => {
          const look = artistLook(catalog.artist(c.artistId) ?? { id: c.artistId, name: c.name, sound: {} });
          return (
            <Pressable
              key={c.artistId}
              onPress={() => {
                haptic.select();
                router.push({ pathname: '/card/[id]', params: { id: c.artistId, ...(handle ? { h: handle } : {}), t: String(c.tier), ...(c.shiny ? { s: '1' } : {}) } });
              }}
              accessibilityRole="button"
              accessibilityLabel={t('{name}, from {artist}. Opens the card.', { name: look.name, artist: c.name })}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <CollectibleCard look={look} artistName={c.name} tier={c.tier} shiny={!!c.shiny} width={w} still />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.lg, paddingHorizontal: space.xl, gap: space.sm },
  head: { ...type.headline, color: color.moon },
  row: { flexDirection: 'row', gap: space.sm },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
