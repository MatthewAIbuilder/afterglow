import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { artistColors } from '../../components/ArtistAvatar';
import { haptic } from '../../lib/haptics';
import { color, space, type } from '../../theme/tokens';
import { festivalMark, type Highlight } from './profileView';

const RING = 64;

/**
 * Round shortcuts under the profile, like story highlights: your festivals
 * (glowing ring, with the countdown under), your year, your recaps. Scrolls
 * sideways; nothing when there are none.
 */
export function Highlights({ items, onOpen }: { items: Highlight[]; onOpen: (h: Highlight) => void }) {
  if (!items.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroll}>
      {items.map((h) => {
        const key = h.kind === 'year' ? `year-${h.year}` : `${h.kind}-${h.id}`;
        const [deep, bright] = artistColors(key);
        const mark = h.kind === 'year' ? String(h.year).slice(2) : festivalMark(h.title);
        const label = h.kind === 'festival' ? `${h.title}, ${h.detail}` : h.kind === 'year' ? `${h.title} on Afterglow` : `Your recap of ${h.title}`;
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
            <View style={[styles.ring, h.kind === 'festival' ? styles.ringGlow : styles.ringQuiet]}>
              <LinearGradient colors={[bright, deep]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.disc}>
                <Text style={styles.mark} numberOfLines={1}>
                  {mark}
                </Text>
              </LinearGradient>
            </View>
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
  );
}

const styles = StyleSheet.create({
  scroll: { marginTop: space.xl },
  row: { paddingHorizontal: space.xl, gap: space.lg },
  item: { width: RING + 12, alignItems: 'center' },
  ring: { width: RING + 6, height: RING + 6, borderRadius: (RING + 6) / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  ringGlow: { borderColor: color.glow },
  ringQuiet: { borderColor: color.hairline },
  disc: { width: RING, height: RING, borderRadius: RING / 2, alignItems: 'center', justifyContent: 'center' },
  mark: { ...type.headline, color: color.moon, letterSpacing: -0.3 },
  title: { ...type.caption, color: color.moon, marginTop: space.xs, textAlign: 'center' },
  detail: { ...type.caption, fontSize: 11, color: color.moonFaint, textAlign: 'center' },
  detailGlow: { color: color.glow },
});
