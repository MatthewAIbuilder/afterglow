import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { SOUND_LABEL, type SoundTag, type TasteProfile } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { color, motion, radius, space, type } from '../../theme/tokens';
import { useCatalog } from '../../state/catalog';
import { useTaste } from '../../state/taste';

type Props = {
  artistId: string | null;
  taste: TasteProfile;
  /** Space the floating tab bar occupies, so the sheet clears it. */
  bottomInset: number;
  onClose: () => void;
};

const SHEET_H = 380;

export function ArtistSheet({ artistId, taste, bottomInset, onClose }: Props) {
  // Keep the last artist rendered while the sheet animates away.
  const [shownId, setShownId] = useState<string | null>(artistId);
  const offset = useSharedValue(SHEET_H + 80);

  useEffect(() => {
    if (artistId) {
      setShownId(artistId);
      offset.value = withSpring(0, motion.snappy);
    } else {
      offset.value = withTiming(SHEET_H + 80, { duration: 220 });
    }
  }, [artistId, offset]);

  const { artists } = useCatalog();
  const { similarity } = useTaste();
  const artist = artists.find((a) => a.id === shownId);

  const closest = useMemo(() => {
    if (!artist) return [];
    return artists
      .filter((a) => a.id !== artist.id)
      .map((a) => ({ a, s: similarity(artist, a) }))
      .filter((x) => x.s > 0.3)
      .sort((p, q) => q.s - p.s)
      .slice(0, 2)
      .map((x) => x.a.name);
  }, [artist, artists, similarity]);

  const drag = Gesture.Pan()
    .activeOffsetY(8)
    .onChange((e) => {
      offset.value = Math.max(-12, offset.value + e.changeY * (offset.value < 0 ? 0.3 : 1));
    })
    .onEnd((e) => {
      if (offset.value > 90 || e.velocityY > 700) {
        runOnJS(haptic.soft)();
        runOnJS(onClose)();
      } else {
        offset.value = withSpring(0, motion.snappy);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - offset.value / SHEET_H) * 0.5,
  }));

  if (!artist) return null;
  const pct = Math.round((taste[artist.id] ?? 0) * 100);
  const tags = (Object.entries(artist.sound) as [SoundTag, number][]).sort((p, q) => q[1] - p[1]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={artistId ? 'box-none' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close artist details" />
      </Animated.View>

      <GestureDetector gesture={drag}>
        <Animated.View
          style={[styles.sheet, { bottom: bottomInset + space.sm }, sheetStyle]}
        >
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.tint]} />
          <View style={styles.grabber} />

          <View style={styles.header}>
            <ArtistAvatar artist={artist} size={64} />
            <View style={styles.headerText}>
              <Text style={styles.name} numberOfLines={1}>
                {artist.name}
              </Text>
              <Text style={styles.match}>{pct}% match</Text>
            </View>
          </View>

          <View style={styles.tags}>
            {tags.map(([tag]) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{SOUND_LABEL[tag]}</Text>
              </View>
            ))}
          </View>

          {closest.length > 0 && (
            <Text style={styles.body}>Sounds closest to {closest.join(' and ')}.</Text>
          )}

          <Pressable
            onPress={() => {
              haptic.select();
              const id = artist.id;
              onClose();
              router.push(`/artist/${id}`);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.ctaText}>View artist</Text>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: '#000' },
  sheet: {
    position: 'absolute',
    left: space.sm,
    right: space.sm,
    minHeight: 220,
    borderRadius: radius.sheet,
    overflow: 'hidden',
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  tint: { backgroundColor: 'rgba(18,16,38,0.55)' },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: space.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  headerText: { marginLeft: space.lg, flex: 1 },
  name: { ...type.title, color: color.moon },
  match: { ...type.headline, color: color.glow, fontVariant: ['tabular-nums'], marginTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xl },
  tag: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  tagText: { ...type.caption, color: color.moon },
  body: { ...type.body, color: color.moonDim, marginTop: space.lg },
  cta: {
    marginTop: space.xl,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(169,124,255,0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.5)',
  },
  ctaText: { ...type.headline, color: color.moon },
});
