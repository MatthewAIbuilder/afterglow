import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { artistColors } from '../../components/ArtistAvatar';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { PlayIcon } from '../discover/icons';
import type { MomentCaption } from '../memories/momentCaption';
import { t } from '../../i18n';

/** At most this many b2b partners get their own line; the rest read "+1". */
const B2B_LINES = 2;

/**
 * One moment in a profile grid (yours, a friend's, anyone's): the still with who
 * was playing over a soft fade at the bottom, a b2b partner on a line of their
 * own, where it was filmed, and its length in the corner.
 */
export function MomentTile({
  width,
  height,
  thumb,
  seed,
  caption,
  length,
  rounded,
  untagged,
  onlyYou,
  label,
  onPress,
}: {
  width: number;
  height: number;
  thumb?: string;
  /** The artist (or the video) whose colours show while the still loads, or when there's none. */
  seed: string;
  caption: MomentCaption;
  length?: string;
  /** Rounded corners, for a grid with gutters. */
  rounded?: boolean;
  /** Not tagged yet: a Tag pill instead of a caption. */
  untagged?: boolean;
  /** Kept on your phone, not on your profile. */
  onlyYou?: boolean;
  label: string;
  onPress: () => void;
}) {
  const [from, to] = artistColors(seed);
  const [main, ...others] = caption.artists;
  const extra = others.length - B2B_LINES;
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, { width, height }, rounded && styles.rounded, pressed && styles.pressed]}
    >
      <LinearGradient colors={[to, from]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      {thumb ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
      <LinearGradient colors={['rgba(3,2,10,0.45)', 'rgba(3,2,10,0)']} style={styles.topFade} pointerEvents="none" />
      <LinearGradient colors={['rgba(3,2,10,0)', 'rgba(3,2,10,0.55)', 'rgba(3,2,10,0.9)']} locations={[0, 0.45, 1]} style={styles.bottomFade} pointerEvents="none" />
      {length ? (
        <View style={styles.length} pointerEvents="none">
          <PlayIcon color={color.moon} size={7} />
          <Text style={styles.lengthText}>{length}</Text>
        </View>
      ) : null}
      {untagged ? (
        <View style={styles.tag}>
          <Text style={styles.tagText}>{t('Tag')}</Text>
        </View>
      ) : onlyYou ? (
        <View style={styles.onlyYou}>
          <Text style={styles.onlyYouText}>{t('Only you')}</Text>
        </View>
      ) : null}
      {main || caption.where ? (
        <View style={styles.caption} pointerEvents="none">
          {main ? (
            <Text style={styles.artist} numberOfLines={1}>
              {main}
            </Text>
          ) : null}
          {others.slice(0, B2B_LINES).map((name, i) => (
            <Text key={name} style={styles.artist} numberOfLines={1}>
              <Text style={styles.b2b}>b2b </Text>
              {name}
              {i === B2B_LINES - 1 && extra > 0 ? <Text style={styles.b2b}>{` +${extra}`}</Text> : null}
            </Text>
          ))}
          {caption.where ? (
            <Text style={styles.where} numberOfLines={1}>
              {caption.throwback ? '↺ ' : ''}
              {caption.where}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } };

const styles = StyleSheet.create({
  tile: { overflow: 'hidden', backgroundColor: color.nightRaised },
  rounded: { borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  topFade: { position: 'absolute', left: 0, right: 0, top: 0, height: '26%' },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },
  length: { position: 'absolute', right: space.sm, top: space.sm, flexDirection: 'row', alignItems: 'center', gap: 3 },
  lengthText: { ...type.caption, fontSize: 11, color: color.moon, fontVariant: ['tabular-nums'], ...shadow },
  tag: { position: 'absolute', left: space.sm, top: space.sm, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: glowA(0.85) },
  tagText: { ...type.caption, color: color.moon },
  onlyYou: { position: 'absolute', left: space.sm, top: space.sm - 1, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: 'rgba(3,2,10,0.5)' },
  onlyYouText: { ...type.caption, fontSize: 10, color: color.moonDim },
  caption: { position: 'absolute', left: space.sm, right: space.sm, bottom: space.sm, gap: 1 },
  artist: { ...type.caption, fontSize: 13, lineHeight: 16, fontWeight: '700', color: color.moon, letterSpacing: 0.2, ...shadow },
  b2b: { fontSize: 11, fontWeight: '600', color: glowA(1), letterSpacing: 0, textTransform: 'lowercase' },
  where: { ...type.caption, fontSize: 11, lineHeight: 14, color: color.moonDim, marginTop: 1, ...shadow },
});
