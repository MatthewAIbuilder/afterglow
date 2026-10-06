import { Image } from 'expo-image';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { color } from '../../theme/tokens';
import type { Org } from './organizers';

/** An engraved, wide capital face like Underground Alchemy's own wordmark (Copperplate where the phone has it). */
const ENGRAVED = Platform.select({ ios: 'Copperplate', android: 'serif', default: 'Copperplate, "Copperplate Gothic Light", "Cinzel", Georgia, serif' });

/**
 * Underground Alchemy's mark: an "A" drawn as three rings joined in a
 * triangle. `size` is its height.
 */
export function AlchemyMark({ size, tint = color.moon, stroke = 0.09 }: { size: number; tint?: string; stroke?: number }) {
  // On a 100-high grid: rings at the top and the two bottom corners, lines meeting their edges.
  const r = 13;
  const w = stroke * 100;
  const top = { x: 50, y: 17 };
  const left = { x: 17, y: 82 };
  const right = { x: 83, y: 82 };
  const edge = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    return `M${(a.x + ux * r).toFixed(1)} ${(a.y + uy * r).toFixed(1)} L${(b.x - ux * r).toFixed(1)} ${(b.y - uy * r).toFixed(1)}`;
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={`${edge(top, left)} ${edge(top, right)} ${edge(left, right)}`} stroke={tint} strokeWidth={w} strokeLinecap="round" fill="none" />
      {[top, left, right].map((c, i) => (
        <Circle key={i} cx={c.x} cy={c.y} r={r - w / 2} stroke={tint} strokeWidth={w} fill="none" />
      ))}
    </Svg>
  );
}

/**
 * An organizer's logo: its drawn wordmark (UNDERGROUND over the mark and
 * LCHEMY, as on their own), a logo picture, or its initials. `width` sets
 * the size.
 */
export function OrgLogo({ org, width, tint }: { org: Pick<Org, 'name' | 'mark' | 'logoUrl' | 'color'>; width: number; tint?: string }) {
  const ink = tint ?? org.color ?? color.moon;
  if (org.mark === 'alchemy') {
    // Sized so UNDERGROUND fits the width in any engraved face (Copperplate, or a serif where there's none).
    const big = width / 9.6;
    return (
      <View style={{ width, alignItems: 'center' }} accessibilityRole="image" accessibilityLabel={org.name}>
        <Text style={[styles.word, { fontSize: big, lineHeight: big * 1.1, color: ink, letterSpacing: big * 0.04 }]} numberOfLines={1}>
          UNDERGROUND
        </Text>
        <View style={styles.row}>
          <AlchemyMark size={big * 1.18} tint={ink} />
          <Text style={[styles.word, { fontSize: big, lineHeight: big * 1.1, color: ink, letterSpacing: big * 0.04, marginLeft: big * 0.04 }]} numberOfLines={1}>
            LCHEMY
          </Text>
        </View>
      </View>
    );
  }
  if (org.logoUrl) return <Image source={{ uri: org.logoUrl }} style={{ width, height: width * 0.5 }} contentFit="contain" accessibilityLabel={org.name} />;
  const initials = org.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
  return (
    <Text style={[styles.word, { fontSize: width / 4, color: ink, letterSpacing: 2 }]} accessibilityLabel={org.name}>
      {initials}
    </Text>
  );
}

/** A small round badge of an organizer: its mark, or its initials. */
export function OrgDot({ org, size }: { org: Pick<Org, 'name' | 'mark' | 'logoUrl' | 'color'>; size: number }) {
  return (
    <View style={[styles.dot, { width: size, height: size, borderRadius: size / 2 }]}>
      {org.mark === 'alchemy' ? (
        <AlchemyMark size={size * 0.56} tint={org.color ?? color.moon} stroke={0.11} />
      ) : org.logoUrl ? (
        <Image source={{ uri: org.logoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
      ) : (
        <Text style={[styles.word, { fontSize: size * 0.36, color: org.color ?? color.moon }]}>{org.name.slice(0, 1).toUpperCase()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  word: { fontFamily: ENGRAVED, fontWeight: Platform.OS === 'ios' ? '400' : '500', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  dot: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0E0E12', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.22)' },
});
