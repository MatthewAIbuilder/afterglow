import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AnimatedBackdrop } from '../features/profile/AnimatedBackdrop';
import type { BackdropId } from '../features/profile/backdrops';
import { nightA } from '../theme/tokens';

/**
 * The top of a profile, behind the header: an animated background when one
 * is chosen (see `useProfileBackdrop`), else the cover photo. Darkened at the
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
      {backdrop ? (
        <>
          <AnimatedBackdrop id={backdrop} width={width} height={height} />
          {/* Clear over the orbit, then a long, gentle fade into the night below the name. */}
          <LinearGradient colors={[nightA(0.4), nightA(0), nightA(0.08), nightA(0.55), nightA(1)]} locations={[0, 0.16, 0.58, 0.82, 1]} style={StyleSheet.absoluteFill} />
        </>
      ) : (
        <>
          <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
          <LinearGradient colors={[nightA(0.55), nightA(0.05), nightA(0.3), nightA(0.7), nightA(1)]} locations={[0, 0.2, 0.58, 0.82, 1]} style={StyleSheet.absoluteFill} />
        </>
      )}
    </View>
  );
}



/**
 * Your profile background behind an orbit in the middle of a page (the
 * Friends tab): the animated background or cover photo, faded into the night
 * at the top and bottom so it reads as light behind the faces, not a box.
 * Nothing without either. Sized and placed by the caller.
 */
export function OrbitBackdrop({ url, backdrop, width, height, style }: { url?: string; backdrop?: BackdropId; width: number; height: number; style?: object }) {
  if ((!url && !backdrop) || width <= 0) return null;
  return (
    <View style={[styles.orbit, { width, height }, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={backdrop ? `orbit-backdrop-${backdrop}` : 'orbit-cover'}>
      {backdrop ? <AnimatedBackdrop id={backdrop} width={width} height={height} /> : <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />}
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
