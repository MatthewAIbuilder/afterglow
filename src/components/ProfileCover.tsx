import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AnimatedBackdrop } from '../features/profile/AnimatedBackdrop';
import type { BackdropId } from '../features/profile/backdrops';
import { nightA } from '../theme/tokens';

/** How strongly an animated background shows over a cover photo when there are both: the photo glows through, dimmed. */
export const BLEND_OPACITY = 0.55;

/**
 * A profile's background, filling its box: the cover photo, the animated
 * background, or both blended (the photo underneath, dimmed by the
 * animation's night and lit by its glow). Nothing without either.
 */
export function CoverLayers({ url, backdrop, width, height, still }: { url?: string; backdrop?: BackdropId; width: number; height: number; still?: boolean }) {
  return (
    <>
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} testID={backdrop ? 'cover-blend' : undefined} /> : null}
      {backdrop ? (
        <View style={[StyleSheet.absoluteFill, url ? { opacity: BLEND_OPACITY } : null]}>
          <AnimatedBackdrop id={backdrop} width={width} height={height} still={still} />
        </View>
      ) : null}
    </>
  );
}

/**
 * The top of a profile, behind the header: the cover photo, the animated
 * background (see `useProfileBackdrop`), or both blended. Darkened at the
 * very top for the status bar and fading into the night below, so the name
 * and buttons stay readable. Nothing without either.
 */
export function ProfileCover({ url, height, backdrop }: { url?: string; height: number; backdrop?: BackdropId }) {
  const [width, setWidth] = useState(0);
  if (!url && !backdrop) return null;
  return (
    <View
      style={[styles.root, { height }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      testID={backdrop ? `backdrop-${backdrop}` : undefined}
    >
      <CoverLayers url={url} backdrop={backdrop} width={width} height={height} />
      {backdrop ? (
        // Clear over the orbit, then a long, gentle fade into the night below the name.
        <LinearGradient colors={[nightA(0.4), nightA(0), nightA(0.08), nightA(0.55), nightA(1)]} locations={[0, 0.16, 0.58, 0.82, 1]} style={StyleSheet.absoluteFill} />
      ) : (
        <LinearGradient colors={[nightA(0.55), nightA(0.05), nightA(0.3), nightA(0.7), nightA(1)]} locations={[0, 0.2, 0.58, 0.82, 1]} style={StyleSheet.absoluteFill} />
      )}
    </View>
  );
}

/**
 * Your profile background behind an orbit in the middle of a page (the
 * Friends tab): the cover photo, animated background or both, faded into the night
 * at the top and bottom so it reads as light behind the faces, not a box.
 * Nothing without either. Sized and placed by the caller.
 */
export function OrbitBackdrop({ url, backdrop, width, height, style }: { url?: string; backdrop?: BackdropId; width: number; height: number; style?: object }) {
  if ((!url && !backdrop) || width <= 0) return null;
  return (
    <View style={[styles.orbit, { width, height }, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={backdrop ? `orbit-backdrop-${backdrop}` : 'orbit-cover'}>
      <CoverLayers url={url} backdrop={backdrop} width={width} height={height} />
      <LinearGradient
        colors={[nightA(1), nightA(backdrop ? 0.1 : 0.35), nightA(backdrop ? 0.15 : 0.4), nightA(1)]}
        locations={[0, 0.28, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  orbit: { position: 'absolute', overflow: 'hidden' },
});
