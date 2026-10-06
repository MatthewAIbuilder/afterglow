import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { artistColors } from '../../components/ArtistAvatar';
import { haptic } from '../../lib/haptics';
import { color, space, type } from '../../theme/tokens';
import type { Festival } from '../../data/models';
import { pinLook } from '../badges/badges';
import { EnamelPin } from '../badges/EnamelPin';
import { festivalMark, type Highlight } from './profileView';
import { ShelfHead } from './ShelfHead';
import { t } from '../../i18n';

const RING = 64;

/**
 * Round shortcuts under the profile, like story highlights: your festivals
 * (glowing ring, with the countdown under), your year, your recaps. Scrolls
 * sideways; nothing when there are none.
 */
export function Highlights({
  items,
  onOpen,
  festivalOf,
  hidden,
  onToggle,
}: {
  items: Highlight[];
  onOpen: (h: Highlight) => void;
  /** Festivals show as their pin. */
  festivalOf: (id: string) => Festival | undefined;
  hidden: boolean;
  onToggle: () => void;
}) {
  if (!items.length) return null;
  return (
    <View style={styles.wrap}>
      <ShelfHead title={t('Your festivals')} hidden={hidden} onToggle={onToggle} />
      {hidden ? null : (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {items.map((h) => {
        const key = h.kind === 'year' ? `year-${h.year}` : `${h.kind}-${h.id}`;
        const [deep, bright] = artistColors(key);
        const festival = h.kind === 'year' ? undefined : festivalOf(h.id);
        const mark = h.kind === 'year' ? String(h.year).slice(2) : festivalMark(h.title);
        const label = h.kind === 'festival' ? `${h.title}, ${h.detail}` : h.kind === 'year' ? t('{title} on Afterglow', { title: h.title }) : t('Your recap of {festival}', { festival: h.title });
        return (
          <Pressable
            key={key}
            onPress={() => {
              haptic.select();
              onOpen(h);
            }}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] }]}
          >
            {festival ? (
              <View style={styles.pin}>
                <EnamelPin look={pinLook(festival)} size={RING + 10} />
              </View>
            ) : (
              <View style={[styles.ring, styles.ringQuiet]}>
                <LinearGradient colors={[bright, deep]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.disc}>
                  <Text style={styles.mark} numberOfLines={1}>
                    {mark}
                  </Text>
                </LinearGradient>
              </View>
            )}
            <Text style={styles.title} numberOfLines={1}>
              {h.title}
            </Text>
            <Text style={[styles.detail, h.kind === 'festival' && styles.detailGlow]} numberOfLines={1}>
              {h.detail}
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
  wrap: { marginTop: space.xl },
  pin: { width: RING + 10, height: RING + 10, alignItems: 'center', justifyContent: 'center' },
  row: { paddingHorizontal: space.xl, gap: space.lg },
  item: { width: RING + 12, alignItems: 'center' },
  ring: { width: RING + 6, height: RING + 6, borderRadius: (RING + 6) / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  ringQuiet: { borderColor: color.hairline },
  disc: { width: RING, height: RING, borderRadius: RING / 2, alignItems: 'center', justifyContent: 'center' },
  mark: { ...type.headline, color: color.moon, letterSpacing: -0.3 },
  title: { ...type.caption, color: color.moon, marginTop: space.xs, textAlign: 'center' },
  detail: { ...type.caption, fontSize: 11, color: color.moonFaint, textAlign: 'center' },
  detailGlow: { color: color.glow },
});
