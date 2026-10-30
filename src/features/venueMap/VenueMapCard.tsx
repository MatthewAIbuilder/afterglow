import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Festival } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { useVenueMap } from '../../state/venueMaps';
import { color, radius, space, type } from '../../theme/tokens';
import { t, tn } from '../../i18n';

/** On a festival's page, when it has a map: a peek at it, opening the full map with your dot and markers. */
export function VenueMapCard({ festival }: { festival: Festival }) {
  const map = useVenueMap(festival.id);
  if (!map) return null;
  const stages = map.pins.filter((p) => p.kind === 'stage').length;
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push({ pathname: '/venue-map/[id]', params: { id: festival.id } });
      }}
      accessibilityRole="button"
      accessibilityLabel={t('Festival map: where the stages, water and medical are, and where you are')}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <Image source={{ uri: map.image }} style={styles.peek} contentFit="cover" cachePolicy="disk" />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{t('Festival map')}</Text>
        <Text style={styles.sub}>{stages ? tn(stages, '{n} stage, and where everything is', '{n} stages, and where everything is') : t('Where everything is, and where you are')}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  peek: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: color.glass },
  title: { ...type.headline, color: color.moon },
  sub: { ...type.caption, color: color.moonDim, marginTop: 2 },
  chevron: { ...type.title, color: color.moonFaint },
});
