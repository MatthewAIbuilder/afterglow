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
          <LinearGradient colors={[nightA(0.4), nightA(0), nightA(0.2), nightA(1)]} locations={[0, 0.22, 0.7, 1]} style={StyleSheet.absoluteFill} />
        </>
      ) : (
        <>
          <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
          <LinearGradient colors={[nightA(0.55), nightA(0.05), nightA(0.35), nightA(1)]} locations={[0, 0.3, 0.65, 1]} style={StyleSheet.absoluteFill} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
});
