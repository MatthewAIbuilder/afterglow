import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { color } from '../../theme/tokens';
import { ToeGlyph } from '../toes/Toe';
import { useToes } from '../toes/useToes';

type Props = {
  photos: string[];
  /**
   * 'card' fades the faces into solid night (the card puts its glass over it,
   * so there's no edge); 'page' fades into night and then, over `tail` more
   * points, into the sky behind the page.
   */
  fade?: 'card' | 'page';
  /** For 'page': how far below the faces the night eases back into the sky. */
  tail?: number;
  style?: StyleProp<ViewStyle>;
};

const NIGHT = 'rgba(10,9,24,1)';

/**
 * Headliners' faces side by side, each in its own slice with a thin line of
 * night between, under a fade into the dark theme. Draws nothing without
 * photos.
 */
export function FestivalCover({ photos, fade = 'card', tail = 120, style }: Props) {
  const toes = useToes();
  if (!photos.length) return null;
  const page = fade === 'page';
  return (
    <View style={[styles.root, style]} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={[styles.faces, page && { bottom: tail }]}>
        <View style={styles.row}>
          {photos.map((uri, i) => (
            <View key={uri} style={[styles.slice, i > 0 && styles.line]}>
              <Image testID="cover-photo" source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
            </View>
          ))}
        </View>
        {/* Night over the faces, so they read as a mood rather than a contact sheet and text stays readable. */}
        <View style={styles.tint} />
        <LinearGradient
          colors={page ? ['rgba(10,9,24,0.3)', 'rgba(10,9,24,0.62)', NIGHT] : ['rgba(10,9,24,0.05)', 'rgba(10,9,24,0.55)', NIGHT]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {/* Below the faces the night eases back into the sky, so the cover has no edge. */}
      {page ? <LinearGradient colors={[NIGHT, 'rgba(10,9,24,0)']} style={[styles.tail, { height: tail }]} /> : null}
      {/* A toe tucked into the corner of the faces (one person's app only). */}
      {toes ? (
        <View style={[styles.toe, page && { bottom: tail + 10 }]}>
          <ToeGlyph size={11} opacity={0.22} />
        </View>
      ) : null}
    </View>
  );
}

const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
  toe: { position: 'absolute', right: 12, bottom: 10, transform: [{ rotate: '22deg' }] },
  faces: { ...fill, overflow: 'hidden', backgroundColor: color.night },
  row: { ...fill, flexDirection: 'row' },
  slice: { flex: 1, overflow: 'hidden' },
  line: { borderLeftWidth: 1.5, borderLeftColor: 'rgba(10,9,24,0.9)' },
  tint: { ...fill, backgroundColor: 'rgba(42,24,92,0.22)' },
  tail: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
