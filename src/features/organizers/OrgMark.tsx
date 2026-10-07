import { Image } from 'expo-image';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { color } from '../../theme/tokens';
import { ORG_ASSETS } from './brandAssets';
import type { Org } from './organizers';

type Branded = Pick<Org, 'id' | 'name' | 'mark' | 'logoUrl' | 'color'> & Partial<Pick<Org, 'iconUrl'>>;

/** A heavy, engraved face for an organizer's name when it has no logo picture. */
const ENGRAVED = Platform.select({ ios: 'Copperplate', android: 'serif', default: 'Copperplate, "Copperplate Gothic Light", "Cinzel", Georgia, serif' });

/** A four-point sparkle centred at (x, y), `r` from the middle to a point. */
export const sparkle = (x: number, y: number, r: number) =>
  `M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z`;

/**
 * Underground Alchemy's mark, drawn (used only where its official picture
 * can't be): a flask with sparkles inside and beside it, like its logo.
 * `size` is its height.
 */
export function AlchemyMark({ size, tint = color.moon }: { size: number; tint?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* The flask: a lipped neck flaring to a round-cornered base, a thick white outline. */}
      <Path d="M36 10 L64 10 Q68 10 68 14 Q68 17 64 17 L60 17 L60 38 Q60 42 63 46 L86 78 Q92 88 84 92 L16 92 Q8 88 14 78 L37 46 Q40 42 40 38 L40 17 L36 17 Q32 17 32 14 Q32 10 36 10Z" fill="none" stroke={tint} strokeWidth={6} strokeLinejoin="round" />
      {/* The liquid at the bottom, and sparkles. */}
      <Path d="M24 74 L76 74 Q80 74 80 78 L80 82 Q80 85 77 85 L23 85 Q20 85 20 82 L20 78 Q20 74 24 74Z" fill={tint} />
      <Path d={`${sparkle(52, 56, 7)} ${sparkle(41, 66, 5)} ${sparkle(60, 66, 4)} ${sparkle(20, 34, 4)} ${sparkle(24, 52, 3)}`} fill={tint} />
    </Svg>
  );
}

/**
 * An organizer's logo: the one it uploaded, else its official one shipped
 * with the app, else its drawn mark and name, else its initials. `width`
 * sets the size.
 */
export function OrgLogo({ org, width, tint }: { org: Branded; width: number; tint?: string }) {
  const ink = tint ?? org.color ?? color.moon;
  const shipped = ORG_ASSETS[org.id];
  if (org.logoUrl || shipped) {
    const ratio = org.logoUrl ? 3 : shipped!.ratio;
    return <Image source={org.logoUrl ? { uri: org.logoUrl } : shipped!.logo} style={{ width, height: width / ratio }} contentFit="contain" accessibilityRole="image" accessibilityLabel={org.name} />;
  }
  if (org.mark === 'alchemy') {
    const big = width / 9.6;
    return (
      <View style={{ width, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: big * 0.3 }} accessibilityRole="image" accessibilityLabel={org.name}>
        <AlchemyMark size={big * 2.6} tint={ink} />
        <View>
          <Text style={[styles.word, { fontSize: big, lineHeight: big * 1.1, color: ink }]} numberOfLines={1}>
            UNDERGROUND
          </Text>
          <Text style={[styles.word, { fontSize: big, lineHeight: big * 1.1, color: ink }]} numberOfLines={1}>
            ALCHEMY
          </Text>
        </View>
      </View>
    );
  }
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

/** A small round badge of an organizer: its uploaded icon, its official one, its drawn mark, or its first letter. */
export function OrgDot({ org, size }: { org: Branded; size: number }) {
  const shipped = ORG_ASSETS[org.id];
  const icon = org.iconUrl ? { uri: org.iconUrl } : shipped?.icon;
  return (
    <View style={[styles.dot, { width: size, height: size, borderRadius: size / 2 }]}>
      {icon ? (
        <Image source={icon} style={{ width: size * (org.iconUrl ? 1 : 0.7), height: size * (org.iconUrl ? 1 : 0.7), borderRadius: org.iconUrl ? size / 2 : 0 }} contentFit={org.iconUrl ? 'cover' : 'contain'} accessibilityLabel={org.name} />
      ) : org.mark === 'alchemy' ? (
        <AlchemyMark size={size * 0.62} tint={org.color ?? color.moon} />
      ) : (
        <Text style={[styles.word, { fontSize: size * 0.36, color: org.color ?? color.moon }]}>{org.name.slice(0, 1).toUpperCase()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  word: { fontFamily: ENGRAVED, fontWeight: Platform.OS === 'ios' ? '400' : '500', textAlign: 'center' },
  dot: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#0B0A10', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.22)' },
});
