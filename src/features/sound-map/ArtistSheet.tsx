import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SheetClose } from '../../components/SheetClose';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { SOUND_LABEL, type SoundTag, type TasteProfile } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { color, motion, radius, space, type, glowA } from '../../theme/tokens';
import { useCatalog } from '../../state/catalog';
import { useTaste } from '../../state/taste';
import { RateArtist } from '../taste/RateArtist';
import { artistMix } from '../taste/lean';
import { SOUND_COLOR } from './colors';
import { SoundSpectrum } from './SoundSpectrum';
import { t } from '../../i18n';
import { GlassFill } from '../../components/LiquidGlass';

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
  // A new artist shows at once; closing keeps the last one while the sheet slides away.
  if (artistId && artistId !== shownId) setShownId(artistId);
  const offset = useSharedValue(SHEET_H + 80);

  useEffect(() => {
    if (artistId) offset.set(withSpring(0, motion.snappy));
    else offset.set(withTiming(SHEET_H + 80, { duration: 220 }));
  }, [artistId, offset]);

  const { artists, clipsOf } = useCatalog();
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
      offset.set(Math.max(-12, offset.get() + e.changeY * (offset.get() < 0 ? 0.3 : 1)));
    })
    .onEnd((e) => {
      if (offset.get() > 90 || e.velocityY > 700) {
        runOnJS(haptic.soft)();
        runOnJS(onClose)();
      } else {
        offset.set(withSpring(0, motion.snappy));
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - offset.get() / SHEET_H) * 0.5,
  }));

  if (!artist) return null;
  const firstClip = clipsOf(artist.id)[0];
  const pct = Math.round((taste[artist.id] ?? 0) * 100);
  const tags = (Object.entries(artist.sound) as [SoundTag, number][]).sort((p, q) => q[1] - p[1]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={artistId ? 'box-none' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('Close artist details')} />
      </Animated.View>

      <GestureDetector gesture={drag}>
        <Animated.View
          style={[styles.sheet, { bottom: bottomInset + space.sm }, sheetStyle]}
        >
          <GlassFill radius={radius.sheet} tint={0.55} deep />
          <View style={styles.grabber} />
          {/* A way out that doesn't need a swipe (browsers can't drag a sheet down). */}
          <SheetClose onPress={onClose} />

          <View style={styles.header}>
            <ArtistAvatar artist={artist} size={56} />
            <View style={styles.headerText}>
              <Text style={styles.name} numberOfLines={1}>
                {artist.name}
              </Text>
              <Text style={styles.match}>
                {t('{pct}% match', { pct })}
                {tags.length ? (
                  <Text style={styles.soundLine}>
                    {'  ·  '}
                    {tags.slice(0, 2).map(([tag], i) => (
                      <Text key={tag} style={{ color: SOUND_COLOR[tag] }}>
                        {i ? ', ' : ''}
                        {SOUND_LABEL[tag]}
                      </Text>
                    ))}
                  </Text>
                ) : null}
              </Text>
            </View>
          </View>

          {tags.length > 0 && (
            <View style={styles.spectrum}>
              <SoundSpectrum shares={artistMix(artist)} label={t("{artist}'s sound", { artist: artist.name })} height={4} />
            </View>
          )}

          {closest.length > 0 && <Text style={styles.body}>{closest.length > 1 ? t('Sounds closest to {a} and {b}.', { a: closest[0], b: closest[1] }) : t('Sounds closest to {a}.', { a: closest[0] })}</Text>}

          <RateArtist artist={artist} compact />

          <View style={styles.ctas}>
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
              <Text style={styles.ctaText}>{t('View artist')}</Text>
            </Pressable>
            {firstClip ? (
              <Pressable
                onPress={() => {
                  haptic.select();
                  onClose();
                  router.navigate({ pathname: '/', params: { clip: firstClip.id } });
                }}
                accessibilityRole="button"
                accessibilityLabel={t('Watch {artist} in Discover', { artist: artist.name })}
                style={({ pressed }) => [styles.cta, styles.ctaQuiet, pressed && { opacity: 0.75 }]}
              >
                <Text style={styles.ctaText}>{t('Watch')}</Text>
              </Pressable>
            ) : null}
          </View>
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
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: space.md,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  headerText: { marginLeft: space.lg, flex: 1 },
  name: { ...type.title, color: color.moon },
  match: { ...type.headline, color: color.glow, fontVariant: ['tabular-nums'], marginTop: 2 },
  spectrum: { marginTop: space.lg },
  soundLine: { ...type.caption, fontWeight: '600' },
  body: { ...type.caption, color: color.moonDim, marginTop: space.md },
  ctas: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  ctaQuiet: { backgroundColor: color.glass, borderColor: color.hairline },
  cta: {
    flex: 1,
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glowA(0.22),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.5),
  },
  ctaText: { ...type.headline, color: color.moon },
});
