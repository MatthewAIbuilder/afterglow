import { Linking, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { haptic } from '../../lib/haptics';
import { color, nightA, radius, space, type } from '../../theme/tokens';
import { t } from '../../i18n';
import type { Track } from './track';

/**
 * The song playing in a shared video ("track ID"): its title and artist, as a
 * small pill under who was playing. Opens the song on Apple Music when Shazam
 * gave a link.
 */
export function TrackLine({ track, style }: { track: Track; style?: StyleProp<ViewStyle> }) {
  const url = track.appleMusicUrl;
  const body = (
    <>
      <Text style={styles.note} accessibilityElementsHidden importantForAccessibility="no">
        ♪
      </Text>
      <Text style={styles.text} numberOfLines={1}>
        <Text style={styles.title}>{track.title}</Text>
        <Text style={styles.artist}>{`  ${track.artist}`}</Text>
      </Text>
    </>
  );
  if (!url) {
    return (
      <View style={[styles.pill, style]} accessible accessibilityLabel={t('Track: {title} by {artist}', { title: track.title, artist: track.artist })}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        void Linking.openURL(url).catch(() => {});
      }}
      accessibilityRole="link"
      accessibilityLabel={t('Track: {title} by {artist}. Opens in Apple Music.', { title: track.title, artist: track.artist })}
      hitSlop={6}
      style={({ pressed }) => [styles.pill, style, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: space.xs,
    marginTop: space.sm,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: nightA(0.55),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  note: { ...type.label, color: color.glow },
  text: { ...type.caption, flexShrink: 1 },
  title: { color: color.moon, fontWeight: '600' },
  artist: { color: color.moonDim },
});
