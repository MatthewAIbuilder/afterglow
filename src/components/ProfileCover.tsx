import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AnimatedBackdrop } from '../features/profile/AnimatedBackdrop';
import type { BackdropId } from '../features/profile/backdrops';
import { nightA } from '../theme/tokens';
import { FadeMask } from './FadeMask';


/**
 * The top of a profile, behind the header: an animated background when one
 * is chosen (see `useProfileBackdrop`), else the cover photo; one or the
 * other, never both. Darkened at the very top for the status bar, then
 * faded out (a real fade to transparent, `FadeMask`) so it melts into the
 * night sky behind the page with no edge. Nothing without either.
 */
export function ProfileCover({ url, height, backdrop, fadeFrom = 0.7 }: { url?: string; height: number; backdrop?: BackdropId; /** Where it starts fading out, as a share of its height: just under the orbit. */ fadeFrom?: number }) {
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
      <FadeMask bottom={fadeFrom} style={StyleSheet.absoluteFill}>
        {backdrop ? <AnimatedBackdrop id={backdrop} width={width} height={height} /> : <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />}
        {/* A little shade under the status bar; a photo also gets a soft veil so the name over it reads. */}
        <LinearGradient
          colors={backdrop ? [nightA(0.4), nightA(0), nightA(0)] : [nightA(0.55), nightA(0.12), nightA(0.3)]}
          locations={[0, 0.18, 1]}
          style={StyleSheet.absoluteFill}
        />
      </FadeMask>
    </View>
  );
}

/**
 * Your profile background behind an orbit in the middle of a page (the
 * Friends tab): the animated background or cover photo, faded out at the top
 * and bottom so it reads as light behind the faces, not a box. Nothing
 * without either. Sized and placed by the caller.
 */
export function OrbitBackdrop({ url, backdrop, width, height, style }: { url?: string; backdrop?: BackdropId; width: number; height: number; style?: object }) {
  if ((!url && !backdrop) || width <= 0) return null;
  return (
    <View style={[styles.orbit, { width, height }, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={backdrop ? `orbit-backdrop-${backdrop}` : 'orbit-cover'}>
      <FadeMask top={0.3} bottom={0.7} style={StyleSheet.absoluteFill}>
        {backdrop ? <AnimatedBackdrop id={backdrop} width={width} height={height} /> : <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />}
        {backdrop ? null : <View style={[StyleSheet.absoluteFill, { backgroundColor: nightA(0.35) }]} />}
      </FadeMask>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  orbit: { position: 'absolute', overflow: 'hidden' },
});
